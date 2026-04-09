import os
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from botocore.exceptions import BotoCoreError, ClientError
from django import forms
from django.contrib import admin, messages
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponseRedirect
from django.template.response import TemplateResponse
from django.utils.html import format_html
from django.utils.text import Truncator
from django.utils import timezone
from django.urls import path, reverse
from zoneinfo import ZoneInfo

from payments.models import MatchPurchase

from .models import FreeContent, Match, PremiumContent


IST = ZoneInfo("Asia/Kolkata")


def _format_storage_error(exc: Exception) -> str:
	if isinstance(exc, ClientError):
		error = exc.response.get("Error", {})
		code = error.get("Code", "ClientError")
		message = error.get("Message", "Storage request failed")
		return f"Storage upload failed ({code}): {message}"

	return f"Storage upload failed ({exc.__class__.__name__})."


def _resolved_free_type(obj: FreeContent) -> str:
	content_type = (obj.content_type or obj.type or FreeContent.ContentType.PDF).lower()
	if content_type in {FreeContent.ContentType.PDF, FreeContent.ContentType.IMAGE, FreeContent.ContentType.TEXT}:
		return content_type
	return FreeContent.ContentType.PDF


def _text_preview_html(title: str, body: str) -> str:
	clean_title = (title or "").strip() or "Analysis"
	clean_body = (body or "").strip()
	if not clean_body:
		return format_html(
			'<div class="content-preview-empty">No text content available yet.</div>'
		)

	return format_html(
		'<div class="content-preview-text">'
		'<p class="content-preview-title">{}</p>'
		'<div class="content-preview-body" style="white-space:pre-wrap;">{}</div>'
		"</div>",
		clean_title,
		Truncator(clean_body).chars(500),
	)


def _render_free_preview(obj: FreeContent | None) -> str:
	if not obj:
		return format_html('<div class="content-preview-empty">Live preview appears here.</div>')

	content_type = _resolved_free_type(obj)
	if content_type == FreeContent.ContentType.TEXT:
		return _text_preview_html(obj.text_title or "", obj.text_body or "")

	if not obj.file:
		return format_html('<div class="content-preview-empty">No file uploaded yet.</div>')

	if content_type == FreeContent.ContentType.IMAGE:
		return format_html(
			'<img src="{}" alt="Free content preview" style="max-height:140px; border-radius:10px;" />',
			obj.file.url,
		)

	filename = os.path.basename(obj.file.name)
	return format_html(
		'<div class="content-preview-file">📄 <strong>{}</strong><br/><span>PDF report ready for viewing.</span></div>',
		filename,
	)


def _render_premium_preview(obj: PremiumContent | None) -> str:
	if not obj:
		return format_html('<div class="content-preview-empty">Live preview appears here.</div>')

	content_type = (obj.content_type or PremiumContent.ContentType.TEXT).lower()

	if content_type == PremiumContent.ContentType.TEXT:
		return _text_preview_html(obj.title or "", obj.description or "")

	if content_type == PremiumContent.ContentType.IMAGE:
		if not obj.image:
			return format_html('<div class="content-preview-empty">No image uploaded yet.</div>')
		return format_html(
			'<img src="{}" alt="Premium image preview" style="max-height:140px; border-radius:10px;" />',
			obj.image.url,
		)

	if not obj.video:
		return format_html('<div class="content-preview-empty">No video uploaded yet.</div>')

	return format_html(
		'<video src="{}" controls controlsList="nodownload" style="max-height:180px; border-radius:10px;"></video>',
		obj.video.url,
	)


class FreeContentAdminForm(forms.ModelForm):
	class Meta:
		model = FreeContent
		fields = "__all__"

	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.fields["text_title"].label = "Analysis Title"
		self.fields["text_body"].label = "Analysis Content"
		self.fields["file"].label = "Upload PDF Report"
		self.fields["text_body"].help_text = "Enter structured analysis (captain, teams, strategy)."
		self.fields["file"].help_text = "Upload match report PDF or analysis image based on content type."
		self.fields["text_body"].widget.attrs.update({"rows": 8, "placeholder": "Write clean, structured analysis..."})

	def clean(self):
		cleaned_data = super().clean()
		content_type = cleaned_data.get("content_type") or self.instance.content_type or FreeContent.ContentType.PDF
		file_value = cleaned_data.get("file") or getattr(self.instance, "file", None)
		text_body = (cleaned_data.get("text_body") or "").strip()

		if content_type == FreeContent.ContentType.TEXT and not text_body:
			self.add_error("text_body", "Please enter analysis content for text type.")

		if content_type in {FreeContent.ContentType.PDF, FreeContent.ContentType.IMAGE} and not file_value:
			label = "PDF report" if content_type == FreeContent.ContentType.PDF else "image analysis"
			self.add_error("file", f"Please upload a {label} file.")

		return cleaned_data


