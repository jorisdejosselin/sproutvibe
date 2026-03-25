from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from core.database import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    title = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)
    health = Column(String, nullable=True)  # thriving | good | okay | poor | critical
    entry_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    plant = relationship("Plant", back_populates="journal_entries")
