from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user
from models.plant import Plant
from models.push_subscription import PushSubscription
from models.user import User
from models.watering import CareSchedule
from routes.notifications import send_push

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/force-due")
def force_all_due(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Set all schedules to overdue — useful for testing the due tasks UI."""
    plant_ids = [
        p.id for p in db.query(Plant).filter(Plant.owner_id == current_user.id).all()
    ]
    schedules = (
        db.query(CareSchedule).filter(CareSchedule.plant_id.in_(plant_ids)).all()
    )
    past = datetime.utcnow() - timedelta(days=1)
    for s in schedules:
        s.last_done_at = datetime.utcnow() - timedelta(days=s.frequency_days + 1)
        s.next_due_at = past
    db.commit()
    return {"updated": len(schedules)}


@router.post("/reset-due")
def reset_all_due(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Reset all schedules to fresh (due in frequency_days from now)."""
    plant_ids = [
        p.id for p in db.query(Plant).filter(Plant.owner_id == current_user.id).all()
    ]
    schedules = (
        db.query(CareSchedule).filter(CareSchedule.plant_id.in_(plant_ids)).all()
    )
    now = datetime.utcnow()
    for s in schedules:
        s.last_done_at = now
        s.next_due_at = now + timedelta(days=s.frequency_days)
    db.commit()
    return {"updated": len(schedules)}


@router.post("/send-test-push")
def send_test_push(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Send a test push notification to all subscriptions of the current user."""
    subs = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == current_user.id)
        .all()
    )
    if not subs:
        return {"sent": 0, "detail": "No push subscriptions found for this user"}
    for sub in subs:
        send_push(sub, "🌱 Sprout test", "Push notifications are working!", url="/")
    return {"sent": len(subs)}


@router.get("/plants-schedules")
def plants_schedules(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Return all active schedules for the current user with plant name, for the per-item picker."""
    rows = (
        db.query(CareSchedule, Plant)
        .join(Plant, CareSchedule.plant_id == Plant.id)
        .filter(Plant.owner_id == current_user.id, CareSchedule.is_active)
        .all()
    )
    return [
        {
            "id": s.id,
            "plant_name": p.name,
            "task_type": s.task_type,
            "next_due_at": s.next_due_at,
        }
        for s, p in rows
    ]


@router.post("/trigger-notifications")
async def trigger_notifications(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Run the daily notification job immediately (all users)."""
    from main import send_due_notifications

    await send_due_notifications()
    return {"status": "triggered"}


@router.post("/notify-schedule/{schedule_id}")
def notify_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a real push notification for a single schedule."""
    schedule = db.query(CareSchedule).filter(CareSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    plant = (
        db.query(Plant)
        .filter(Plant.id == schedule.plant_id, Plant.owner_id == current_user.id)
        .first()
    )
    if not plant:
        raise HTTPException(404, "Plant not found or not owned by current user")
    subs = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == current_user.id)
        .all()
    )
    for sub in subs:
        send_push(
            sub,
            "🌱 Sprout — 1 task due today",
            f"{schedule.task_type} your {plant.name}",
            url=f"/plants/{plant.id}",
        )
    return {"sent": len(subs)}


class SetHourRequest(BaseModel):
    hour: int  # 0–23


@router.post("/set-notification-hour")
def set_notification_hour(
    data: SetHourRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reschedule the daily notification APScheduler job to a different hour (dev only, not persisted)."""
    scheduler = getattr(request.app.state, "scheduler", None)
    if not scheduler:
        raise HTTPException(503, "Scheduler not running")
    scheduler.reschedule_job(
        "daily_notifications", trigger="cron", hour=data.hour, minute=0
    )
    return {"hour": data.hour}
