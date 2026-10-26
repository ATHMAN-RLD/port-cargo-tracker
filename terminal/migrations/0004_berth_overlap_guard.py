from django.db import migrations

CONSTRAINT = "no_overlapping_berth_bookings"


def add_guard(apps, schema_editor):
    # Exclusion constraints exist only in PostgreSQL. On SQLite (the fallback
    # database) we skip this step, and the Python clean() check still applies.
    if schema_editor.connection.vendor != "postgresql":
        return
    # btree_gist lets one constraint compare a plain number (the berth)
    # and a time range together.
    schema_editor.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    schema_editor.execute(
        f"""
        ALTER TABLE terminal_vesselcall
        ADD CONSTRAINT {CONSTRAINT}
        EXCLUDE USING gist (
            berth_id WITH =,
            tstzrange(eta, etd, '[)') WITH &&
        )
        """
    )


def remove_guard(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(
        f"ALTER TABLE terminal_vesselcall DROP CONSTRAINT IF EXISTS {CONSTRAINT}"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("terminal", "0003_departure_after_arrival"),
    ]

    operations = [
        migrations.RunPython(add_guard, remove_guard),
    ] 