import logging
import os
from contextlib import asynccontextmanager

import yaml
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import models.journal  # noqa
import models.plant  # noqa
import models.push_subscription  # noqa
import models.setting  # noqa

# Import all models so SQLAlchemy creates the tables
import models.user  # noqa
import models.watering  # noqa
from core.database import Base, SessionLocal, engine
from routes.auth import router as auth_router
from routes.journal import router as journal_router
from routes.notifications import router as notifications_router
from routes.plants import router as plants_router
from routes.settings import router as settings_router
from routes.watering import router as watering_router
from routes.watering import router_global as watering_global_router

logger = logging.getLogger("planta")

DEMO_PHOTOS = [
    (
        "https://inaturalist-open-data.s3.amazonaws.com/photos/70387869/medium.jpg",
        "demo_70387869.jpg",
    ),
    ("https://static.inaturalist.org/photos/17640259/medium.jpg", "demo_17640259.jpg"),
    (
        "https://inaturalist-open-data.s3.amazonaws.com/photos/1150164/medium.jpg",
        "demo_1150164.jpg",
    ),
    (
        "https://inaturalist-open-data.s3.amazonaws.com/photos/68748539/medium.jpg",
        "demo_68748539.jpg",
    ),
    (
        "https://inaturalist-open-data.s3.amazonaws.com/photos/56963352/medium.jpg",
        "demo_56963352.jpg",
    ),
    (
        "https://inaturalist-open-data.s3.amazonaws.com/photos/488135905/medium.jpeg",
        "demo_488135905.jpeg",
    ),
    (
        "https://inaturalist-open-data.s3.amazonaws.com/photos/542743857/medium.jpg",
        "demo_542743857.jpg",
    ),
    (
        "https://inaturalist-open-data.s3.amazonaws.com/photos/542743865/medium.jpg",
        "demo_542743865.jpg",
    ),
    (
        "https://inaturalist-open-data.s3.amazonaws.com/photos/104468007/medium.jpeg",
        "demo_104468007.jpeg",
    ),
]


def seed_admin():
    """Create an admin account on first startup if ADMIN_EMAIL and ADMIN_PASSWORD are set."""
    email = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")
    name = os.getenv("ADMIN_NAME", "Admin")

    if not email or not password:
        return

    from core.security import hash_password
    from models.user import User

    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first():
            logger.info("Admin account already exists, skipping seed.")
            return
        user = User(name=name, email=email, hashed_password=hash_password(password))
        db.add(user)
        db.commit()
        logger.info(f"Admin account created: {email}")
    finally:
        db.close()


def seed_config():
    """Read config.yml (or CONFIG_FILE env var) and seed admin user's settings.

    Only writes a setting if no value exists yet — user changes in the UI are never overwritten.
    Falls back to environment variables when no config file exists.
    """
    # Collect integrations from config.yml first, then fall back to env vars
    integrations = {}

    config_path = os.getenv("CONFIG_FILE", "config.yml")
    if os.path.exists(config_path):
        try:
            with open(config_path) as f:
                config = yaml.safe_load(f) or {}
            integrations = config.get("integrations") or {}
        except Exception as e:
            logger.warning(f"Could not read {config_path}: {e}")

    # Fill in any missing keys from environment variables
    env_map = {
        "ai_provider": "AI_PROVIDER",
        "anthropic_api_key": "ANTHROPIC_API_KEY",
        "openai_api_key": "OPENAI_API_KEY",
        "perenual_api_key": "PERENUAL_API_KEY",
    }
    for setting_key, env_var in env_map.items():
        if not integrations.get(setting_key):
            val = os.getenv(env_var)
            if val:
                integrations[setting_key] = val

    if not integrations:
        return

    admin_email = os.getenv("ADMIN_EMAIL")
    if not admin_email:
        logger.warning(
            "Integrations configured but ADMIN_EMAIL is not set — skipping seed."
        )
        return

    from models.setting import Setting
    from models.user import User

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            logger.warning(
                f"Admin user {admin_email} not found — skipping config seed."
            )
            return

        for key, value in integrations.items():
            if not value:
                continue
            existing = (
                db.query(Setting)
                .filter(Setting.user_id == admin.id, Setting.key == key)
                .first()
            )
            if existing:
                # Don't overwrite — user may have updated via the UI
                continue
            from core.crypto import encrypt_value

            db.add(Setting(user_id=admin.id, key=key, value=encrypt_value(str(value))))
            logger.info(f"Seeded setting '{key}' for admin.")

        db.commit()
    finally:
        db.close()


