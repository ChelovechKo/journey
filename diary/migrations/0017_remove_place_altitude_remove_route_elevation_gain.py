# Generated by Django 5.1.4 on 2024-12-23 07:35

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('diary', '0016_alter_place_order'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='place',
            name='altitude',
        ),
        migrations.RemoveField(
            model_name='route',
            name='elevation_gain',
        ),
    ]
