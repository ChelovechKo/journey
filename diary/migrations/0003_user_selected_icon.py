# Generated by Django 5.1.4 on 2024-12-11 12:22

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('diary', '0002_user_avatar_alter_user_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='selected_icon',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
