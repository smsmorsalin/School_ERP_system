from django.db import migrations, models


def rename_grade_classes(apps, schema_editor):
    SchoolClass = apps.get_model("academics", "SchoolClass")
    for school_class in SchoolClass.objects.filter(name__startswith="Grade "):
        suffix = school_class.name.removeprefix("Grade ")
        replacement = f"Class {suffix}"
        if not SchoolClass.objects.filter(name=replacement).exclude(pk=school_class.pk).exists():
            school_class.name = replacement
            school_class.save(update_fields=["name"])


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="schoolclass",
            name="name",
            field=models.CharField(
                help_text="e.g. Class 1",
                max_length=100,
                unique=True,
            ),
        ),
        migrations.AlterField(
            model_name="section",
            name="name",
            field=models.CharField(
                default="A",
                help_text="e.g. A, B, Blue",
                max_length=20,
            ),
        ),
        migrations.RunPython(rename_grade_classes, migrations.RunPython.noop),
    ]
