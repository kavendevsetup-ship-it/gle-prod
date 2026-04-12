from django.contrib import admin
from datetime import timedelta
from django.db.models import OuterRef, Subquery
from django.utils import timezone
from django.utils.html import format_html

from .access import (
	get_user_access_state,
	has_payment_without_subscription_inconsistency,
	with_prefetched_related_user_access,
)
from .models import AdminAccessOverride, MatchPurchase, PricingConfig, ProcessedPayment, UserSubscription


def _status_badge(label, tone):
	palette = {
		"active": ("#eaf8ee", "#1d7a36", "#b8e6c7"),
		"expired": ("#fff1f3", "#c21f4b", "#fecdd7"),
		"none": ("#f4f5f7", "#4b5563", "#d1d5db"),
		"warning": ("#fff7ed", "#b45309", "#fed7aa"),
	}
	bg, fg, border = palette[tone]
	return format_html(
		'<span style="display:inline-flex;align-items:center;border-radius:999px;padding:2px 10px;font-weight:600;font-size:11px;background:{};color:{};border:1px solid {};">{}</span>',
		bg,
		fg,
		border,
		label,
	)


def _format_plan_label(plan_type, source):
	if source == "override":
		return "Override"
	if plan_type == "weekly":
		return "Weekly"
	if plan_type == "monthly":
		return "Monthly"
	return "-"


class AccessLinkedAdminMixin:
	user_field = "user"

	def get_queryset(self, request):
		queryset = super().get_queryset(request)
		return with_prefetched_related_user_access(queryset, user_field=self.user_field)

	def _linked_state(self, obj):
		user = getattr(obj, self.user_field)
		return get_user_access_state(user)

	@admin.display(description="User Email")
	def user_email(self, obj):
		return getattr(obj, self.user_field).email

	@admin.display(description="Linked Access")
	def linked_access_state(self, obj):
		state = self._linked_state(obj)
		if state["has_access"]:
			return _status_badge("Active", "active")
		if state["source"] in {"override", "subscription"}:
			return _status_badge("Expired", "expired")
		return _status_badge("No Access", "none")

	@admin.display(description="Linked Source")
	def linked_access_source(self, obj):
		state = self._linked_state(obj)
		if state["source"] == "none":
			return "-"
		return state["source"].title()

	@admin.display(description="Days Left")
	def linked_days_left(self, obj):
		state = self._linked_state(obj)
		return state["days_left"]

	@admin.display(description="Inconsistency")
	def inconsistency_flag(self, obj):
		user = getattr(obj, self.user_field)
		if has_payment_without_subscription_inconsistency(user):
			return _status_badge("Payment Without Subscription", "warning")
		return "-"


@admin.register(MatchPurchase)
class MatchPurchaseAdmin(AccessLinkedAdminMixin, admin.ModelAdmin):
	list_display = (
		"user_email",
		"match",
		"is_subscription",
		"plan_type_display",
		"record_status",
		"linked_access_state",
		"linked_access_source",
		"linked_days_left",
		"inconsistency_flag",
		"subscription_end",
		"payment_id",
		"amount",
		"status",
		"created_at",
	)
	list_filter = ("is_subscription", "status", "created_at")
	search_fields = ("payment_id", "user__email", "match__match_name")
	autocomplete_fields = ("user", "match")
	list_select_related = ("user", "match")

	def get_queryset(self, request):
		queryset = super().get_queryset(request).select_related("match")
		return queryset.annotate(
			processed_plan_type=Subquery(
				ProcessedPayment.objects.filter(payment_id=OuterRef("payment_id"))
				.values("plan_type")[:1]
			)
		)

	@admin.display(description="Plan Type")
	def plan_type_display(self, obj):
		if not obj.is_subscription:
			return "Match"

		processed_plan = getattr(obj, "processed_plan_type", None)
		if processed_plan == "weekly":
			return "Weekly"
		if processed_plan in {"subscription", "monthly"}:
			return "Monthly"
		return "Subscription"

	@admin.display(description="Status")
	def record_status(self, obj):
		now = timezone.now()
		if obj.status != MatchPurchase.PurchaseStatus.SUCCESS:
			return obj.status.title()

		if obj.is_subscription:
			if obj.subscription_end and obj.subscription_end > now:
				return _status_badge("Valid", "active")
			return _status_badge("Expired", "expired")

		return _status_badge("Valid", "active")


