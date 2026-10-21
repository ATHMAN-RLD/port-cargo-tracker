from django.contrib import admin

from .models import Berth, Container, GateEvent, Vessel, VesselCall, YardSlot


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
    list_display = ("number", "size_ft", "status", "vessel_call", "slot")


@admin.register(GateEvent)
class GateEventAdmin(admin.ModelAdmin):
    list_display = ("container", "direction", "truck_plate", "timestamp")  