async def send_due_notifications():
    """Hourly job: send push notifications to users whose preferred notification hour matches now."""
    from collections import defaultdict
    from datetime import datetime, timedelta

    from models.plant import Plant
    from models.push_subscription import PushSubscription
    from models.setting import Setting
    from models.watering import CareSchedule
    from routes.notifications import send_push

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        today_end = now.replace(hour=23, minute=59, second=59)

        # Fetch all active schedules and filter in Python so each schedule's
        # notify_days_before offset can be applied individually.
        all_active = (
            db.query(CareSchedule)
            .filter(CareSchedule.is_active, CareSchedule.next_due_at.isnot(None))
            .all()
        )
        due_schedules = [
            s
            for s in all_active
            if s.next_due_at - timedelta(days=s.notify_days_before) <= today_end
        ]

        # Group by user
        user_tasks: dict = defaultdict(list)
        user_overdue: dict = defaultdict(list)
        for s in due_schedules:
            plant = db.query(Plant).filter(Plant.id == s.plant_id).first()
            if not plant:
                continue
            label = f"{s.task_type} your {plant.name}"
            if s.next_due_at < now:
                user_overdue[plant.owner_id].append(label)
            else:
                user_tasks[plant.owner_id].append(label)

        all_user_ids = set(user_tasks) | set(user_overdue)
        for user_id in all_user_ids:
            # Check user's notification preferences
            enabled_row = (
                db.query(Setting)
                .filter(
                    Setting.user_id == user_id, Setting.key == "notifications_enabled"
                )
                .first()
            )
            if enabled_row and enabled_row.value == "false":
                continue

            hour_row = (
                db.query(Setting)
                .filter(Setting.user_id == user_id, Setting.key == "notifications_hour")
                .first()
            )
            preferred_hour = int(hour_row.value) if hour_row else 8
            if now.hour != preferred_hour:
                continue

            subs = (
                db.query(PushSubscription)
                .filter(PushSubscription.user_id == user_id)
                .all()
            )
            if not subs:
                continue

            overdue = user_overdue.get(user_id, [])
            due = user_tasks.get(user_id, [])
            all_tasks = overdue + due
            count = len(all_tasks)

            if overdue:
                title = f"🌱 SproutVibe — {len(overdue)} task{'s' if len(overdue) != 1 else ''} overdue"
            else:
                title = (
                    f"🌱 SproutVibe — {count} task{'s' if count != 1 else ''} due today"
                )

            body = ", ".join(all_tasks[:5])
            if len(all_tasks) > 5:
                body += f" and {len(all_tasks) - 5} more"

            for sub in subs:
                send_push(sub, title, body)
    finally:
        db.close()


async def cleanup_demo_users():
    """Nightly job: delete demo users whose session has expired (>24 h old)."""
    from datetime import datetime

    from models.user import User

    db = SessionLocal()
    try:
        expired = (
            db.query(User)
            .filter(User.is_demo == True, User.demo_expires_at <= datetime.utcnow())  # noqa: E712
            .all()
        )
        for u in expired:
            db.delete(u)
        db.commit()
        logger.info(f"Demo cleanup: deleted {len(expired)} expired demo user(s)")
    finally:
        db.close()