class PremiumContentAdminForm(forms.ModelForm):
	class Meta:
		model = PremiumContent
		fields = "__all__"

	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.fields["title"].label = "Analysis Title"
		self.fields["description"].label = "Analysis Content"
		self.fields["image"].label = "Upload Image Analysis"
		self.fields["video"].label = "Upload Video Analysis"
		self.fields["description"].help_text = "Enter structured analysis (captain, teams, strategy)."
		self.fields["image"].help_text = "Upload GL team screenshots or analysis images."
		self.fields["video"].help_text = "Upload analysis video (non-downloadable)."
		self.fields["description"].widget.attrs.update({"rows": 8, "placeholder": "Write clean, structured analysis..."})

	def clean(self):
		cleaned_data = super().clean()
		content_type = cleaned_data.get("content_type") or self.instance.content_type or PremiumContent.ContentType.TEXT

		title = (cleaned_data.get("title") or "").strip()
		description = (cleaned_data.get("description") or "").strip()
		image_value = cleaned_data.get("image") or getattr(self.instance, "image", None)
		video_value = cleaned_data.get("video") or getattr(self.instance, "video", None)

		if content_type == PremiumContent.ContentType.TEXT:
			if not title:
				self.add_error("title", "Please enter an analysis title for text content.")
			if not description:
				self.add_error("description", "Please enter analysis content for text type.")

		if content_type == PremiumContent.ContentType.IMAGE and not image_value:
			self.add_error("image", "Please upload an image analysis file.")

		if content_type == PremiumContent.ContentType.VIDEO and not video_value:
			self.add_error("video", "Please upload a video analysis file.")

		return cleaned_data


class FreeContentInline(admin.StackedInline):
	model = FreeContent
	form = FreeContentAdminForm
	extra = 1
	readonly_fields = ("live_preview", "created_at")
	fieldsets = (
		(
			"Basic Info",
			{
				"fields": ("content_type",),
			},
		),
		(
			"Content",
			{
				"fields": ("text_title", "text_body", "file"),
				"description": "Fields are shown automatically based on selected content type.",
			},
		),
		(
			"Preview",
			{
				"fields": ("live_preview", "created_at"),
			},
		),
	)

	@admin.display(description="Live Preview")
	def live_preview(self, obj: FreeContent | None):
		return _render_free_preview(obj)

	def get_queryset(self, request):
		return super().get_queryset(request).select_related("match")

	class Media:
		js = ("matches/js/admin_content_ux.js",)
		css = {"all": ("matches/css/admin_content_ux.css",)}


