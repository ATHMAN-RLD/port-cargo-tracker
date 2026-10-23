from django.contrib import admin

from .models import (
    Berth,
    Container,
    GateEvent,
    Tariff,
    Vessel,
    VesselCall,
    YardSlot,
)


@admin.register(Vessel)
class VesselAdmin(admin.ModelAdmin):
    list_display = ("name", "imo_number", "length_m", "draft_m")


@admin.register(Berth)
class BerthAdmin(admin.ModelAdmin):
    list_display = ("name", "length_m", "max_draft_m")


@admin.register(VesselCall)
class VesselCallAdmin(admin.ModelAdmin):
    list_display = ("vessel", "berth", "eta", "etd", "status")


@admin.register(YardSlot)
class YardSlotAdmin(admin.ModelAdmin):
    list_display = ("block", "bay", "row", "tier")


@admin.register(Container)
class ContainerAdmin(admin.ModelAdmin):
    list_display = (
        "number",
        "size_ft",
        "status",
        "slot",
        "arrived_at",
        "days_stored",
        "storage_fee",
    )

    @admin.display(description="Days stored")
    def days_stored(self, obj):
        charge = obj.storage_charge()
        return "-" if charge is None else charge["days_stored"]

    @admin.display(description="Storage fee (KES)")
    def storage_fee(self, obj):
        charge = obj.storage_charge()
        return "-" if charge is None else charge["amount_kes"]


@admin.register(GateEvent)
class GateEventAdmin(admin.ModelAdmin):
    list_display = ("container", "direction", "truck_plate", "timestamp")


@admin.register(Tariff)
class TariffAdmin(admin.ModelAdmin):
    list_display = ("size_ft", "free_days", "daily_rate_kes")