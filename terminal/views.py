from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Berth,
    Container,
    GateEvent,
    Tariff,
    Vessel,
    VesselCall,
    YardSlot,
)
from .serializers import (
    BerthSerializer,
    ContainerSerializer,
    GateEventSerializer,
    TariffSerializer,
    VesselCallSerializer,
    VesselSerializer,
    YardSlotSerializer,
)


class VesselViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Vessel.objects.all().order_by("name")
    serializer_class = VesselSerializer


class BerthViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Berth.objects.all().order_by("name")
    serializer_class = BerthSerializer


class VesselCallViewSet(viewsets.ModelViewSet):
    """Full create/read/update/delete: the berth planner needs to book calls."""

    queryset = VesselCall.objects.select_related("vessel", "berth").order_by("eta")
    serializer_class = VesselCallSerializer

    @action(detail=True, methods=["post"])
    def arrive(self, request, pk=None):
        """POST /api/vessel-calls/<id>/arrive/ : the vessel is alongside now."""
        return self._record(pk, "record_arrival")

    @action(detail=True, methods=["post"])
    def depart(self, request, pk=None):
        """POST /api/vessel-calls/<id>/depart/ : the vessel has left now."""
        return self._record(pk, "record_departure")

    def _record(self, pk, method_name):
        # The row is locked while we check and change it, so two people
        # clicking at once cannot both record the same arrival.
        with transaction.atomic():
            call = get_object_or_404(
                VesselCall.objects.select_for_update(), pk=pk
            )
            try:
                getattr(call, method_name)()
            except DjangoValidationError as exc:
                raise serializers.ValidationError(
                    {"non_field_errors": exc.messages}
                )
        call = self.get_queryset().get(pk=call.pk)
        return Response(self.get_serializer(call).data)


class YardSlotViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = YardSlot.objects.all().order_by("block", "bay", "row", "tier")
    serializer_class = YardSlotSerializer


class TariffViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tariff.objects.all().order_by("size_ft")
    serializer_class = TariffSerializer


class ContainerViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only for now: status changes must come through gate events."""

    queryset = Container.objects.select_related("slot", "vessel_call").order_by(
        "number"
    )
    serializer_class = ContainerSerializer


class GateEventViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Create and read only. Gate events are a log, so no edit or delete."""

    queryset = GateEvent.objects.select_related("container").order_by("-timestamp")
    serializer_class = GateEventSerializer  