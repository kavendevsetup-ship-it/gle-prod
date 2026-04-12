from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone
from django.utils.html import format_html
from datetime import timedelta

from payments.access import get_user_access_state, with_prefetched_user_access

from .models import UpdatePost, User


def _access_status_badge(label, tone):
	palette = {
		"active": ("#eaf8ee", "#1d7a36", "#b8e6c7"),
		"expired": ("#fff1f3", "#c21f4b", "#fecdd7"),
		"none": ("#f4f5f7", "#4b5563", "#d1d5db"),
	}
	bg, fg, border = palette[tone]
	return format_html(
		'<span style="display:inline-flex;align-items:center;border-radius:999px;padding:2px 10px;font-weight:600;font-size:11px;background:{};color:{};border:1px solid {};">{}</span>',
		bg,
		fg,
		border,
		label,
	)


class PremiumAccessStateFilter(admin.SimpleListFilter):
	title = "Premium Access"
	parameter_name = "premium_access"

	def lookups(self, request, model_admin):
		return (
			("active", "Premium Active"),
			("expired", "Expired"),
			("none", "No Access"),
		)

	def queryset(self, request, queryset):
		value = self.value()
		if value not in {"active", "expired", "none"}:
			return queryset

		prefetched_queryset = with_prefetched_user_access(queryset)
		matching_ids = []

		for user in prefetched_queryset:
			state = get_user_access_state(user)
			if state["has_access"]:
				status = "active"
			elif state["source"] in {"override", "subscription"}:
				status = "expired"
			else:
				status = "none"

			if status == value:
				matching_ids.append(user.id)

		return queryset.filter(id__in=matching_ids)


class PremiumPlanTypeFilter(admin.SimpleListFilter):
	title = "Plan Type"
	parameter_name = "premium_plan"

	def lookups(self, request, model_admin):
		return (
			("weekly", "Weekly"),
			("monthly", "Monthly"),
			("override", "Override"),
		)

	def queryset(self, request, queryset):
		value = self.value()
		if value not in {"weekly", "monthly", "override"}:
			return queryset

		prefetched_queryset = with_prefetched_user_access(queryset)
		matching_ids = []

		for user in prefetched_queryset:
			state = get_user_access_state(user)
			if state["source"] == "override":
				plan_key = "override"
			else:
				plan_key = state["plan_type"]

			if plan_key == value:
				matching_ids.append(user.id)

		return queryset.filter(id__in=matching_ids)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
	list_display = (
		"email",
		"username",
		"first_name",
		"last_name",
		"premium_status",
		"access_plan_type",
		"access_days_left",
		"access_expiry",
		"is_premium",
		"premium_expiry",
		"is_staff",
		"is_active",
	)
	list_filter = (
		PremiumAccessStateFilter,
		PremiumPlanTypeFilter,
		"is_premium",
		"is_staff",
		"is_active",
		"is_superuser",
	)
	list_editable = ("is_premium",)
	search_fields = ("email", "username", "first_name", "last_name")
	ordering = ("email",)
	actions = ("grant_30_days_premium", "revoke_premium_access")

	fieldsets = BaseUserAdmin.fieldsets + (
		("Premium Access", {"fields": ("is_premium", "premium_expiry")}),
		("Profile", {"fields": ("profile_photo",)}),
	)

	add_fieldsets = BaseUserAdmin.add_fieldsets + (
		("Premium Access", {"fields": ("is_premium", "premium_expiry")}),
		("Profile", {"fields": ("profile_photo",)}),
	)

	def get_queryset(self, request):
		queryset = super().get_queryset(request)
		return with_prefetched_user_access(queryset)

	@admin.display(description="Premium Status")
	def premium_status(self, obj):
		state = get_user_access_state(obj)
		if state["has_access"]:
			return _access_status_badge("Active", "active")
		if state["source"] in {"override", "subscription"}:
			return _access_status_badge("Expired", "expired")
		return _access_status_badge("No Access", "none")

	@admin.display(description="Plan Type")
	def access_plan_type(self, obj):
		state = get_user_access_state(obj)
		if state["source"] == "override":
			return "Override"
		if state["plan_type"] == "weekly":
			return "Weekly"
		if state["plan_type"] == "monthly":
			return "Monthly"
		return "-"

	@admin.display(description="Days Left")
	def access_days_left(self, obj):
		state = get_user_access_state(obj)
		return state["days_left"]

	@admin.display(description="Expiry Date")
	def access_expiry(self, obj):
		state = get_user_access_state(obj)
		expiry = state["expiry"]
		if expiry is None:
			return "-"
		return timezone.localtime(expiry).strftime("%d %b %Y, %I:%M %p")

	@admin.action(description="Grant 30 days premium")
	def grant_30_days_premium(self, request, queryset):
		expiry = timezone.now() + timedelta(days=30)
		updated = queryset.update(is_premium=True, premium_expiry=expiry)
		self.message_user(request, f"Premium granted for 30 days to {updated} user(s).")

	@admin.action(description="Revoke premium access")
	def revoke_premium_access(self, request, queryset):
		updated = queryset.update(is_premium=False, premium_expiry=None)
		self.message_user(request, f"Premium revoked for {updated} user(s).")


@admin.register(UpdatePost)
class UpdatePostAdmin(admin.ModelAdmin):
	list_display = ("title", "is_active", "created_at")
	list_filter = ("is_active", "created_at")
	search_fields = ("title", "body")
	readonly_fields = ("created_at", "updated_at")
	ordering = ("-created_at", "-id")
	fieldsets = (
		(
			None,
			{
				"fields": ("title", "body", "is_active", "created_at", "updated_at"),
			},
		),
	)
