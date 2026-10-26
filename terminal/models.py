from math import ceil

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone


class Vessel(models.Model):
    """A ship. Exists once, no matter how many times it visits the port."""

    imo_number = models.CharField(max_length=7, unique=True)  # permanent ID
    mmsi = models.CharField(max_length=9, blank=True)  # used by AIS feeds
    name = models.CharField(max_length=100)
    flag = models.CharField(max_length=60, blank=True)
    length_m = models.DecimalField(max_digits=6, decimal_places=1)
    draft_m = models.DecimalField(max_digits=4, decimal_places=1)

    def __str__(self):
        return f"{self.name} (IMO {self.imo_number})"


class Berth(models.Model):
    """A physical docking position at the quay."""

    name = models.CharField(max_length=20, unique=True)  # e.g. "Berth 16"
    length_m = models.DecimalField(max_digits=6, decimal_places=1)
    max_draft_m = models.DecimalField(max_digits=4, decimal_places=1)

    def __str__(self):
        return self.name


class VesselCall(models.Model):
    """One visit of a vessel to the port: the heart of berth planning."""

    class Status(models.TextChoices):
        EXPECTED = "EXPECTED", "Expected"
        ALONGSIDE = "ALONGSIDE", "Alongside"
        DEPARTED = "DEPARTED", "Departed"

    vessel = models.ForeignKey(Vessel, on_delete=models.PROTECT, related_name="calls")
    berth = models.ForeignKey(
        Berth, null=True, blank=True, on_delete=models.PROTECT, related_name="calls"
    )
    eta = models.DateTimeField()  # estimated arrival
    etd = models.DateTimeField()  # estimated departure
    ata = models.DateTimeField(null=True, blank=True)  # actual arrival
    atd = models.DateTimeField(null=True, blank=True)  # actual departure
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.EXPECTED
    )

    class Meta:
        # Enforced by the database itself, even if clean() is skipped.
        # The berth-overlap guard is PostgreSQL-only, so it lives in
        # migration 0004 rather than here.
        constraints = [
            models.CheckConstraint(
                condition=models.Q(etd__gt=models.F("eta")),
                name="vesselcall_departure_after_arrival",
            ),
        ]

    def clean(self):
        # Guards: if a field failed form validation it is None here, and
        # comparing None with a date would crash instead of showing a message.
        if self.eta and self.etd and self.etd <= self.eta:
            raise ValidationError("Departure must be after arrival.")

        # Actual times describe things that already happened.
        now = timezone.now()
        if self.ata and self.ata > now:
            raise ValidationError("Actual arrival cannot be in the future.")
        if self.atd:
            if not self.ata:
                raise ValidationError(
                    "Actual departure needs an actual arrival first."
                )
            if self.atd <= self.ata:
                raise ValidationError(
                    "Actual departure must be after actual arrival."
                )
            if self.atd > now:
                raise ValidationError("Actual departure cannot be in the future.")

        if self.berth_id and self.eta and self.etd:
            clash = VesselCall.objects.filter(
                berth=self.berth, eta__lt=self.etd, etd__gt=self.eta
            ).exclude(pk=self.pk)
            if clash.exists():
                raise ValidationError("This berth is already booked in that window.")

    def __str__(self):
        return f"{self.vessel.name} arriving {self.eta:%Y-%m-%d}"


class YardSlot(models.Model):
    """One stacking position in the container yard."""

    block = models.CharField(max_length=5)  # e.g. "A"
    bay = models.PositiveSmallIntegerField()
    row = models.PositiveSmallIntegerField()
    tier = models.PositiveSmallIntegerField()  # stack height, 1 = ground

    class Meta:
        unique_together = ("block", "bay", "row", "tier")

    def __str__(self):
        return f"{self.block}-{self.bay}-{self.row}-{self.tier}"


class Container(models.Model):
    """A container (the box), identified by its ISO 6346 number."""

    class Status(models.TextChoices):
        ON_VESSEL = "ON_VESSEL", "On vessel"
        IN_YARD = "IN_YARD", "In yard"
        GATED_OUT = "GATED_OUT", "Gated out"

    number = models.CharField(max_length=11, unique=True)  # e.g. MSKU1234567
    size_ft = models.PositiveSmallIntegerField(choices=[(20, "20ft"), (40, "40ft")])
    weight_kg = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ON_VESSEL
    )
    vessel_call = models.ForeignKey(
        VesselCall, on_delete=models.PROTECT, related_name="containers"
    )
    # OneToOne = a slot can hold at most one container at a time
    slot = models.OneToOneField(
        YardSlot, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="container",
    )
    # When the box entered the yard: the start of the storage clock
    arrived_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.number

    def storage_charge(self):
        """Work out storage days and the fee owed.

        Clock starts at arrived_at. It stops at the gate-out time, or at
        "now" if the box is still in the yard (a running charge).
        Any part of a day counts as a full day.
        Returns None if arrived_at or a matching Tariff is missing.
        """
        if self.arrived_at is None:
            return None
        tariff = Tariff.objects.filter(size_ft=self.size_ft).first()
        if tariff is None:
            return None

        gate_out = (
            self.gate_events.filter(direction=GateEvent.Direction.OUT)
            .order_by("-timestamp")
            .first()
        )
        end = gate_out.timestamp if gate_out else timezone.now()

        seconds = (end - self.arrived_at).total_seconds()
        days_stored = max(0, ceil(seconds / 86400))
        chargeable_days = max(0, days_stored - tariff.free_days)
        return {
            "days_stored": days_stored,
            "free_days": tariff.free_days,
            "chargeable_days": chargeable_days,
            "amount_kes": chargeable_days * tariff.daily_rate_kes,
            "still_in_yard": gate_out is None,
        }


class GateEvent(models.Model):
    """A truck passing the gate. Many events per container over its life."""

    class Direction(models.TextChoices):
        IN = "IN", "Gate in"
        OUT = "OUT", "Gate out"

    container = models.ForeignKey(
        Container, on_delete=models.PROTECT, related_name="gate_events"
    )
    direction = models.CharField(max_length=3, choices=Direction.choices)
    truck_plate = models.CharField(max_length=15)
    appointment_ref = models.CharField(max_length=30, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def clean(self):
        # Only check brand-new events, so old records can still be edited.
        if self.pk is None and self.container_id:
            if (
                self.direction == self.Direction.OUT
                and self.container.status != Container.Status.IN_YARD
            ):
                raise ValidationError(
                    "Only a container that is in the yard can gate out."
                )

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        # atomic = both changes succeed together, or neither is saved
        with transaction.atomic():
            super().save(*args, **kwargs)
            if is_new and self.direction == self.Direction.OUT:
                container = self.container
                container.status = Container.Status.GATED_OUT
                container.slot = None  # frees the yard slot
                container.save()

    def __str__(self):
        return f"{self.container.number} {self.direction} {self.timestamp:%Y-%m-%d %H:%M}"


class Tariff(models.Model):
    """Storage pricing per container size. Editable in admin, not in code."""

    size_ft = models.PositiveSmallIntegerField(
        choices=[(20, "20ft"), (40, "40ft")], unique=True
    )
    free_days = models.PositiveSmallIntegerField(default=3)
    daily_rate_kes = models.DecimalField(max_digits=8, decimal_places=2)

    def __str__(self):
        return f"{self.size_ft}ft: {self.free_days} free days, KES {self.daily_rate_kes}/day"  