from django.utils import timezone

from matches.models import Match

from .models import MatchPurchase


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


def has_premium_access(user, match: Match) -> bool:
    if not user or not user.is_authenticated:
        return False

    if has_active_subscription(user):
        return True

    return MatchPurchase.objects.filter(
        user=user,
        match=match,
        is_subscription=False,
        status=MatchPurchase.PurchaseStatus.SUCCESS,
    ).exists()
