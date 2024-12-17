# Generated by Django 5.1.4 on 2024-12-16 06:54

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('diary', '0007_markercategory'),
    ]

    operations = [
        migrations.RenameField(
            model_name='markercategory',
            old_name='name',
            new_name='category',
        ),
        migrations.RemoveField(
            model_name='markercategory',
            name='icon',
        ),
        migrations.RemoveField(
            model_name='markercategory',
            name='key',
        ),
        migrations.RemoveField(
            model_name='markercategory',
            name='marker_color',
        ),
        migrations.RemoveField(
            model_name='markercategory',
            name='value',
        ),
        migrations.AlterField(
            model_name='markercategory',
            name='id',
            field=models.AutoField(primary_key=True, serialize=False),
        ),
        migrations.CreateModel(
            name='MarkerSubCategory',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('key', models.CharField(max_length=50)),
                ('value', models.CharField(max_length=50)),
                ('icon', models.CharField(max_length=50)),
                ('marker_color', models.CharField(default='blue', max_length=20)),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subcategories', to='diary.markercategory')),
            ],
        ),
    ]