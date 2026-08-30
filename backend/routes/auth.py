import os
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from core.database import get_db
from core.metrics import demo_sessions_total
from core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    is_demo: bool = False

    class Config:
        from_attributes = True


@router.post("/register", response_model=UserOut, status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=req.name, email=req.email, hashed_password=hash_password(req.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/token", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


class UpdateMeRequest(BaseModel):
    name: str


@router.put("/me", response_model=UserOut)
def update_me(
    req: UpdateMeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.name = req.name.strip()
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/kiosk")
def kiosk_status():
    """Public endpoint — returns whether kiosk/demo mode is enabled."""
    return {"kiosk_mode": os.getenv("KIOSK_MODE", "false").lower() == "true"}


@router.post("/demo", response_model=TokenResponse)
def create_demo_session(db: Session = Depends(get_db)):
    """Create an isolated demo user session. Only available when KIOSK_MODE=true."""
    if os.getenv("KIOSK_MODE", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="Kiosk mode is not enabled")

    demo_id = uuid.uuid4().hex[:8]
    now = datetime.utcnow()
    user = User(
        name="Demo User",
        email=f"demo-{demo_id}@sprout.demo",
        hashed_password=hash_password(uuid.uuid4().hex),
        is_demo=True,
        demo_expires_at=now + timedelta(hours=24),
    )
    db.add(user)
    db.flush()
    _seed_demo_plants(db, user.id, now)
    db.commit()

    # After the commit, so a failed insert is not counted as a visitor.
    demo_sessions_total.inc()

    return {"access_token": create_access_token({"sub": str(user.id)})}


def _seed_demo_plants(db: Session, owner_id: int, now: datetime) -> None:
    from models.journal import JournalEntry
    from models.plant import Plant
    from models.watering import CareSchedule

    # iNaturalist open-data photos (CC-licensed) — pre-fetched to PVC on startup by prefetch_demo_images()
    demo_plants = [
        {
            "name": "Monstera",
            "species": "Monstera deliciosa",
            "location": "Living room",
            "photo_url": "/uploads/demo_70387869.jpg",
            "notes": "Loves bright indirect light. Wipe leaves monthly.",
            "acquired_on": now - timedelta(days=180),
            "schedules": [
                {"task_type": "water", "frequency_days": 7, "days_offset": 2},
                {"task_type": "fertilize", "frequency_days": 30, "days_offset": 10},
            ],
            "journal": [
                {
                    "health": "thriving",
                    "title": "Looking great!",
                    "body": "New leaf unfurling on the west side. Growth has really picked up since I moved it closer to the window.",
                    "photo_url": "/uploads/demo_17640259.jpg",
                    "days_ago": 3,
                },
                {
                    "health": "thriving",
                    "title": "First fenestration!",
                    "body": "The newest leaf has developed its first split. It's officially a real Monstera now.",
                    "photo_url": "/uploads/demo_1150164.jpg",
                    "days_ago": 21,
                },
            ],
        },
        {
            "name": "Snake Plant",
            "species": "Dracaena trifasciata",
            "location": "Bedroom",
            "photo_url": "/uploads/demo_68748539.jpg",
            "notes": "Extremely drought-tolerant. Almost impossible to kill.",
            "acquired_on": now - timedelta(days=365),
            "schedules": [
                {"task_type": "water", "frequency_days": 14, "days_offset": 5},
            ],
            "journal": [
                {
                    "health": "good",
                    "title": "Steady growth",
                    "body": "Two new pups spotted at the base. Going to let them grow a bit before separating.",
                    "photo_url": "/uploads/demo_56963352.jpg",
                    "days_ago": 5,
                },
                {
                    "health": "good",
                    "title": "Repotted",
                    "body": "Moved to a slightly larger terracotta pot. Roots were starting to circle the bottom.",
                    "photo_url": "/uploads/demo_488135905.jpeg",
                    "days_ago": 45,
                },
            ],
        },
        {
            "name": "Fiddle Leaf Fig",
            "species": "Ficus lyrata",
            "location": "Office",
            "photo_url": "/uploads/demo_542743857.jpg",
            "notes": "Sensitive to drafts. Keep away from AC vents.",
            "acquired_on": now - timedelta(days=90),
            "schedules": [
                {"task_type": "water", "frequency_days": 7, "days_offset": -1},
                {"task_type": "mist", "frequency_days": 3, "days_offset": 0},
                {"task_type": "fertilize", "frequency_days": 21, "days_offset": 8},
            ],
            "journal": [
                {
                    "health": "okay",
                    "title": "Dropped two leaves",
                    "body": "Moved it away from the AC vent — hopefully this stabilises it. Leaves were getting brown edges.",
                    "photo_url": "/uploads/demo_542743865.jpg",
                    "days_ago": 2,
                },
                {
                    "health": "good",
                    "title": "New growth!",
                    "body": "Two new leaves coming in at the top. The move seems to have helped.",
                    "photo_url": "/uploads/demo_104468007.jpeg",
                    "days_ago": 30,
                },
            ],
        },
    ]

    for p_data in demo_plants:
        plant = Plant(
            owner_id=owner_id,
            name=p_data["name"],
            species=p_data["species"],
            location=p_data["location"],
            photo_url=p_data["photo_url"],
            notes=p_data["notes"],
            acquired_on=p_data["acquired_on"],
        )
        db.add(plant)
        db.flush()

        for s in p_data["schedules"]:
            next_due = now + timedelta(days=s["days_offset"])
            last_done = next_due - timedelta(days=s["frequency_days"])
            db.add(
                CareSchedule(
                    plant_id=plant.id,
                    task_type=s["task_type"],
                    frequency_days=s["frequency_days"],
                    last_done_at=last_done,
                    next_due_at=next_due,
                    is_active=True,
                )
            )

        for j in p_data["journal"]:
            db.add(
                JournalEntry(
                    plant_id=plant.id,
                    title=j["title"],
                    body=j["body"],
                    health=j["health"],
                    photo_url=j["photo_url"],
                    entry_date=now - timedelta(days=j["days_ago"]),
                )
            )
