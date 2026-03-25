import os
import uuid
from datetime import datetime

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user
from models.journal import JournalEntry
from models.plant import Plant
from models.user import User

router = APIRouter(prefix="/plants/{plant_id}/journal", tags=["journal"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


VALID_HEALTH = {"thriving", "good", "okay", "poor", "critical"}


class JournalEntryOut(BaseModel):
    id: int
    plant_id: int
    title: str | None
    body: str | None
    photo_url: str | None
    health: str | None
    entry_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class JournalEntryCreate(BaseModel):
    title: str | None = None
    body: str | None = None
    health: str | None = None
    entry_date: datetime | None = None


class JournalEntryUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    health: str | None = None
    entry_date: datetime | None = None


def _get_plant(plant_id: int, db: Session, user: User) -> Plant:
    plant = (
        db.query(Plant).filter(Plant.id == plant_id, Plant.owner_id == user.id).first()
    )
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant


@router.get("/", response_model=list[JournalEntryOut])
def list_entries(
    plant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_plant(plant_id, db, current_user)
    return (
        db.query(JournalEntry)
        .filter(JournalEntry.plant_id == plant_id)
        .order_by(JournalEntry.entry_date.desc())
        .all()
    )


@router.post("/", response_model=JournalEntryOut, status_code=201)
def create_entry(
    plant_id: int,
    data: JournalEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_plant(plant_id, db, current_user)
    entry = JournalEntry(
        plant_id=plant_id,
        entry_date=data.entry_date or datetime.utcnow(),
        **{k: v for k, v in data.model_dump().items() if k != "entry_date"},
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=JournalEntryOut)
def get_entry(
    plant_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_plant(plant_id, db, current_user)
    entry = (
        db.query(JournalEntry)
        .filter(JournalEntry.id == entry_id, JournalEntry.plant_id == plant_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.patch("/{entry_id}", response_model=JournalEntryOut)
def update_entry(
    plant_id: int,
    entry_id: int,
    data: JournalEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_plant(plant_id, db, current_user)
    entry = (
        db.query(JournalEntry)
        .filter(JournalEntry.id == entry_id, JournalEntry.plant_id == plant_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    plant_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_plant(plant_id, db, current_user)
    entry = (
        db.query(JournalEntry)
        .filter(JournalEntry.id == entry_id, JournalEntry.plant_id == plant_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()


@router.post("/{entry_id}/photo", response_model=JournalEntryOut)
async def upload_photo(
    plant_id: int,
    entry_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_plant(plant_id, db, current_user)
    entry = (
        db.query(JournalEntry)
        .filter(JournalEntry.id == entry_id, JournalEntry.plant_id == plant_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(await file.read())
    entry.photo_url = f"/uploads/{filename}"
    db.commit()
    db.refresh(entry)
    return entry
