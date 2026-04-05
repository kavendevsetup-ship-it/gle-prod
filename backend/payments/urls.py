from django.urls import path

from .views import CreateOrderAPIView, VerifyPaymentAPIView

urlpatterns = [
    path("create-order/", CreateOrderAPIView.as_view(), name="create-order"),
    path("verify/", VerifyPaymentAPIView.as_view(), name="verify-payment"),
]
