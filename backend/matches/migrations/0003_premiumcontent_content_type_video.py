from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("matches", "0002_premiumcontent_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="premiumcontent",
            name="content_type",
            field=models.CharField(
                choices=[("text", "Text"), ("image", "Image"), ("video", "Video")],
                default="text",
                max_length=10,
                verbose_name="Content Type",
            ),
        ),
        migrations.AddField(
            model_name="premiumcontent",
            name="video",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="premium_videos/",
                verbose_name="Video",
            ),
        ),
        migrations.AlterField(
            model_name="premiumcontent",
            name="description",
            field=models.TextField(blank=True, default="", verbose_name="Expert Analysis"),
        ),
        migrations.AlterField(
            model_name="premiumcontent",
            name="title",
            field=models.CharField(blank=True, default="", max_length=255, verbose_name="Title"),
        ),
    ]
