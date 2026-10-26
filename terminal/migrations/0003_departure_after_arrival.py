from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("terminal", "0002_tariff_container_arrived_at"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="vesselcall",
            constraint=models.CheckConstraint(
                condition=models.Q(("etd__gt", models.F("eta"))),
                name="vesselcall_departure_after_arrival",
            ),
        ),
    ] 