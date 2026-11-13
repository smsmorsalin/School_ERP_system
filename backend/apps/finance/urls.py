from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.finance.views import (
    FeeCategoryViewSet,
    FeeStructureViewSet,
    InvoiceViewSet,
    PaymentGatewayListView,
    PaymentIntentViewSet,
    PaymentViewSet,
    PaymentWebhookView,
)

router = DefaultRouter()
router.register("finance/fee-categories", FeeCategoryViewSet, basename="fee-category")
router.register("finance/fee-structures", FeeStructureViewSet, basename="fee-structure")
router.register("finance/invoices", InvoiceViewSet, basename="invoice")
router.register("finance/payments", PaymentViewSet, basename="payment")
router.register("finance/payment-intents", PaymentIntentViewSet, basename="payment-intent")

urlpatterns = [
    path("finance/payment-gateways/", PaymentGatewayListView.as_view(), name="payment-gateways"),
    path(
        "finance/payment-webhook/<str:gateway>/",
        PaymentWebhookView.as_view(),
        name="payment-webhook",
    ),
    path("", include(router.urls)),
]
