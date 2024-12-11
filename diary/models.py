from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    id = models.AutoField(primary_key=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True) # User's image
    selected_icon = models.CharField(max_length=50, null=True, blank=True)  # Default icon
    selected_color = models.CharField(max_length=7, null=True, blank=True)  # Default color

    def __str__(self):
        return self.username