class PremiumContentInline(admin.StackedInline):
	model = PremiumContent
	form = PremiumContentAdminForm
	extra = 1
	readonly_fields = ("live_preview", "created_at")
	fieldsets = (
		(
			"Basic Info",
			{
				"fields": ("content_type",),
			},
		),
		(
			"Content",
			{
				"fields": ("title", "description", "image", "video"),
				"description": "Fields are shown automatically based on selected content type.",
			},
		),
		(
			"Preview",
			{
				"fields": ("live_preview", "created_at"),
			},
		),
	)

	@admin.display(description="Live Preview")
	def live_preview(self, obj: PremiumContent | None):
		return _render_premium_preview(obj)

	def get_queryset(self, request):
		return super().get_queryset(request).select_related("match")

	class Media:
		js = ("matches/js/admin_content_ux.js",)
		css = {"all": ("matches/css/admin_content_ux.css",)}


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
	list_display = ("match_name", "team_1", "team_2", "match_date_ist", "created_at_ist")
	list_filter = ("match_date",)
	search_fields = ("match_name", "team_1", "team_2")
	ordering = ("-match_date",)
	date_hierarchy = "match_date"
	inlines = [FreeContentInline, PremiumContentInline]

	fieldsets = (
		(
			"Match Details",
			{
				"fields": (
					"match_name",
					"team_1",
					"team_2",
					"match_date",
				)
			},
		),
	)

	@staticmethod
	def _format_ist(value):
		if value is None:
			return "-"
		return timezone.localtime(value, IST).strftime("%d-%m-%Y %I:%M %p IST")

	@admin.display(description="Match Date (IST)", ordering="match_date")
	def match_date_ist(self, obj: Match):
		return self._format_ist(obj.match_date)

	@admin.display(description="Created At (IST)", ordering="created_at")
	def created_at_ist(self, obj: Match):
		return self._format_ist(obj.created_at)

	def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
		try:
			with transaction.atomic():
				return super().changeform_view(request, object_id, form_url, extra_context)
		except (ClientError, BotoCoreError) as exc:
			self.message_user(
				request,
				_format_storage_error(exc),
				level=messages.ERROR,
			)
			return HttpResponseRedirect(request.path)

	class Media:
		js = ("matches/js/admin_content_ux.js",)
		css = {"all": ("matches/css/admin_content_ux.css",)}


@admin.register(FreeContent)
class FreeContentAdmin(admin.ModelAdmin):
	form = FreeContentAdminForm
	list_display = ("match", "content_type", "created_at", "preview_snippet")
	list_filter = ("content_type", "match", "created_at")
	search_fields = ("match__match_name", "text_title")
	list_select_related = ("match",)
	autocomplete_fields = ("match",)
	readonly_fields = ("live_preview", "created_at")
	actions = ("delete_selected", "mark_selected_inactive")
	fieldsets = (
		(
			"Basic Info",
			{
				"fields": ("match", "content_type"),
			},
		),
		(
			"Content",
			{
				"fields": ("text_title", "text_body", "file"),
				"description": "Fields are shown automatically based on selected content type.",
			},
		),
		(
			"Preview",
			{
				"fields": ("live_preview", "created_at"),
			},
		),
	)

	def get_queryset(self, request):
		return super().get_queryset(request).select_related("match")

	@admin.display(boolean=True, description="Has File")
	def has_file(self, obj: FreeContent):
		return bool(obj.file)

	@admin.display(boolean=True, description="Has Text")
	def has_text(self, obj: FreeContent):
		return bool((obj.text_title or "").strip() or (obj.text_body or "").strip())

	@admin.display(description="Preview Snippet")
	def preview_snippet(self, obj: FreeContent):
		content_type = _resolved_free_type(obj)
		if content_type == FreeContent.ContentType.TEXT:
			preview = Truncator((obj.text_body or "").strip()).chars(90)
			return preview or "Text"
		if not obj.file:
			return "No file"
		if content_type == FreeContent.ContentType.IMAGE:
			return "Image uploaded"
		return f"PDF: {os.path.basename(obj.file.name)}"

	@admin.display(description="Live Preview")
	def live_preview(self, obj: FreeContent | None):
		return _render_free_preview(obj)

	@admin.action(description="Mark selected as inactive (future use)")
	def mark_selected_inactive(self, request, queryset):
		count = queryset.count()
		self.message_user(
			request,
			f"{count} item(s) selected. Inactive flag is not configured yet, so no records were changed.",
			level=messages.INFO,
		)

	class Media:
		js = ("matches/js/admin_content_ux.js",)
		css = {"all": ("matches/css/admin_content_ux.css",)}


