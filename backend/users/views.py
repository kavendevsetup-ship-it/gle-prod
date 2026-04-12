import secrets

from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token

from .models import UpdatePost, UserUpdateStatus


def _build_unique_username(base: str, UserModel) -> str:
	candidate = (base or "user").strip().lower().replace(" ", "_")
	candidate = "".join(ch for ch in candidate if ch.isalnum() or ch == "_")
	if not candidate:
		candidate = "user"

	final_username = candidate
	suffix = 1
	while UserModel.objects.filter(username=final_username).exists():
		suffix += 1
		final_username = f"{candidate}_{suffix}"

	return final_username


class BackendAuthBridgeAPIView(APIView):
	permission_classes = [AllowAny]

	def post(self, request):
		email = (request.data.get("email") or "").strip().lower()
		name = (request.data.get("name") or "").strip()

		if not email:
			return Response({"detail": "email is required"}, status=400)

		UserModel = get_user_model()
		user = UserModel.objects.filter(email=email).first()

		if user is None:
			base_username = email.split("@")[0] if "@" in email else name
			username = _build_unique_username(base_username, UserModel)
			user = UserModel.objects.create_user(
				email=email,
				username=username,
				password=secrets.token_urlsafe(24),
			)

		if name and not user.first_name and not user.last_name:
			parts = [part for part in name.split(" ") if part]
			if parts:
				user.first_name = parts[0]
				if len(parts) > 1:
					user.last_name = " ".join(parts[1:])
				user.save(update_fields=["first_name", "last_name"])

		token, _ = Token.objects.get_or_create(user=user)

		return Response(
			{
				"token": token.key,
				"user": {
					"id": user.id,
					"email": user.email,
					"username": user.username,
				},
			}
		)


class UpdatesListAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		updates = list(
			UpdatePost.objects.filter(is_active=True)
			.only("id", "title", "body", "created_at")
			.prefetch_related(
				Prefetch(
					"user_statuses",
					queryset=UserUpdateStatus.objects.filter(user=request.user).only("update_id", "is_read"),
					to_attr="request_user_status",
				)
			)
			.order_by("-created_at", "-id")[:20]
		)

		return Response(
			[
				{
					"id": item.id,
					"title": item.title,
					"body": item.body,
					"created_at": item.created_at,
					"is_read": bool(
						item.request_user_status and item.request_user_status[0].is_read
					),
				}
				for item in updates
			]
		)


class UpdateMarkReadAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request, update_id: int):
		update_post = get_object_or_404(UpdatePost, pk=update_id, is_active=True)
		status_obj, created = UserUpdateStatus.objects.get_or_create(
			user=request.user,
			update=update_post,
			defaults={
				"is_read": True,
				"read_at": timezone.now(),
			},
		)

		if not created and (not status_obj.is_read or status_obj.read_at is None):
			status_obj.is_read = True
			status_obj.read_at = timezone.now()
			status_obj.save(update_fields=["is_read", "read_at"])

		return Response({"success": True, "update_id": update_post.id})
