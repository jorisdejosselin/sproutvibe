from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_demo = Column(Boolean, default=False, nullable=False)
    demo_expires_at = Column(DateTime, nullable=True)  # NULL for real users
    # Bumped when the password changes, which invalidates tokens issued before
    # it. Tokens live a year, so without this a password change would revoke
    # nothing for anyone already holding one.
    token_version = Column(Integer, nullable=False, default=0, server_default="0")

    plants = relationship("Plant", back_populates="owner", cascade="all, delete-orphan")
