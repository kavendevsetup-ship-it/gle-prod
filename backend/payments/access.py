from django.db.models import Prefetch
from django.utils import timezone

from matches.models import Match

from .models import AdminAccessOverride, MatchPurchase, ProcessedPayment, UserSubscription


def _normalize_plan_type(raw_plan_type):
    if raw_plan_type == AdminAccessOverride.PlanType.WEEKLY:
        return "weekly"

    if raw_plan_type in {AdminAccessOverride.PlanType.MONTHLY, UserSubscription.PlanType.MONTHLY, "monthly", "subscription"}:
        return "monthly"

    if raw_plan_type in {UserSubscription.PlanType.WEEKLY, "weekly"}:
        return "weekly"

    return None


def _build_access_state(*, now, has_access, source, plan_type, expiry):
    days_left = 0
    if has_access and expiry is not None:
        days_left = max((expiry - now).days, 0)

    return {
        "has_access": bool(has_access),
        "source": source,
        "plan_type": plan_type,
        "expiry": expiry,
        "days_left": days_left,
    }


def _get_prefetched_overrides(user):
    overrides = getattr(user, "_prefetched_admin_access_overrides", None)
    if overrides is not None:
        return overrides

    cache = getattr(user, "_prefetched_objects_cache", {})
    return cache.get("admin_access_overrides")


def _get_latest_admin_access_override(user):
    if not user:
        return None

    overrides = _get_prefetched_overrides(user)
    if overrides is not None:
        return overrides[0] if overrides else None

    return (
        AdminAccessOverride.objects.filter(user=user)
        .order_by("-updated_at", "-id")
        .first()
    )


def _get_subscription_record(user):
    if not user:
        return None

    try:
        return user.active_subscription
    except UserSubscription.DoesNotExist:
        return None
    except AttributeError:
        return (
            UserSubscription.objects.filter(user=user)
            .only("id", "plan_type", "start_date", "end_date", "is_active", "last_payment_id")
            .first()
        )


def _get_prefetched_subscription_purchases(user):
    purchases = getattr(user, "_prefetched_subscription_purchases", None)
    if purchases is not None:
        return purchases

    cache = getattr(user, "_prefetched_objects_cache", {})
    return cache.get("match_purchases")


def _get_latest_subscription_purchase(user):
    purchases = _get_prefetched_subscription_purchases(user)
    if purchases is not None:
        return purchases[0] if purchases else None

    return (
        MatchPurchase.objects.filter(
            user=user,
            is_subscription=True,
            status=MatchPurchase.PurchaseStatus.SUCCESS,
        )
        .only("id", "subscription_end", "payment_id")
        .order_by("-subscription_end", "-id")
        .first()
    )


def _get_active_subscription_purchase(user, now):
    purchases = _get_prefetched_subscription_purchases(user)
    if purchases is not None:
        for purchase in purchases:
            if purchase.subscription_end and purchase.subscription_end > now:
                return purchase
        return None

    return (
        MatchPurchase.objects.filter(
            user=user,
            is_subscription=True,
            status=MatchPurchase.PurchaseStatus.SUCCESS,
            subscription_end__gt=now,
        )
        .only("id", "subscription_end", "payment_id")
        .order_by("-subscription_end", "-id")
        .first()
    )


def _get_prefetched_processed_payments(user):
    payments = getattr(user, "_prefetched_processed_payments", None)
    if payments is not None:
        return payments

    cache = getattr(user, "_prefetched_objects_cache", {})
    return cache.get("processed_payments")


def _infer_plan_type_from_payment(user, payment_id):
    if not payment_id:
        return None

    processed_payments = _get_prefetched_processed_payments(user)
    if processed_payments is not None:
        for payment in processed_payments:
            if payment.payment_id == payment_id:
                return _normalize_plan_type(payment.plan_type)

    plan_type = (
        ProcessedPayment.objects.filter(user=user, payment_id=payment_id)
        .values_list("plan_type", flat=True)
        .first()
    )
    return _normalize_plan_type(plan_type)


def _has_successful_subscription_payment(user):
    purchases = _get_prefetched_subscription_purchases(user)
    if purchases is not None:
        return any(True for _ in purchases)

    return MatchPurchase.objects.filter(
        user=user,
        is_subscription=True,
        status=MatchPurchase.PurchaseStatus.SUCCESS,
    ).exists()


def _has_subscription_record(user):
    return _get_subscription_record(user) is not None