@admin.register(PremiumContent)
class PremiumContentAdmin(admin.ModelAdmin):
	form = PremiumContentAdminForm
	list_display = ("match", "content_type", "created_at", "preview_snippet")
	list_filter = ("content_type", "match", "created_at")
	search_fields = ("match__match_name", "title")
	list_select_related = ("match",)
	autocomplete_fields = ("match",)
	readonly_fields = ("live_preview", "created_at")
	actions = ("delete_selected", "mark_selected_inactive")
	fieldsets = (
		(
			"Basic Info",
			{
				"fields": ("match", "content_type"),
			},
		),
		(
			"Content",
			{
				"fields": ("title", "description", "image", "video"),
				"description": "Fields are shown automatically based on selected content type.",
			},
		),
		(
			"Preview",
			{
				"fields": ("live_preview", "created_at"),
			},
		),
	)

	def get_queryset(self, request):
		return super().get_queryset(request).select_related("match")

	@admin.display(boolean=True, description="Has Image")
	def has_image(self, obj: PremiumContent):
		return bool(obj.image)

	@admin.display(boolean=True, description="Has Video")
	def has_video(self, obj: PremiumContent):
		return bool(obj.video)

	@admin.display(description="Preview Snippet")
	def preview_snippet(self, obj: PremiumContent):
		content_type = (obj.content_type or PremiumContent.ContentType.TEXT).lower()
		if content_type == PremiumContent.ContentType.TEXT:
			preview = Truncator((obj.description or "").strip()).chars(90)
			return preview or (obj.title or "Text")
		if content_type == PremiumContent.ContentType.IMAGE:
			return "Image uploaded" if obj.image else "No image"
		return "Video uploaded" if obj.video else "No video"

	@admin.display(description="Live Preview")
	def live_preview(self, obj: PremiumContent | None):
		return _render_premium_preview(obj)

	@admin.action(description="Mark selected as inactive (future use)")
	def mark_selected_inactive(self, request, queryset):
		count = queryset.count()
		self.message_user(
			request,
			f"{count} item(s) selected. Inactive flag is not configured yet, so no records were changed.",
			level=messages.INFO,
		)

	class Media:
		js = ("matches/js/admin_content_ux.js",)
		css = {"all": ("matches/css/admin_content_ux.css",)}


def _parse_dashboard_dates(request):
	today = timezone.localdate()
	preset = (request.GET.get("range") or "7").strip()
	start_raw = (request.GET.get("start") or "").strip()
	end_raw = (request.GET.get("end") or "").strip()

	start_date: date
	end_date: date
	range_key = "7"

	if start_raw and end_raw:
		try:
			start_date = date.fromisoformat(start_raw)
			end_date = date.fromisoformat(end_raw)
			range_key = "custom"
		except ValueError:
			start_date = today - timedelta(days=6)
			end_date = today
	else:
		range_days = 30 if preset == "30" else 7
		start_date = today - timedelta(days=range_days - 1)
		end_date = today
		range_key = "30" if range_days == 30 else "7"

	if start_date > end_date:
		start_date, end_date = end_date, start_date

	# Keep custom ranges bounded so dashboard queries stay fast.
	max_days = 366
	if (end_date - start_date).days + 1 > max_days:
		start_date = end_date - timedelta(days=max_days - 1)
		range_key = "custom"

	return start_date, end_date, range_key


def _build_chart_points(start_date, end_date, value_map):
	points = []
	current = start_date
	while current <= end_date:
		value = value_map.get(current, 0) or 0
		points.append(
			{
				"label": current.strftime("%d %b"),
				"value": float(value),
			}
		)
		current += timedelta(days=1)

	max_value = max((point["value"] for point in points), default=0)
	for point in points:
		point["height"] = round((point["value"] / max_value) * 100, 2) if max_value > 0 else 0

	return points


