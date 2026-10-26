from datetime import timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (
    Berth,
    Container,
    GateEvent,
    Tariff,
    Vessel,
    VesselCall,
    YardSlot,
)


def make_world():
    """One vessel, one berth, one booked call, one slot, one tariff."""
    vessel = Vessel.objects.create(
        imo_number="1234777", name="MV Kenya Star", length_m=250, draft_m=12
    )
    berth = Berth.objects.create(name="Berth 1", length_m=300, max_draft_m=14)
    call = VesselCall.objects.create(
        vessel=vessel,
        berth=berth,
        eta="2026-11-01T08:00:00Z",
        etd="2026-11-02T08:00:00Z",
    )
    slot = YardSlot.objects.create(block="A", bay=1, row=1, tier=1)
    Tariff.objects.create(size_ft=40, free_days=3, daily_rate_kes="2000.00")
    return vessel, berth, call, slot


class StorageChargeTests(TestCase):
    """The billing rule, tested without the API."""

    def setUp(self):
        _, _, self.call, self.slot = make_world()

    def make_container(self, arrived_at, **extra):
        return Container.objects.create(
            number="MSKU1234567",
            size_ft=40,
            status=Container.Status.IN_YARD,
            vessel_call=self.call,
            slot=self.slot,
            arrived_at=arrived_at,
            **extra,
        )

    def test_part_of_a_day_counts_as_a_full_day(self):
        # 6 days 1 hour -> 7 days stored, 3 free, 4 chargeable, 4 x 2000
        box = self.make_container(timezone.now() - timedelta(days=6, hours=1))
        charge = box.storage_charge()
        self.assertEqual(charge["days_stored"], 7)
        self.assertEqual(charge["chargeable_days"], 4)
        self.assertEqual(float(charge["amount_kes"]), 8000.0)
        self.assertTrue(charge["still_in_yard"])

    def test_inside_free_days_costs_nothing(self):
        box = self.make_container(timezone.now() - timedelta(days=2))
        self.assertEqual(float(box.storage_charge()["amount_kes"]), 0.0)

    def test_no_arrival_time_gives_none(self):
        box = self.make_container(None)
        self.assertIsNone(box.storage_charge())

    def test_no_matching_tariff_gives_none(self):
        Tariff.objects.all().delete()
        box = self.make_container(timezone.now() - timedelta(days=5))
        self.assertIsNone(box.storage_charge())

    def test_fee_freezes_at_gate_out(self):
        # Arrived 9.5 days ago, left 2 days ago -> stored 7.5 days -> 8 days.
        # If the clock wrongly ran to "now", this would be 10 days.
        now = timezone.now()
        box = self.make_container(now - timedelta(days=9, hours=12))
        event = GateEvent.objects.create(
            container=box, direction="OUT", truck_plate="KDG 123A"
        )
        # timestamp is auto_now_add, so backdate it with update()
        GateEvent.objects.filter(pk=event.pk).update(timestamp=now - timedelta(days=2))
        charge = box.storage_charge()
        self.assertFalse(charge["still_in_yard"])
        self.assertEqual(charge["days_stored"], 8)
        self.assertEqual(charge["chargeable_days"], 5)
        self.assertEqual(float(charge["amount_kes"]), 10000.0)


class ActualTimeRulesTests(TestCase):
    """ATA/ATD record what really happened, so they have rules too."""

    def setUp(self):
        self.vessel, self.berth, self.call, _ = make_world()

    def check(self, **changes):
        for name, value in changes.items():
            setattr(self.call, name, value)
        self.call.clean()

    def test_valid_actual_times_pass(self):
        now = timezone.now()
        self.check(ata=now - timedelta(days=2), atd=now - timedelta(days=1))

    def test_actual_arrival_in_future_is_rejected(self):
        with self.assertRaisesMessage(ValidationError, "cannot be in the future"):
            self.check(ata=timezone.now() + timedelta(days=1))

    def test_actual_departure_in_future_is_rejected(self):
        now = timezone.now()
        with self.assertRaisesMessage(ValidationError, "cannot be in the future"):
            self.check(ata=now - timedelta(days=1), atd=now + timedelta(days=1))

    def test_departure_before_arrival_is_rejected(self):
        now = timezone.now()
        with self.assertRaisesMessage(ValidationError, "must be after actual arrival"):
            self.check(ata=now - timedelta(days=1), atd=now - timedelta(days=2))

    def test_departure_without_arrival_is_rejected(self):
        with self.assertRaisesMessage(ValidationError, "needs an actual arrival"):
            self.check(atd=timezone.now() - timedelta(days=1))

    def test_blank_eta_does_not_crash(self):
        # A blank field used to cause a TypeError instead of a clean message
        self.check(eta=None)


