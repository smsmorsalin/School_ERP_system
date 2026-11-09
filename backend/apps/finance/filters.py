"""Finance filters (UUID query params)."""

import django_filters

from apps.finance.models import FeeStructure, Invoice, Payment


class FeeStructureFilter(django_filters.FilterSet):
    academic_year = django_filters.UUIDFilter(field_name="academic_year__uuid")
    school_class = django_filters.UUIDFilter(field_name="school_class__uuid")
    category = django_filters.UUIDFilter(field_name="category__uuid")

    class Meta:
        model = FeeStructure
        fields = []


class InvoiceFilter(django_filters.FilterSet):
    student = django_filters.UUIDFilter(field_name="student__uuid")
    fee_structure = django_filters.UUIDFilter(field_name="fee_structure__uuid")
    section = django_filters.UUIDFilter(field_name="student__current_section__uuid")
    school_class = django_filters.UUIDFilter(field_name="student__current_section__school_class__uuid")
    status = django_filters.CharFilter()
    overdue = django_filters.BooleanFilter(method="filter_overdue")

    class Meta:
        model = Invoice
        fields = []

    def filter_overdue(self, queryset, name, value):
        from django.utils import timezone

        if value:
            return queryset.filter(
                status__in=["unpaid", "partial"], due_date__lt=timezone.localdate()
            )
        return queryset


class PaymentFilter(django_filters.FilterSet):
    invoice = django_filters.UUIDFilter(field_name="invoice__uuid")
    student = django_filters.UUIDFilter(field_name="invoice__student__uuid")
    method = django_filters.CharFilter()
    paid_from = django_filters.DateTimeFilter(field_name="paid_at", lookup_expr="gte")
    paid_to = django_filters.DateTimeFilter(field_name="paid_at", lookup_expr="lte")

    class Meta:
        model = Payment
        fields = []
