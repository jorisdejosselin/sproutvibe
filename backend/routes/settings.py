from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.crypto import decrypt_value, encrypt_value
from core.database import get_db
from core.security import get_current_user
from models.setting import Setting
from models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsOut(BaseModel):
    data: dict[str, str | None]


class SettingsIn(BaseModel):
    data: dict[str, str | None]


def _get_all(user_id: int, db: Session) -> dict[str, str | None]:
    rows = db.query(Setting).filter(Setting.user_id == user_id).all()
    return {r.key: (decrypt_value(r.value) if r.value else r.value) for r in rows}


def _get_value(user_id: int, key: str, db: Session) -> str | None:
    row = (
        db.query(Setting).filter(Setting.user_id == user_id, Setting.key == key).first()
    )
    return decrypt_value(row.value) if row and row.value else None


@router.get("/", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return {"data": _get_all(current_user.id, db)}


@router.put("/", response_model=SettingsOut)
def save_settings(
    body: SettingsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for key, value in body.data.items():
        encrypted = encrypt_value(value) if value is not None else value
        existing = (
            db.query(Setting)
            .filter(Setting.user_id == current_user.id, Setting.key == key)
            .first()
        )
        if existing:
            existing.value = encrypted
        else:
            db.add(Setting(user_id=current_user.id, key=key, value=encrypted))
    db.commit()
    return {"data": _get_all(current_user.id, db)}