def _admin_dashboard_view(request):
	if not request.user.is_superuser:
		raise PermissionDenied("Only superusers can access the analytics dashboard.")

	User = get_user_model()
	now = timezone.now()
	start_date, end_date, range_key = _parse_dashboard_dates(request)

	tz = timezone.get_current_timezone()
	start_dt = timezone.make_aware(datetime.combine(start_date, time.min), tz)
	end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min), tz)

	successful_purchases = MatchPurchase.objects.filter(status=MatchPurchase.PurchaseStatus.SUCCESS)
	date_filtered_success = successful_purchases.filter(created_at__gte=start_dt, created_at__lt=end_dt)

	total_revenue = successful_purchases.aggregate(total=Sum("amount"))["total"] or Decimal("0")
	total_users = User.objects.count()
	active_subscriptions = (
		successful_purchases.filter(is_subscription=True, subscription_end__gt=now)
		.values("user_id")
		.distinct()
		.count()
	)
	total_match_purchases = successful_purchases.filter(is_subscription=False).count()

	revenue_match = successful_purchases.filter(is_subscription=False).aggregate(total=Sum("amount"))["total"] or Decimal("0")
	revenue_subscription = successful_purchases.filter(is_subscription=True).aggregate(total=Sum("amount"))["total"] or Decimal("0")

	premium_users = User.objects.filter(is_premium=True).count()
	non_premium_users = max(total_users - premium_users, 0)
	conversion_rate = round((premium_users / total_users) * 100, 2) if total_users else 0

	daily_revenue_rows = (
		date_filtered_success.annotate(day=TruncDate("created_at"))
		.values("day")
		.annotate(total=Sum("amount"))
		.order_by("day")
	)
	daily_purchase_rows = (
		date_filtered_success.annotate(day=TruncDate("created_at"))
		.values("day")
		.annotate(total=Count("id"))
		.order_by("day")
	)
	daily_user_rows = (
		User.objects.filter(date_joined__gte=start_dt, date_joined__lt=end_dt)
		.annotate(day=TruncDate("date_joined"))
		.values("day")
		.annotate(total=Count("id"))
		.order_by("day")
	)

	revenue_map = {row["day"]: row["total"] for row in daily_revenue_rows}
	purchase_map = {row["day"]: row["total"] for row in daily_purchase_rows}
	user_map = {row["day"]: row["total"] for row in daily_user_rows}

	daily_revenue_chart = _build_chart_points(start_date, end_date, revenue_map)
	daily_purchase_chart = _build_chart_points(start_date, end_date, purchase_map)
	daily_user_chart = _build_chart_points(start_date, end_date, user_map)

	top_matches_by_revenue = list(
		successful_purchases.filter(is_subscription=False, match__isnull=False)
		.values("match_id", "match__match_name")
		.annotate(total_revenue=Sum("amount"), purchase_count=Count("id"))
		.order_by("-total_revenue", "-purchase_count")[:5]
	)

	top_matches_by_purchases = list(
		successful_purchases.filter(is_subscription=False, match__isnull=False)
		.values("match_id", "match__match_name")
		.annotate(total_revenue=Sum("amount"), purchase_count=Count("id"))
		.order_by("-purchase_count", "-total_revenue")[:5]
	)

	recent_purchases = list(
		successful_purchases.select_related("user", "match")
		.only("user__email", "match__match_name", "amount", "is_subscription", "created_at")
		.order_by("-created_at")[:10]
	)

	context = {
		**admin.site.each_context(request),
		"title": "Admin Analytics Dashboard",
		"dashboard_subtitle": "Revenue, users, conversion, and content performance overview.",
		"total_revenue": total_revenue,
		"total_users": total_users,
		"active_subscriptions": active_subscriptions,
		"total_match_purchases": total_match_purchases,
		"revenue_match": revenue_match,
		"revenue_subscription": revenue_subscription,
		"premium_users": premium_users,
		"non_premium_users": non_premium_users,
		"conversion_rate": conversion_rate,
		"daily_revenue_chart": daily_revenue_chart,
		"daily_user_chart": daily_user_chart,
		"daily_purchase_chart": daily_purchase_chart,
		"top_matches_by_revenue": top_matches_by_revenue,
		"top_matches_by_purchases": top_matches_by_purchases,
		"recent_purchases": recent_purchases,
		"start_date": start_date,
		"end_date": end_date,
		"range_key": range_key,
		"quick_action_urls": {
			"add_match": reverse("admin:matches_match_add"),
			"add_premium_content": reverse("admin:matches_premiumcontent_add"),
			"view_users": reverse("admin:users_user_changelist"),
			"view_purchases": reverse("admin:payments_matchpurchase_changelist"),
		},
	}

	return TemplateResponse(request, "admin/dashboard.html", context)


def _with_analytics_dashboard_urls(original_get_urls):
	def get_urls():
		custom_urls = [
			path(
				"dashboard/",
				admin.site.admin_view(_admin_dashboard_view),
				name="analytics-dashboard",
			),
		]
		return custom_urls + original_get_urls()

	return get_urls


if not getattr(admin.site, "_analytics_dashboard_registered", False):
	admin.site.get_urls = _with_analytics_dashboard_urls(admin.site.get_urls)
	admin.site._analytics_dashboard_registered = True
