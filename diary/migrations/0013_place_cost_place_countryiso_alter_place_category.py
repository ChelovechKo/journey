# Generated by Django 5.1.4 on 2024-12-19 13:54

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('diary', '0012_rename_datetime_place_dt_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='place',
            name='cost',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='place',
            name='countryISO',
            field=models.CharField(blank=True, max_length=2, null=True),
        ),
        migrations.AlterField(
            model_name='place',
            name='category',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='places', to='diary.markersubcategory'),
        ),
    ]
