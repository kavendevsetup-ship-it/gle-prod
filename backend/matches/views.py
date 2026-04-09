from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from payments.access import has_active_subscription, has_premium_access

from .models import Match
from .serializers import FreeContentSerializer, MatchSerializer, PremiumContentSerializer


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

		match_data = MatchSerializer(match).data
		free_content_data = FreeContentSerializer(
			match.free_contents.all(), many=True, context={"request": request}
		).data
		premium_content_data = PremiumContentSerializer(
			match.premium_contents.all(), many=True, context={"request": request}
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