class GateRulesTests(TestCase):
    def setUp(self):
        _, _, self.call, self.slot = make_world()
        self.box = Container.objects.create(
            number="MSKU1234567",
            size_ft=40,
            status=Container.Status.IN_YARD,
            vessel_call=self.call,
            slot=self.slot,
        )

    def test_gate_out_updates_status_and_frees_slot(self):
        GateEvent.objects.create(
            container=self.box, direction="OUT", truck_plate="KDG 123A"
        )
        self.box.refresh_from_db()
        self.assertEqual(self.box.status, Container.Status.GATED_OUT)
        self.assertIsNone(self.box.slot)

    def test_gate_in_leaves_container_unchanged(self):
        GateEvent.objects.create(
            container=self.box, direction="IN", truck_plate="KAA 111A"
        )
        self.box.refresh_from_db()
        self.assertEqual(self.box.status, Container.Status.IN_YARD)
        self.assertEqual(self.box.slot, self.slot)


class ApiTests(APITestCase):
    def setUp(self):
        self.vessel, self.berth, self.call, self.slot = make_world()
        self.box = Container.objects.create(
            number="MSKU1234567",
            size_ft=40,
            status=Container.Status.IN_YARD,
            vessel_call=self.call,
            slot=self.slot,
            arrived_at=timezone.now() - timedelta(days=4, hours=12),
        )

    def other_vessel(self, imo):
        return Vessel.objects.create(
            imo_number=imo, name=f"MV {imo}", length_m=200, draft_m=10
        )

    def test_every_list_endpoint_responds(self):
        for name in (
            "vessels", "berths", "vessel-calls", "yard-slots",
            "tariffs", "containers", "gate-events",
        ):
            with self.subTest(endpoint=name):
                self.assertEqual(self.client.get(f"/api/{name}/").status_code, 200)

    def test_container_list_includes_storage_charge(self):
        data = self.client.get("/api/containers/").json()
        charge = data[0]["storage_charge"]
        self.assertEqual(charge["days_stored"], 5)
        self.assertEqual(charge["chargeable_days"], 2)
        self.assertEqual(float(charge["amount_kes"]), 4000.0)

    def test_overlapping_call_is_rejected(self):
        r = self.client.post(
            "/api/vessel-calls/",
            {
                "vessel": self.other_vessel("1234000").id,
                "berth": self.berth.id,
                "eta": "2026-11-01T20:00:00Z",
                "etd": "2026-11-03T08:00:00Z",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("already booked", str(r.json()))

    def test_back_to_back_call_is_accepted(self):
        r = self.client.post(
            "/api/vessel-calls/",
            {
                "vessel": self.other_vessel("1234001").id,
                "berth": self.berth.id,
                "eta": "2026-11-02T09:00:00Z",
                "etd": "2026-11-03T08:00:00Z",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)

    def test_departure_before_arrival_is_rejected(self):
        r = self.client.post(
            "/api/vessel-calls/",
            {
                "vessel": self.other_vessel("1234002").id,
                "berth": self.berth.id,
                "eta": "2026-11-10T09:00:00Z",
                "etd": "2026-11-05T08:00:00Z",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("Departure must be after arrival", str(r.json()))

    def test_gate_out_through_api_then_repeat_is_refused(self):
        payload = {
            "container": self.box.id,
            "direction": "OUT",
            "truck_plate": "KDG 123A",
            "appointment_ref": "APT-001",
        }
        first = self.client.post("/api/gate-events/", payload, format="json")
        self.assertEqual(first.status_code, 201, first.content)
        self.box.refresh_from_db()
        self.assertEqual(self.box.status, Container.Status.GATED_OUT)
        self.assertIsNone(self.box.slot)

        again = self.client.post("/api/gate-events/", payload, format="json")
        self.assertEqual(again.status_code, 400)
        self.assertIn("in the yard", str(again.json()))
        self.assertEqual(GateEvent.objects.count(), 1)

    def test_api_rejects_future_actual_arrival(self):
        r = self.client.patch(
            f"/api/vessel-calls/{self.call.id}/",
            {"ata": (timezone.now() + timedelta(days=3)).isoformat()},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("future", str(r.json()))

    def test_protected_data_cannot_be_edited_through_api(self):
        url = f"/api/containers/{self.box.id}/"
        self.assertEqual(
            self.client.patch(url, {"status": "ON_VESSEL"}, format="json").status_code,
            405,
        )
        self.assertEqual(
            self.client.delete(f"/api/vessels/{self.vessel.id}/").status_code, 405
        )
        event = GateEvent.objects.create(
            container=self.box, direction="IN", truck_plate="KAA 111A"
        )
        self.assertEqual(
            self.client.delete(f"/api/gate-events/{event.id}/").status_code, 405
        ) 