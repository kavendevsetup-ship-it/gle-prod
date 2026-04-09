from django.db import migrations, models


def sync_content_types_forward(apps, schema_editor):
    FreeContent = apps.get_model("matches", "FreeContent")
    for item in FreeContent.objects.all().only("id", "type"):
        content_type = item.type if item.type in {"pdf", "image", "text"} else "pdf"
        FreeContent.objects.filter(pk=item.pk).update(content_type=content_type)


def sync_content_types_backward(apps, schema_editor):
    FreeContent = apps.get_model("matches", "FreeContent")
    for item in FreeContent.objects.all().only("id", "content_type"):
        content_type = item.content_type if item.content_type in {"pdf", "image", "text"} else "pdf"
        FreeContent.objects.filter(pk=item.pk).update(type=content_type)


class Migration(migrations.Migration):

    dependencies = [
        ("matches", "0003_premiumcontent_content_type_video"),
    ]

    operations = [
        migrations.AlterField(
            model_name="freecontent",
            name="file",
            field=models.FileField(blank=True, null=True, upload_to="free_content/", verbose_name="File"),
        ),
        migrations.AlterField(
            model_name="freecontent",
            name="type",
            field=models.CharField(
                choices=[("pdf", "PDF"), ("image", "Image"), ("text", "Text")],
                default="pdf",
                max_length=10,
                verbose_name="Type",
            ),
        ),
        migrations.AddField(
            model_name="freecontent",
            name="content_type",
            field=models.CharField(
                choices=[("pdf", "PDF"), ("image", "Image"), ("text", "Text")],
                default="pdf",
                max_length=10,
                verbose_name="Content Type",
            ),
        ),
        migrations.AddField(
            model_name="freecontent",
            name="text_body",
            field=models.TextField(blank=True, null=True, verbose_name="Text Body"),
        ),
        migrations.AddField(
            model_name="freecontent",
            name="text_title",
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name="Text Title"),
        ),
        migrations.RunPython(sync_content_types_forward, sync_content_types_backward),
    ]
