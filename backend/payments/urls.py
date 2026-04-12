from django.urls import path

from .views import AccessStatusAPIView, CheckAccessAPIView, CreateOrderAPIView, PricingAPIView, VerifyPaymentAPIView

urlpatterns = [
	path("access/", AccessStatusAPIView.as_view(), name="access-status"),
    path("check-access/", CheckAccessAPIView.as_view(), name="check-access"),
    path("create-order/", CreateOrderAPIView.as_view(), name="create-order"),
    path("verify/", VerifyPaymentAPIView.as_view(), name="verify-payment"),
    path("pricing/", PricingAPIView.as_view(), name="pricing"),
]
