from rest_framework import mixins, viewsets

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