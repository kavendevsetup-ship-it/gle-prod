from django.contrib import admin

from .models import MatchPurchase, PricingConfig


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