@admin.register(PricingConfig)
class PricingConfigAdmin(admin.ModelAdmin):
	list_display = (
		"weekly_price",
		"weekly_original_price",
		"monthly_price",
		"monthly_original_price",
		"enable_weekly",
		"enable_monthly",
		"enable_match",
		"weekly_offer_active",
		"monthly_offer_active",
		"is_active",
		"created_at",
	)
	list_filter = (
		"is_active",
		"enable_weekly",
		"enable_monthly",
		"enable_match",
		"weekly_offer_active",
		"monthly_offer_active",
		"created_at",
	)
	search_fields = (
		"match_price",
		"weekly_price",
		"weekly_original_price",
		"monthly_price",
		"monthly_original_price",
	)
	readonly_fields = ("created_at",)
	ordering = ("-created_at", "-id")

	fieldsets = (
		(
			"Plan Prices (Paise)",
			{
				"fields": (
					"match_price",
					("weekly_original_price", "weekly_price"),
					("monthly_original_price", "monthly_price"),
				),
			},
		),
		(
			"Plan Availability",
			{
				"fields": (
					("enable_weekly", "enable_monthly", "enable_match"),
				),
			},
		),
		(
			"Offer Toggles",
			{
				"fields": (
					("weekly_offer_active", "monthly_offer_active"),
				),
			},
		),
		(
			"Activation",
			{
				"fields": (
					"is_active",
					"created_at",
				),
			},
		),
	)


@admin.register(UserSubscription)
class UserSubscriptionAdmin(AccessLinkedAdminMixin, admin.ModelAdmin):
	list_display = (
		"user_email",
		"plan_type",
		"subscription_status",
		"linked_access_state",
		"linked_access_source",
		"linked_days_left",
		"inconsistency_flag",
		"start_date",
		"end_date",
		"is_active",
		"last_payment_id",
		"updated_at",
	)
	list_filter = ("plan_type", "is_active", "updated_at")
	search_fields = ("user__email", "last_payment_id")
	autocomplete_fields = ("user",)
	readonly_fields = ("created_at", "updated_at")
	list_select_related = ("user",)

	@admin.display(description="Subscription Status")
	def subscription_status(self, obj):
		now = timezone.now()
		if obj.is_active and obj.end_date > now:
			return _status_badge("Valid", "active")
		return _status_badge("Expired", "expired")


@admin.register(ProcessedPayment)
class ProcessedPaymentAdmin(AccessLinkedAdminMixin, admin.ModelAdmin):
	list_display = (
		"payment_id",
		"order_id",
		"user_email",
		"plan_type",
		"payment_status",
		"linked_access_state",
		"linked_access_source",
		"inconsistency_flag",
		"match",
		"created_at",
	)
	list_filter = ("plan_type", "created_at")
	search_fields = ("payment_id", "order_id", "user__email")
	autocomplete_fields = ("user", "match")
	readonly_fields = ("created_at",)
	list_select_related = ("user", "match")

	@admin.display(description="Status")
	def payment_status(self, obj):
		state = self._linked_state(obj)
		if obj.plan_type == "match":
			return _status_badge("Match Payment", "none")
		if state["has_access"]:
			return _status_badge("Valid", "active")
		if state["source"] in {"override", "subscription"}:
			return _status_badge("Expired", "expired")
		return _status_badge("No Access", "none")


