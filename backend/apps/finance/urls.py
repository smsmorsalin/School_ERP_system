from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.finance.views import (
    FeeCategoryViewSet,
    FeeStructureViewSet,
    InvoiceViewSet,
    PaymentViewSet,
)

router = DefaultRouter()
router.register("finance/fee-categories", FeeCategoryViewSet, basename="fee-category")
router.register("finance/fee-structures", FeeStructureViewSet, basename="fee-structure")
router.register("finance/invoices", InvoiceViewSet, basename="invoice")
router.register("finance/payments", PaymentViewSet, basename="payment")

urlpatterns = [path("", include(router.urls))]
