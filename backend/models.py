from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class AssetType(str, enum.Enum):
    crypto = "crypto"
    stock = "stock"
    forex = "forex"
    cash = "cash"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    assets = relationship("Asset", back_populates="owner", cascade="all, delete-orphan")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)
    name = Column(String, nullable=False)
    asset_type = Column(String, nullable=False)  # crypto, stock, forex, cash
    quantity = Column(Float, nullable=False, default=0.0)
    avg_buy_price = Column(Float, nullable=False, default=0.0)
    coingecko_id = Column(String, nullable=True)  # for crypto lookups
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="assets")
