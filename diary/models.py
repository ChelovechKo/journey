from enum import unique

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    id = models.AutoField(primary_key=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True) # User's image
    selected_icon = models.CharField(max_length=50, null=True, blank=True, default="fa fa-cat")
    selected_color = models.CharField(max_length=7, null=True, blank=True, default="#6c757d")

    def __str__(self):
        return self.username

class Place(models.Model):
    '''User's point on the map'''
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="places")
    name = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    city = models.CharField(max_length=100, null=True, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    altitude = models.FloatField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    datetime = models.DateTimeField(null=True, blank=True)
    is_visited = models.BooleanField(default=False)
    category = models.CharField(max_length=50, default='default')  # marker icon

    def __str__(self):
        return f"{self.name} - {self.category}"

class MarkerCategory(models.Model):
    '''Dictionary of Marker's Categories'''
    id = models.AutoField(primary_key=True)
    category = models.CharField(max_length=100, unique=True)  # Name of Category (ex, 'Commercial and public places')

    def __str__(self):
        return self.category

class MarkerSubCategory(models.Model):
    '''Dictionary of Marker's Sub Categories'''
    id = models.AutoField(primary_key=True)
    category = models.ForeignKey(MarkerCategory, on_delete=models.CASCADE, related_name='subcategories')
    key = models.CharField(max_length=50)  # Key for Overpass API (ex, 'amenity')
    value = models.CharField(max_length=50)  # Value for Overpass API (ex, 'hotel')
    icon = models.CharField(max_length=50)  # Icon for marker (ex, 'hotel', 'tree')
    marker_color = models.CharField(max_length=20, default='blue')  # Color for marker (ex, 'red', 'blue')

    def __str__(self):
        return f"{self.category.category} - {self.key}:{self.value}"