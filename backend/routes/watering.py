from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user
from models.plant import Plant
from models.user import User
from models.watering import CareSchedule

router = APIRouter(prefix="/plants/{plant_id}/schedules", tags=["schedules"])


class ScheduleOut(BaseModel):
    id: int
    plant_id: int
    task_type: str
    frequency_days: int
    notify_days_before: int
    last_done_at: datetime | None
    next_due_at: datetime | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ScheduleCreate(BaseModel):
    task_type: str = "water"
    frequency_days: int
    notify_days_before: int = 0
    last_done_at: datetime | None = None


class ScheduleUpdate(BaseModel):
    task_type: str | None = None
    frequency_days: int | None = None
    notify_days_before: int | None = None
    is_active: bool | None = None


def _get_plant(plant_id: int, db: Session, user: User) -> Plant:
    plant = (
        db.query(Plant).filter(Plant.id == plant_id, Plant.owner_id == user.id).first()
    )
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant


def _compute_next_due(last_done_at: datetime | None, frequency_days: int) -> datetime:
    base = last_done_at or datetime.utcnow()
    return base + timedelta(days=frequency_days)


@router.get("/", response_model=list[ScheduleOut])
def list_schedules(
    plant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_plant(plant_id, db, current_user)
    return db.query(CareSchedule).filter(CareSchedule.plant_id == plant_id).all()


@router.post("/", response_model=ScheduleOut, status_code=201)
def create_schedule(
    plant_id: int,
    data: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_plant(plant_id, db, current_user)
    next_due = _compute_next_due(data.last_done_at, data.frequency_days)
    schedule = CareSchedule(
        plant_id=plant_id,
        task_type=data.task_type,
        frequency_days=data.frequency_days,
        notify_days_before=data.notify_days_before,
        last_done_at=data.last_done_at,
        next_due_at=next_due,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.patch("/{schedule_id}", response_model=ScheduleOut)
def update_schedule(
    plant_id: int,
    schedule_id: int,
    data: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_plant(plant_id, db, current_user)
    schedule = (
        db.query(CareSchedule)
        .filter(CareSchedule.id == schedule_id, CareSchedule.plant_id == plant_id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(schedule, field, value)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.post("/{schedule_id}/done", response_model=ScheduleOut)
def mark_done(
    plant_id: int,
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a task as done — resets last_done_at to now and recalculates next_due_at."""
    _get_plant(plant_id, db, current_user)
    schedule = (
        db.query(CareSchedule)
        .filter(CareSchedule.id == schedule_id, CareSchedule.plant_id == plant_id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    schedule.last_done_at = datetime.utcnow()
    schedule.next_due_at = _compute_next_due(
        schedule.last_done_at, schedule.frequency_days
    )
    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(
    plant_id: int,
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_plant(plant_id, db, current_user)
    schedule = (
        db.query(CareSchedule)
        .filter(CareSchedule.id == schedule_id, CareSchedule.plant_id == plant_id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(schedule)
    db.commit()


# Global endpoint — get all due tasks across all user's plants
router_global = APIRouter(prefix="/schedules", tags=["schedules"])


class PlantScheduleSummary(BaseModel):
    plant_id: int
    task_type: str
    next_due_at: datetime
    days_until: int  # negative = overdue


@router_global.get("/summary", response_model=list[PlantScheduleSummary])
def get_schedule_summary(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Return all active schedules across all of the current user's plants."""
    now = datetime.utcnow()
    plant_ids = [
        p.id for p in db.query(Plant).filter(Plant.owner_id == current_user.id).all()
    ]
    if not plant_ids:
        return []

    rows = (
        db.query(CareSchedule)
        .filter(
            CareSchedule.plant_id.in_(plant_ids),
            CareSchedule.is_active,
            CareSchedule.next_due_at is not None,
        )
        .order_by(CareSchedule.next_due_at)
        .all()
    )

    result = []
    for s in rows:
        delta = s.next_due_at - now
        # Use round() to match date-fns formatDistanceToNow behaviour on the frontend
        days_until = round(delta.total_seconds() / 86400)
        result.append(
            PlantScheduleSummary(
                plant_id=s.plant_id,
                task_type=s.task_type,
                next_due_at=s.next_due_at,
                days_until=days_until,
            )
        )
    return result


@router_global.get("/due", response_model=list[ScheduleOut])
def get_due_tasks(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Return all active schedules that are due (next_due_at <= now) for the current user."""
    now = datetime.utcnow()
    plant_ids = [
        p.id for p in db.query(Plant).filter(Plant.owner_id == current_user.id).all()
    ]
    return (
        db.query(CareSchedule)
        .filter(
            CareSchedule.plant_id.in_(plant_ids),
            CareSchedule.is_active,
            CareSchedule.next_due_at <= now,
        )
        .all()
    )