def get_user_access_state(user):
    """Single source of truth for effective user access state."""
    if not user or not getattr(user, "is_authenticated", False):
        return _build_access_state(
            now=timezone.now(),
            has_access=False,
            source="none",
            plan_type=None,
            expiry=None,
        )

    now = timezone.now()
    override = _get_latest_admin_access_override(user)

    if (
        override is not None
        and override.is_active
        and override.end_date is not None
        and override.end_date <= now
    ):
        # Safety correction: keep override records in sync when active rows expire.
        AdminAccessOverride.objects.filter(pk=override.pk, is_active=True).update(
            is_active=False,
            updated_at=now,
        )
        override.is_active = False

    if override is not None:
        override_plan = _normalize_plan_type(override.plan_type)
        if not override.is_active:
            return _build_access_state(
                now=now,
                has_access=False,
                source="override",
                plan_type=override_plan,
                expiry=override.end_date,
            )

        if override.end_date is None or override.end_date > now:
            return _build_access_state(
                now=now,
                has_access=True,
                source="override",
                plan_type=override_plan,
                expiry=override.end_date,
            )

    subscription = _get_subscription_record(user)
    latest_subscription_expiry = None
    latest_subscription_plan = None

    if subscription is not None:
        latest_subscription_expiry = subscription.end_date
        latest_subscription_plan = _normalize_plan_type(subscription.plan_type)
        if subscription.is_active and subscription.end_date and subscription.end_date > now:
            return _build_access_state(
                now=now,
                has_access=True,
                source="subscription",
                plan_type=latest_subscription_plan,
                expiry=subscription.end_date,
            )

    active_purchase = _get_active_subscription_purchase(user, now)
    if active_purchase is not None and active_purchase.subscription_end:
        plan_from_payment = _infer_plan_type_from_payment(user, active_purchase.payment_id)
        return _build_access_state(
            now=now,
            has_access=True,
            source="subscription",
            plan_type=plan_from_payment,
            expiry=active_purchase.subscription_end,
        )

    latest_purchase = _get_latest_subscription_purchase(user)
    if latest_purchase is not None:
        purchase_expiry = latest_purchase.subscription_end
        if purchase_expiry and (latest_subscription_expiry is None or purchase_expiry > latest_subscription_expiry):
            latest_subscription_expiry = purchase_expiry
            latest_subscription_plan = _infer_plan_type_from_payment(user, latest_purchase.payment_id)

    legacy_premium_expiry = getattr(user, "premium_expiry", None)
    if getattr(user, "is_premium", False) and legacy_premium_expiry and legacy_premium_expiry > now:
        return _build_access_state(
            now=now,
            has_access=True,
            source="subscription",
            plan_type=latest_subscription_plan,
            expiry=legacy_premium_expiry,
        )

    if latest_subscription_expiry is not None:
        return _build_access_state(
            now=now,
            has_access=False,
            source="subscription",
            plan_type=latest_subscription_plan,
            expiry=latest_subscription_expiry,
        )

    return _build_access_state(
        now=now,
        has_access=False,
        source="none",
        plan_type=None,
        expiry=None,
    )


def has_payment_without_subscription_inconsistency(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False

    return _has_successful_subscription_payment(user) and not _has_subscription_record(user)


def with_prefetched_user_access(queryset):
    """Attach access-related relations for batched state computation on User querysets."""
    return queryset.select_related("active_subscription").prefetch_related(
        Prefetch(
            "admin_access_overrides",
            queryset=AdminAccessOverride.objects.only(
                "id",
                "user_id",
                "is_active",
                "plan_type",
                "end_date",
                "updated_at",
            ).order_by("-updated_at", "-id"),
            to_attr="_prefetched_admin_access_overrides",
        ),
        Prefetch(
            "match_purchases",
            queryset=MatchPurchase.objects.filter(
                is_subscription=True,
                status=MatchPurchase.PurchaseStatus.SUCCESS,
            )
            .only("id", "user_id", "payment_id", "subscription_end")
            .order_by("-subscription_end", "-id"),
            to_attr="_prefetched_subscription_purchases",
        ),
        Prefetch(
            "processed_payments",
            queryset=ProcessedPayment.objects.filter(
                plan_type__in=("weekly", "subscription", "monthly"),
            )
            .only("id", "user_id", "payment_id", "plan_type", "created_at")
            .order_by("-created_at", "-id"),
            to_attr="_prefetched_processed_payments",
        ),
    )


def with_prefetched_related_user_access(queryset, user_field="user"):
    """Attach access-related relations when the queryset has a FK to User."""
    return queryset.select_related(user_field, f"{user_field}__active_subscription").prefetch_related(
        Prefetch(
            f"{user_field}__admin_access_overrides",
            queryset=AdminAccessOverride.objects.only(
                "id",
                "user_id",
                "is_active",
                "plan_type",
                "end_date",
                "updated_at",
            ).order_by("-updated_at", "-id"),
            to_attr="_prefetched_admin_access_overrides",
        ),
        Prefetch(
            f"{user_field}__match_purchases",
            queryset=MatchPurchase.objects.filter(
                is_subscription=True,
                status=MatchPurchase.PurchaseStatus.SUCCESS,
            )
            .only("id", "user_id", "payment_id", "subscription_end")
            .order_by("-subscription_end", "-id"),
            to_attr="_prefetched_subscription_purchases",
        ),
        Prefetch(
            f"{user_field}__processed_payments",
            queryset=ProcessedPayment.objects.filter(
                plan_type__in=("weekly", "subscription", "monthly"),
            )
            .only("id", "user_id", "payment_id", "plan_type", "created_at")
            .order_by("-created_at", "-id"),
            to_attr="_prefetched_processed_payments",
        ),
    )


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
    state = get_user_access_state(user)
    return (
        state["has_access"]
        and state["source"] == "subscription"
        and state["plan_type"] in {"weekly", "monthly"}
    )


def get_active_subscription_end(user):
    state = get_user_access_state(user)
    if (
        state["has_access"]
        and state["source"] == "subscription"
        and state["plan_type"] in {"weekly", "monthly"}
    ):
        return state["expiry"]

    return None


def has_active_premium_access(user) -> bool:
    state = get_user_access_state(user)
    return state["has_access"]


def has_premium_access(user, match: Match) -> bool:
    if not user or not user.is_authenticated:
        return False

    state = get_user_access_state(user)
    if state["source"] == "override" and not state["has_access"]:
        return False

    if state["has_access"]:
        return True

    return MatchPurchase.objects.filter(
        user=user,
        match=match,
        is_subscription=False,
        status=MatchPurchase.PurchaseStatus.SUCCESS,
    ).exists()
