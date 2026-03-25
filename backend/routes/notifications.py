import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user
from core.vapid import VAPID_EMAIL, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY
from models.push_subscription import PushSubscription
from models.user import User

logger = logging.getLogger("planta")
router = APIRouter(prefix="/notifications", tags=["notifications"])


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/vapid-public-key")
def get_vapid_public_key():
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="VAPID not configured")
    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/subscribe", status_code=201)
def subscribe(
    data: SubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == data.endpoint)
        .first()
    )
    if existing:
        existing.p256dh = data.keys.p256dh
        existing.auth = data.keys.auth
        existing.user_id = current_user.id
    else:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth,
        )
        db.add(sub)
    db.commit()
    return {"status": "subscribed"}


@router.delete("/subscribe", status_code=204)
def unsubscribe(
    data: UnsubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == data.endpoint,
        PushSubscription.user_id == current_user.id,
    ).delete()
    db.commit()


def send_push(subscription: PushSubscription, title: str, body: str, url: str = "/"):
    """Send a Web Push notification to a single subscription. Silently removes stale subscriptions."""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not set — skipping push")
        return
    try:
        from pywebpush import webpush

        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_EMAIL},
        )
    except Exception as exc:
        logger.warning(f"Push failed for subscription {subscription.id}: {exc}")
