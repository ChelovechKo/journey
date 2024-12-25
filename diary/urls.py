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
    path('get_point/<int:point_id>/', views.get_point, name='get_point'),
    path('update_point/<int:point_id>/', views.update_point, name='update_point'),
    path('update_point_order/', views.update_point_order, name='update_point_order'),
    path("save_route/", views.save_route, name="save_route"),
    path('route/<int:route_id>/', views.route_detail, name='route_detail'),
    path('routes/<str:view_type>/', views.routes_view, name='routes_view'),
    path('apply_route_changes/', views.apply_route_changes, name='apply_route_changes'),
    path('delete_route/<int:route_id>/', views.delete_route, name='delete_route'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)