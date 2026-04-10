from django.urls import path

from .views import CheckAccessAPIView, CreateOrderAPIView, PricingAPIView, VerifyPaymentAPIView

urlpatterns = [
    path("check-access/", CheckAccessAPIView.as_view(), name="check-access"),
    path("create-order/", CreateOrderAPIView.as_view(), name="create-order"),
    path("verify/", VerifyPaymentAPIView.as_view(), name="verify-payment"),
    path("pricing/", PricingAPIView.as_view(), name="pricing"),
]
