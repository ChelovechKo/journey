from email.policy import default

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Max
from django.utils.timezone import now


class User(AbstractUser):
    id = models.AutoField(primary_key=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True) # User's image
    selected_icon = models.CharField(max_length=50, null=True, blank=True, default="fa fa-cat")
    selected_color = models.CharField(max_length=7, null=True, blank=True, default="#6c757d")

    def __str__(self):
        return f"{self.id}-{self.username}"


class MarkerCategory(models.Model):
    '''Dictionary of Marker's Categories'''
    id = models.AutoField(primary_key=True)
    category = models.CharField(max_length=100, unique=True)  # Name of Category (ex, 'Commercial and public places')

    def __str__(self):
        return f"{self.id}-{self.category}"


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
        return f"{self.id} - {self.category.category} - {self.key}:{self.value}"


class Route(models.Model):
    """Model for save Routes"""
    ROUTE_TYPES = [
        ('walking', 'Walking'),
        ('cycling', 'Cycling'),
        ('driving', 'Driving'),
    ]

    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="routes")
    created_at = models.DateTimeField(default=now, null=False, blank=False)

    name = models.CharField(max_length=255)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    #route_type = models.CharField(max_length=20, choices=ROUTE_TYPES, null=True, blank=True)
    rating = models.PositiveSmallIntegerField(null=True, blank=True, default=0)  # from 0 to 5
    distance = models.FloatField(null=True, blank=True)  # in meters
    duration = models.PositiveIntegerField(null=True, blank=True)  # in minutes
    price = models.FloatField(null=True, blank=True, default = 0)  # ??? convert ???
    difficulty = models.PositiveSmallIntegerField(null=True, blank=True, default=0)  # from 0 to 5
    description = models.TextField(blank=True)
    #elevation_gain = models.FloatField(null=True, blank=True)  # in meters
    isPlan = models.BooleanField(default=True)  # True - is in Plan, False - is Finished
    isDraft = models.BooleanField(default=False)  # True - is Draft, False - is Done
    isPublished = models.BooleanField(default=False)  # True - is Published, False - is not
    likes_count = models.PositiveIntegerField(default=0)
    bookmarks_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.id}-{self.name}"


class Place(models.Model):
    '''Model for save Places in the Routes'''
    id = models.AutoField(primary_key=True)
    order = models.PositiveIntegerField(blank=True, null=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="places")
    name = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    countryISO = models.CharField(max_length=2, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    address = models.CharField(max_length=200, null=True, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    #altitude = models.FloatField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    dt = models.DateTimeField(null=True, blank=True)
    isVisited = models.BooleanField(default=False)
    price = models.FloatField(null=True, blank=True, default=0)  # ??? convert ???
    category = models.ForeignKey(MarkerSubCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="places")
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="places", null=True, blank=True)

    def __str__(self):
        return f"RouteId={self.route_id}, id={self.id}, order={self.order}, name={self.name}"

    def save(self, *args, **kwargs):
        # auto order from 1 to ...
        if self.order is None:
            max_order = Place.objects.filter(route=self.route).aggregate(Max('order'))['order__max'] or 0
            self.order = max_order + 1
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['route_id', 'order'] # sorting


class Like(models.Model):
    """Model for user likes on routes"""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="likes")
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="likes")

    class Meta:
        unique_together = ('user', 'route')  # Ensures a user can like a route only once

    def __str__(self):
        return f"Like(id={self.id}, user={self.user}, route={self.route})"


class Bookmark(models.Model):
    """Model to store bookmarks for routes."""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookmarks")
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="bookmarks")

    class Meta:
        unique_together = ('user', 'route')  # Prevent duplicate bookmarks for the same user and route

    def __str__(self):
        return f"Bookmark(id={self.id}, user={self.user.username}, route={self.route.id})"
