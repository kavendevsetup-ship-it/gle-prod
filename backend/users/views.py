import secrets

from django.contrib.auth import get_user_model
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token


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
