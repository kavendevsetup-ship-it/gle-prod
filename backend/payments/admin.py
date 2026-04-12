from django.contrib import admin
from datetime import timedelta
from django.utils import timezone

from .models import AdminAccessOverride, MatchPurchase, PricingConfig, ProcessedPayment, UserSubscription


@admin.register(MatchPurchase)
class MatchPurchaseAdmin(admin.ModelAdmin):
	list_display = (
		"user",
		"match",
		"is_subscription",
		"subscription_end",
		"payment_id",
		"amount",
		"status",
		"created_at",
	)
	list_filter = ("is_subscription", "status", "created_at")
	search_fields = ("payment_id", "user__email", "match__match_name")
	autocomplete_fields = ("user", "match")


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
class UserSubscriptionAdmin(admin.ModelAdmin):
	list_display = (
		"user",
		"plan_type",
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


@admin.register(ProcessedPayment)
class ProcessedPaymentAdmin(admin.ModelAdmin):
	list_display = ("payment_id", "order_id", "user", "plan_type", "match", "created_at")
	list_filter = ("plan_type", "created_at")
	search_fields = ("payment_id", "order_id", "user__email")
	autocomplete_fields = ("user", "match")
	readonly_fields = ("created_at",)


@admin.register(AdminAccessOverride)
class AdminAccessOverrideAdmin(admin.ModelAdmin):
	list_display = (
		"user",
		"is_active",
		"plan_type",
		"current_status",
		"start_date",
		"end_date",
		"updated_at",
	)
	list_filter = ("is_active", "plan_type", "updated_at")
	search_fields = ("user__email", "user__username", "notes")
	autocomplete_fields = ("user",)
	readonly_fields = ("created_at", "updated_at", "current_status")
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
					"created_at",
					"updated_at",
				),
			},
		),
	)

	@admin.display(description="Current Status")
	def current_status(self, obj: AdminAccessOverride) -> str:
		now = timezone.now()
		if not obj.is_active:
			return "Revoked"
		if obj.end_date and obj.end_date > now:
			return "Active"
		return "Expired"

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