def _run_migrations():
    """Apply additive schema changes that create_all won't handle on existing DBs.
    Add ALTER TABLE statements here for new columns, indexes, etc.

    Each migration runs in its own connection. PostgreSQL uses IF NOT EXISTS
    (supported since 9.6) so existing columns are silently skipped. SQLite
    does not support IF NOT EXISTS for ADD COLUMN, so we catch the duplicate-
    column error instead. Both approaches are safe to re-run.
    """
    from sqlalchemy import text

    is_pg = engine.dialect.name == "postgresql"

    def _add_col(table: str, col: str, col_type: str) -> str:
        if is_pg:
            return f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type}"
        return f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"

    migrations: list[str] = [
        _add_col("care_schedules", "notify_hour", "INTEGER NOT NULL DEFAULT 8"),
        _add_col("care_schedules", "notify_days_before", "INTEGER NOT NULL DEFAULT 0"),
        _add_col("users", "is_demo", "INTEGER NOT NULL DEFAULT 0"),
        _add_col("users", "demo_expires_at", "TIMESTAMP"),
    ]
    for stmt in migrations:
        try:
            with engine.connect() as conn:
                conn.execute(text(stmt))
                conn.commit()
                logger.info(f"Migration applied: {stmt}")
        except Exception as e:
            # Benign: column already exists (SQLite raises "duplicate column name")
            logger.debug(f"Migration skipped (already applied): {stmt} — {e}")


def _migrate_settings_encryption():
    """Re-encrypt any plaintext settings values written before encryption was introduced.

    Fernet tokens always start with 'gAAAAA' (base64 of the 0x80 version byte).
    Any value that doesn't match is plaintext and gets re-encrypted in place.
    """
    from core.crypto import encrypt_value
    from models.setting import Setting

    db = SessionLocal()
    try:
        rows = db.query(Setting).all()
        migrated = 0
        for row in rows:
            if not row.value or row.value.startswith("gAAAAA"):
                continue  # empty or already a Fernet token
            row.value = encrypt_value(row.value)
            migrated += 1
        if migrated:
            db.commit()
            logger.info(
                f"Settings encryption migration: re-encrypted {migrated} value(s)"
            )
    finally:
        db.close()


async def prefetch_demo_images():
    """Download demo plant photos to the uploads PVC on first run (kiosk mode only).
    Skips any file that already exists — safe to call on every startup."""
    import httpx

    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for url, filename in DEMO_PHOTOS:
            dest = os.path.join(upload_dir, filename)
            if os.path.exists(dest):
                continue
            try:
                resp = await client.get(url, headers={"User-Agent": "Sprout/1.0"})
                resp.raise_for_status()
                with open(dest, "wb") as f:
                    f.write(resp.content)
                logger.info(f"Demo image cached: {filename}")
            except Exception as exc:
                logger.warning(f"Failed to cache demo image {filename}: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    _migrate_settings_encryption()
    if os.getenv("KIOSK_MODE", "false").lower() != "true":
        seed_admin()
        seed_config()
    else:
        await prefetch_demo_images()

    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler

        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            send_due_notifications, "interval", id="hourly_notifications", hours=1
        )
        scheduler.add_job(
            cleanup_demo_users, "cron", id="nightly_demo_cleanup", hour=2, minute=0
        )
        scheduler.start()
        app.state.scheduler = scheduler
        logger.info(
            "Scheduled due notification job (hourly, respects per-user time preference)"
        )
    except ImportError:
        logger.warning("apscheduler not installed — daily push notifications disabled")
        app.state.scheduler = None

    yield


app = FastAPI(title="Sprout API", version="1.0.0", lifespan=lifespan)


@app.get("/version")
def get_version():
    return {
        "version": os.getenv("APP_VERSION", "dev"),
        "source_url": "https://github.com/jorisdejosselin/sproutvibe",
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost",  # Android Capacitor WebView (HTTP)
        "https://localhost",  # Android Capacitor WebView (HTTPS)
        "capacitor://localhost",  # iOS Capacitor WebView
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth_router)
app.include_router(plants_router)
app.include_router(journal_router)
app.include_router(watering_router)
app.include_router(watering_global_router)
app.include_router(settings_router)
app.include_router(notifications_router)

if os.getenv("DEV_MODE") == "true":
    from routes.dev import router as dev_router

    app.include_router(dev_router)
    logger.info("Dev routes enabled (/dev/*)")


@app.get("/")
def root():
    return {"message": "Planta Alternative API is running"}
