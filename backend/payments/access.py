from django.utils import timezone

from matches.models import Match

from .models import MatchPurchase


def has_admin_premium_override(user) -> bool:
    if not user or not user.is_authenticated:
        return False

    if not getattr(user, "is_premium", False):
        return False

    premium_expiry = getattr(user, "premium_expiry", None)
    if premium_expiry is None:
        return False

    return premium_expiry > timezone.now()


def has_active_subscription(user) -> bool:
    if not user or not user.is_authenticated:
        return False

    now = timezone.now()
    return MatchPurchase.objects.filter(
        user=user,
        is_subscription=True,
        status=MatchPurchase.PurchaseStatus.SUCCESS,
        subscription_end__gt=now,
    ).exists()


def has_active_premium_access(user) -> bool:
    return has_admin_premium_override(user) or has_active_subscription(user)


def has_premium_access(user, match: Match) -> bool:
    if not user or not user.is_authenticated:
        return False

    if has_active_premium_access(user):
        return True

    return MatchPurchase.objects.filter(
        user=user,
        match=match,
        is_subscription=False,
        status=MatchPurchase.PurchaseStatus.SUCCESS,
    ).exists()
