from django.core.exceptions import ValidationError
from django.db import models


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

    def clean(self):
        if self.etd <= self.eta:
            raise ValidationError("Departure must be after arrival.")
        if self.berth_id:
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

    def __str__(self):
        return self.number


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

    def __str__(self):
        return f"{self.container.number} {self.direction} {self.timestamp:%Y-%m-%d %H:%M}"  