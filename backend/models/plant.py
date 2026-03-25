from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from core.database import Base


class Plant(Base):
    __tablename__ = "plants"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)  # user-given nickname
    species = Column(String, nullable=True)  # botanical/common species name
    photo_url = Column(String, nullable=True)
    location = Column(String, nullable=True)  # e.g. "Living room window"
    notes = Column(Text, nullable=True)
    acquired_on = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="plants")
    journal_entries = relationship(
        "JournalEntry", back_populates="plant", cascade="all, delete-orphan"
    )
    care_schedules = relationship(
        "CareSchedule", back_populates="plant", cascade="all, delete-orphan"
    )
