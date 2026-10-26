import copy

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers

from .models import (
    Berth,
    Container,
    GateEvent,
    Tariff,
    Vessel,
    VesselCall,
    YardSlot,
)


class CleanedModelSerializer(serializers.ModelSerializer):
    """Runs the model's clean() rules before saving.

    Django's admin calls clean() automatically, but the API does not.
    This makes the API enforce the same rules (berth clashes, gate-out
    checks), so there is only one set of business rules.
    """

    def validate(self, attrs):
        model = self.Meta.model
        if self.instance is not None:
            candidate = copy.copy(self.instance)
            for name, value in attrs.items():
                setattr(candidate, name, value)
        else:
            candidate = model(**attrs)
        try:
            candidate.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return attrs


class VesselSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vessel
        fields = "__all__"


class BerthSerializer(serializers.ModelSerializer):
    class Meta:
        model = Berth
        fields = "__all__"


class VesselCallSerializer(CleanedModelSerializer):
    vessel_name = serializers.CharField(source="vessel.name", read_only=True)
    berth_name = serializers.CharField(source="berth.name", read_only=True)

    class Meta:
        model = VesselCall
        fields = "__all__"

    def save(self, **kwargs):
        # clean() already catches ordinary clashes. This is the safety net for
        # two requests passing clean() at the same instant: the database
        # constraints refuse the second one, and we turn that into a normal
        # 400 message instead of a server error.
        try:
            with transaction.atomic():
                return super().save(**kwargs)
        except IntegrityError as exc:
            text = str(exc)
            if "no_overlapping_berth_bookings" in text:
                message = "This berth is already booked in that window."
            elif "vesselcall_departure_after_arrival" in text:
                message = "Departure must be after arrival."
            else:
                raise
            raise serializers.ValidationError({"non_field_errors": [message]})


class YardSlotSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="__str__", read_only=True)

    class Meta:
        model = YardSlot
        fields = "__all__"


class TariffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tariff
        fields = "__all__"


class ContainerSerializer(serializers.ModelSerializer):
    slot_label = serializers.StringRelatedField(source="slot", read_only=True)
    storage_charge = serializers.SerializerMethodField()

    class Meta:
        model = Container
        fields = "__all__"

    def get_storage_charge(self, obj):
        # None when arrived_at or a matching Tariff is missing
        return obj.storage_charge()


class GateEventSerializer(CleanedModelSerializer):
    container_number = serializers.CharField(source="container.number", read_only=True)

    class Meta:
        model = GateEvent
        fields = "__all__"
        read_only_fields = ("timestamp",) 