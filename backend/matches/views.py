import os

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from payments.access import has_active_subscription, has_premium_access

from .models import FreeContent, Match
from .serializers import FreeContentSerializer, MatchSerializer, PremiumContentSerializer


def _resolve_free_content_type(item: FreeContent) -> str:
	content_type = (item.content_type or item.type or FreeContent.ContentType.PDF).lower()
	if content_type in {
		FreeContent.ContentType.PDF,
		FreeContent.ContentType.IMAGE,
		FreeContent.ContentType.TEXT,
	}:
		return content_type
	return FreeContent.ContentType.PDF


class MatchListAPIView(APIView):
	permission_classes = [AllowAny]

	def get(self, request):
		matches = Match.objects.all().order_by("-match_date")
		serializer = MatchSerializer(matches, many=True)
		return Response(serializer.data)


class MatchDetailAPIView(APIView):
	permission_classes = [AllowAny]

	def get(self, request, match_id: int):
		match = get_object_or_404(Match, pk=match_id)
		can_view_protected_media = bool(
			request.user.is_authenticated and has_premium_access(request.user, match)
		)

		match_data = MatchSerializer(match).data
		free_content_data = FreeContentSerializer(
			match.free_contents.all(), many=True, context={"request": request}
		).data
		premium_content_data = PremiumContentSerializer(
			match.premium_contents.all(),
			many=True,
			context={
				"request": request,
				"show_protected_media": can_view_protected_media,
			},
		).data

		return Response(
			{
				"match": match_data,
				"free_content": free_content_data,
				"premium_content": premium_content_data,
			}
		)


class MatchAccessAPIView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request, match_id: int):
		match = get_object_or_404(Match, pk=match_id)
		is_subscription_active = has_active_subscription(request.user)
		has_access = has_premium_access(request.user, match)

		return Response(
			{
				"access": has_access,
				"has_access": has_access,
				"is_subscription": is_subscription_active,
			}
		)


class FreeContentPdfProxyAPIView(APIView):
	permission_classes = [AllowAny]

	def get(self, request, content_id: int):
		content = get_object_or_404(FreeContent, pk=content_id)

		if _resolve_free_content_type(content) != FreeContent.ContentType.PDF or not content.file:
			raise Http404("PDF content not found")

		try:
			content.file.open("rb")
		except Exception as exc:
			raise Http404("Unable to open PDF") from exc

		filename = os.path.basename(content.file.name) or "analysis.pdf"
		response = FileResponse(content.file, content_type="application/pdf")
		response["Content-Disposition"] = f'inline; filename="{filename}"'
		response["X-Content-Type-Options"] = "nosniff"
		response["Cache-Control"] = "private, no-store"
		return response
