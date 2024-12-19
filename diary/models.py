from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    id = models.AutoField(primary_key=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True) # User's image
    selected_icon = models.CharField(max_length=50, null=True, blank=True, default="fa fa-cat")
    selected_color = models.CharField(max_length=7, null=True, blank=True, default="#6c757d")

    def __str__(self):
        return self.username


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
    value = models.CharField(max_length=50, unique=True)  # Value for Overpass API (ex, 'hotel')
    icon = models.CharField(max_length=50)  # Icon for marker (ex, 'hotel', 'tree')
    marker_color = models.CharField(max_length=20, default='blue')  # Color for marker (ex, 'red', 'blue')
    emoji = models.CharField(max_length=10, null=True, blank=True)

    def __str__(self):
        return f"{self.category.category} - {self.key}:{self.value}"


class Route(models.Model):
    """Model for save Routes"""
    ROUTE_TYPES = [
        ('walking', 'Walking'),
        ('cycling', 'Cycling'),
        ('driving', 'Driving'),
    ]

    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="routes")
    created_at = models.DateTimeField(auto_now_add=True)

    name = models.CharField(max_length=255)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    route_type = models.CharField(max_length=20, choices=ROUTE_TYPES, null=True, blank=True)
    rating = models.PositiveSmallIntegerField(null=True, blank=True) # from 1 to 5
    distance = models.FloatField(null=True, blank=True)  # in meters
    duration = models.PositiveIntegerField(null=True, blank=True)  # in minutes
    cost = models.FloatField(null=True, blank=True) # ??? convert ???
    difficulty = models.PositiveSmallIntegerField(null=True, blank=True) # from 1 to 5
    description = models.TextField(blank=True)
    elevation_gain = models.FloatField(null=True, blank=True)  # in meters
    isPlan = models.BooleanField(default=True) # True - is in Plan, False - is Finished
    isDraft = models.BooleanField(default=False) # True - is Draft, False - is Done
    isPublished = models.BooleanField(default=False) # True - is Published, False - is not

    def __str__(self):
        return self.name


class Place(models.Model):
    '''Model for save Places in the Routes'''
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="places")
    name = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    countryISO = models.CharField(max_length=2, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    altitude = models.FloatField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    dt = models.DateTimeField(null=True, blank=True)
    isVisited = models.BooleanField(default=False)
    cost = models.FloatField(null=True, blank=True)  # ??? convert ???
    category = models.ForeignKey(MarkerSubCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="places")
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="places", null=True, blank=True)

    def __str__(self):
        return f"{self.name}"
