from django.contrib import admin

from .models import User, Place, Route, MarkerSubCategory, MarkerCategory, Like, Bookmark

admin.site.register(User)
admin.site.register(Place)
admin.site.register(Route)
admin.site.register(MarkerSubCategory)
admin.site.register(MarkerCategory)
admin.site.register(Like)
admin.site.register(Bookmark)