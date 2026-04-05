from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from payments.models import MatchPurchase

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
			match.premium_contents.all(), many=True
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

		has_access = MatchPurchase.objects.filter(
			user=request.user,
			match=match,
			status=MatchPurchase.PurchaseStatus.SUCCESS,
		).exists()

		return Response({"access": has_access})
