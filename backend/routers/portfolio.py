from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class AssetCreate(BaseModel):
    symbol: str
    name: str
    asset_type: str  # crypto, stock, forex, cash
    quantity: float
    avg_buy_price: float
    coingecko_id: Optional[str] = None


class AssetUpdate(BaseModel):
    symbol: Optional[str] = None
    name: Optional[str] = None
    quantity: Optional[float] = None
    avg_buy_price: Optional[float] = None
    coingecko_id: Optional[str] = None


class AssetOut(BaseModel):
    id: int
    symbol: str
    name: str
    asset_type: str
    quantity: float
    avg_buy_price: float
    coingecko_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


VALID_ASSET_TYPES = {"crypto", "stock", "forex", "cash"}


@router.get("/assets", response_model=List[AssetOut])
def get_assets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Asset).filter(models.Asset.user_id == current_user.id).all()


@router.post("/assets", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    asset_data: AssetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if asset_data.asset_type not in VALID_ASSET_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid asset_type. Must be one of: {VALID_ASSET_TYPES}")
    if asset_data.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
    if asset_data.avg_buy_price < 0:
        raise HTTPException(status_code=400, detail="avg_buy_price cannot be negative")

    asset = models.Asset(
        user_id=current_user.id,
        symbol=asset_data.symbol.upper(),
        name=asset_data.name,
        asset_type=asset_data.asset_type,
        quantity=asset_data.quantity,
        avg_buy_price=asset_data.avg_buy_price,
        coingecko_id=asset_data.coingecko_id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.put("/assets/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: int,
    asset_data: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    asset = db.query(models.Asset).filter(
        models.Asset.id == asset_id,
        models.Asset.user_id == current_user.id
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    update_data = asset_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(asset, field, value)
    if "symbol" in update_data:
        asset.symbol = update_data["symbol"].upper()

    asset.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    asset = db.query(models.Asset).filter(
        models.Asset.id == asset_id,
        models.Asset.user_id == current_user.id
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(asset)
    db.commit()