@admin.register(AdminAccessOverride)
class AdminAccessOverrideAdmin(admin.ModelAdmin):
	list_display = (
		"user",
		"is_active",
		"plan_type",
		"current_status",
		"days_left",
		"overriding_plan",
		"start_date",
		"end_date",
		"updated_at",
	)
	list_filter = ("is_active", "plan_type", "updated_at")
	search_fields = ("user__email", "user__username", "notes")
	autocomplete_fields = ("user",)
	readonly_fields = ("created_at", "updated_at", "current_status", "days_left", "overriding_plan")
	actions = ("grant_weekly_access", "grant_monthly_access", "revoke_access")
	ordering = ("-updated_at", "-id")

	fieldsets = (
		(
			"Override",
			{
				"fields": (
					"user",
					"is_active",
					"plan_type",
					"start_date",
					"end_date",
					"notes",
					"current_status",
					"days_left",
					"overriding_plan",
					"created_at",
					"updated_at",
				),
			},
		),
	)

	def get_queryset(self, request):
		now = timezone.now()
		# Safety correction: any expired active override is automatically marked inactive.
		AdminAccessOverride.objects.filter(
			is_active=True,
			end_date__isnull=False,
			end_date__lte=now,
		).update(is_active=False, updated_at=now)

		queryset = super().get_queryset(request)
		return with_prefetched_related_user_access(queryset, user_field="user")

	@admin.display(description="Current Status")
	def current_status(self, obj: AdminAccessOverride) -> str:
		state = get_user_access_state(obj.user)
		if state["source"] == "override" and state["has_access"]:
			return _status_badge("Active", "active")
		if state["source"] == "override":
			if obj.is_active:
				return _status_badge("Expired", "expired")
			return _status_badge("Revoked", "none")
		if obj.is_active and obj.end_date and obj.end_date > timezone.now():
			return _status_badge("Active", "active")
		return _status_badge("Expired", "expired")

	@admin.display(description="Days Left")
	def days_left(self, obj: AdminAccessOverride):
		state = get_user_access_state(obj.user)
		if state["source"] == "override":
			return state["days_left"]
		return 0

	@admin.display(description="Overriding Plan")
	def overriding_plan(self, obj: AdminAccessOverride):
		now = timezone.now()
		try:
			subscription = obj.user.active_subscription
		except UserSubscription.DoesNotExist:
			subscription = None

		if subscription and subscription.is_active and subscription.end_date > now:
			return _format_plan_label(
				"weekly" if subscription.plan_type == UserSubscription.PlanType.WEEKLY else "monthly",
				source="subscription",
			)

		if obj.user.is_premium and obj.user.premium_expiry and obj.user.premium_expiry > now:
			return "Legacy Premium"

		return "No Active Plan"

	def _grant_plan(self, queryset, *, plan_type: str, duration_days: int):
		now = timezone.now()
		updated_count = 0

		for user_id in queryset.values_list("user_id", flat=True).distinct():
			override = (
				AdminAccessOverride.objects.filter(user_id=user_id)
				.order_by("-updated_at", "-id")
				.first()
			)
			if override is None:
				continue

			extension_base = now
			if override.is_active and override.end_date and override.end_date > now:
				extension_base = override.end_date

			override.is_active = True
			override.plan_type = plan_type
			if override.start_date is None:
				override.start_date = now
			override.end_date = extension_base + timedelta(days=duration_days)
			override.save()
			updated_count += 1

		return updated_count

	@admin.action(description="Grant Weekly Access")
	def grant_weekly_access(self, request, queryset):
		updated_count = self._grant_plan(
			queryset,
			plan_type=AdminAccessOverride.PlanType.WEEKLY,
			duration_days=7,
		)
		self.message_user(request, f"Granted weekly access to {updated_count} user(s).")

	@admin.action(description="Grant Monthly Access")
	def grant_monthly_access(self, request, queryset):
		updated_count = self._grant_plan(
			queryset,
			plan_type=AdminAccessOverride.PlanType.MONTHLY,
			duration_days=30,
		)
		self.message_user(request, f"Granted monthly access to {updated_count} user(s).")

	@admin.action(description="Revoke Access")
	def revoke_access(self, request, queryset):
		now = timezone.now()
		updated_count = 0

		for user_id in queryset.values_list("user_id", flat=True).distinct():
			override = (
				AdminAccessOverride.objects.filter(user_id=user_id)
				.order_by("-updated_at", "-id")
				.first()
			)
			if override is None:
				continue

			override.is_active = False
			if override.start_date is None:
				override.start_date = now
			override.end_date = now
			override.save()
			updated_count += 1

		self.message_user(request, f"Revoked override access for {updated_count} user(s).")
