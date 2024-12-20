from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("register", views.register, name="register"),
    path("upload-avatar/", views.upload_avatar, name='upload-avatar'),
    path("profile/", views.profile, name="profile"),
    path("my-places/", views.my_places, name="my-places"),
    path('api/reverse-geocode/', views.reverse_geocode, name='reverse_geocode'),
    path('add_point_to_route/', views.add_point_to_route, name='add_point_to_route'),
    path('delete_point_from_route/<int:point_id>/', views.delete_point_from_route, name='delete_point_from_route'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)