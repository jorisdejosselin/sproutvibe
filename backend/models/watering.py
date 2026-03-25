from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from core.database import Base


class CareSchedule(Base):
    __tablename__ = "care_schedules"

    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    task_type = Column(String, default="water")  # "water", "fertilize", "mist", "repot"
    frequency_days = Column(Integer, nullable=False)  # repeat every N days
    last_done_at = Column(DateTime, nullable=True)
    next_due_at = Column(DateTime, nullable=True)
    notify_days_before = Column(
        Integer, default=0, nullable=False
    )  # notify N days before due
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    plant = relationship("Plant", back_populates="care_schedules")
