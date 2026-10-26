from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("vessels", views.VesselViewSet)
router.register("berths", views.BerthViewSet)
router.register("vessel-calls", views.VesselCallViewSet)
router.register("yard-slots", views.YardSlotViewSet)
router.register("tariffs", views.TariffViewSet)
router.register("containers", views.ContainerViewSet)
router.register("gate-events", views.GateEventViewSet)

urlpatterns = [
    path("", include(router.urls)),
]