from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib import messages
from django.db import IntegrityError
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.core.files.storage import default_storage
from django.utils import timezone
from django.utils.timezone import make_aware
from django.forms.models import model_to_dict
from django.db.models import F
from datetime import datetime
import json
import requests

from .models import User, Place, MarkerSubCategory, MarkerCategory, Route

def format_distance(distance):
    if not distance:
        return '?'

    km = int(distance // 1000)
    meters = round(distance % 1000)

    if km > 0:
        return f"{km} km {meters} m" if meters > 0 else f"{km} km"
    return f"{meters} m"


def format_duration(duration):
    if not duration:
        return '?'
    days = duration // 1440
    hours = (duration % 1440) // 60
    minutes = duration % 60
    result = []
    if days > 0:
        result.append(f"{days} days")
    if hours > 0:
        result.append(f"{hours} hours")
    if minutes > 0:
        result.append(f"{minutes} minutes")
    return ', '.join(result)


def index(request):
    return render(request, "diary/index.html")


def login_view(request):
    if request.method == "POST":

        # Attempt to sign user in
        username = request.POST["username"]
        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)

        # Check if authentication successful
        if user is not None:
            login(request, user)
            return HttpResponseRedirect(reverse("index"))
        else:
            return render(request, "diary/login.html", {
                "message": "Invalid username and/or password."
            })
    else:
        return render(request, "diary/login.html")


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("index"))


def register(request):
    ''' Users's registration '''
    if request.method == "POST":
        username = request.POST["username"]
        email = request.POST["email"]
        avatar = request.FILES.get("avatar")
        selected_icon = request.POST.get("selectedIconInput", "fa fa-cat")
        selected_color = request.POST.get("selectedColorInput", "#6c757d")

        # Ensure password matches confirmation
        password = request.POST["password"]
        confirmation = request.POST["confirmation"]
        if password != confirmation:
            return render(request, "diary/register.html", {
                "message": "Passwords must match."
            })

        # Attempt to create new user
        try:
            user = User.objects.create_user(username, email, password)
            if avatar:
                user.avatar = avatar
            else:
                user.selected_icon = selected_icon
                user.selected_color = selected_color
            user.save()
        except IntegrityError:
            return render(request, "diary/register.html", {
                "message": "Username already taken."
            })
        login(request, user)
        return HttpResponseRedirect(reverse("index"))
    else:
        return render(request, "diary/register.html")


def upload_avatar(request):
    '''For uploading an image as avatar'''
    if request.method == 'POST':
        uploaded_file = request.FILES['avatar']
        file_path = default_storage.save(f'avatars/{uploaded_file.name}', uploaded_file)
        return JsonResponse({'status': 'success', 'file_path': f'/media/{file_path}'})
    return JsonResponse({'status': 'error', 'message': 'No file uploaded'}, status=400)


@login_required
def profile(request):
    user = request.user

    if request.method == "POST":
        old_password = request.POST.get("old_password")
        new_password = request.POST.get("new_password")
        password_confirmation = request.POST.get("password_confirmation")
        avatar = request.FILES.get("avatar")
        selected_icon = request.POST.get("selectedIconInput")
        selected_color = request.POST.get("selectedColorInput")
        is_change_profile = False

        # renew User's Avatar
        if avatar:
            user.avatar = avatar
            user.selected_icon = None
            user.selected_color = None
            is_change_profile = True
        elif user.selected_icon:
            user.avatar = None
            user.selected_icon = selected_icon
            user.selected_color = selected_color
            is_change_profile = True

        # check and renew password
        if old_password or new_password or password_confirmation:
            if not old_password:
                messages.warning(request, "Please enter your old password.")
                return render(request, "diary/profile.html", {"user": user})
            elif not user.check_password(old_password):
                messages.warning(request, "Incorrect old password.")
                return render(request, "diary/profile.html", {"user": user})
            elif not new_password:
                messages.warning(request, "Please enter your new password.")
                return render(request, "diary/profile.html", {"user": user})
            elif new_password != password_confirmation:
                messages.warning(request, "New passwords do not match.")
                return render(request, "diary/profile.html", {"user": user})
            else:
                user.set_password(new_password)
                update_session_auth_hash(request, user) # renew user's session
                messages.success(request, "Password updated successfully.")

        if is_change_profile:
            user.save()
            messages.success(request, "Profile updated successfully.")

        return redirect("profile") # Redirect after successful update

    return render(request, "diary/profile.html", {"user": user})


@login_required
def my_places(request):
    # If exist -> created = True, if not -> created = False
    route, created = Route.objects.get_or_create(
        user=request.user,
        isDraft=True,
        defaults={'name': 'New Route', 'created_at': timezone.now()}
    )
    places = []

    # get route's places
    for place in Place.objects.filter(route=route).order_by('order'):
        place_data = model_to_dict(place)
        place_data["icon"] = MarkerSubCategory.objects.get(id=place.category_id).emoji if place.category_id else ""
        places.append(place_data)

    categories = MarkerCategory.objects.all()
    subCategories = MarkerSubCategory.objects.all()
    categories_data = list(MarkerSubCategory.objects.values("id", "value", "icon", "marker_color", "emoji"))

    return render(request, "diary/my_places.html", {
        "route": route,
        "places": places,
        "categories": categories,
        "subCategories": subCategories,
        "categories_data": json.dumps(categories_data)
    })


def reverse_geocode(request):
    lat = request.GET.get('lat')
    lon = request.GET.get('lon')

    if not lat or not lon:
        return JsonResponse({'error': 'Latitude and longitude are required'}, status=400)

    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
    headers = {
        "User-Agent": "Diary/1.0 (foo@example.com)",
        "Accept-Language": "en"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return JsonResponse(response.json())
    except requests.RequestException as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def delete_point_from_route(request, point_id):
    if request.method == "DELETE":
        try:
            places = []
            place = Place.objects.get(id=point_id)
            route = place.route
            place.delete()

            if not Place.objects.filter(route=route).exists():
                # reset order
                Place.objects.filter(route=route).update(order=F('order') - F('order') + 1)
            else:
                # renew place's order
                points = Place.objects.filter(route=route).order_by('order')
                for index, point in enumerate(points, start=1):
                    point.order = index
                    point.save()

                route = Route.objects.filter(user=request.user, isDraft=True).first()

                for place in Place.objects.filter(route=route).order_by('order'):
                    place_data = model_to_dict(place)
                    place_data["icon"] = MarkerSubCategory.objects.get(
                        id=place.category_id).emoji if place.category_id else ""
                    places.append(place_data)

            return JsonResponse({'success': True, 'message': 'Point deleted successfully.', "places": places})
        except Place.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Point does not exist'})
    else:
        return JsonResponse({'success': False, 'error': 'Invalid request method'})


@login_required
def add_point_to_route(request):
    '''After push the AddPointToRoute button'''
    if request.method == "POST":
        data = request.POST
        user = request.user
        category_id = int(data.get('placeCategoryId')) if data.get('placeCategoryId') else None
        dt = timezone.make_aware(datetime.strptime(data.get('placeDt'), "%Y-%m-%dT%H:%M"))

        # Add Route
        # If exist -> created = True, if not -> created = False
        route, created = Route.objects.get_or_create(
            user=user,
            isDraft=True,
            defaults={'name': 'New Route', 'created_at': timezone.now()}
        )

        # Add New Point
        place = Place.objects.create(
            route=route,
            user=user,
            name=data.get('placeName', 'New Point'),
            latitude=float(data.get('placeLatitude')) if data.get('placeLatitude') else None,
            longitude=float(data.get('placeLongitude')) if data.get('placeLongitude') else None,
            #altitude=float(data.get('placeAltitude')) if data.get('placeAltitude') else None,
            country=data.get('placeCountryName'),
            countryISO=data.get('placeCountryISO'),
            city=data.get('placeCityName'),
            dt=dt,
            description=data.get('placeDescription'),
            isVisited=data.get('placeIsVisited') == "on" if data.get('placeIsVisited') else False,
            price=float(data.get('placePrice')) if data.get('placePrice') else 0,
            category=MarkerSubCategory.objects.get(pk=category_id) if data.get('placeCategoryId') else None,
            address=data.get('placeAddress')
        )

        place_info = model_to_dict(place)
        place_info["icon"] = MarkerSubCategory.objects.get(id=place.category_id).emoji if place.category_id else ""

        # Return new Point for update route-main-block
        return JsonResponse({'success': True, 'place_info': place_info, 'route_info': model_to_dict(route)})
    return JsonResponse({'success': False, 'error': 'Invalid request'})


@login_required
def get_point(request, point_id):
    try:
        place = Place.objects.get(id=point_id, route__user=request.user)
        data = {
            'id': place.id,
            'name': place.name,
            'longitude': place.longitude,
            'latitude': place.latitude,
            'description': place.description,
            'dt': place.dt.strftime("%Y-%m-%dT%H:%M") if place.dt else '',
            'category_id': place.category_id,
            'country': place.country,
            'countryISO': place.countryISO,
            'city': place.city,
            #'altitude': place.altitude,
            'address': place.address,
            'isVisited': place.isVisited,
            'price': place.price
        }
        return JsonResponse({'success': True, 'place': data})
    except Place.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Place not found'})


def update_point(request, point_id):
    if request.method == 'POST':
        try:
            place = Place.objects.get(id=point_id, route__user=request.user)
            place.name = request.POST.get('placeName')
            place.dt = request.POST.get('placeDt')
            place.description = request.POST.get('placeDescription')
            place.isVisited = request.POST.get('placeIsVisited') == 'on'
            place.price = request.POST.get('placePrice') if request.POST.get('placePrice') else 0
            place.save()

            print(f'place.price={place.price}')

            return JsonResponse({'success': True, 'place': {'id': place.id, 'name': place.name, 'isVisited': place.isVisited, 'order': place.order, 'price': place.price}})
        except Place.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Place not found'})
    return JsonResponse({'success': False, 'error': 'Invalid request method'})


@login_required
def update_point_order(request):
    if request.method == 'POST':
        try:
            # get data
            data = json.loads(request.body)
            point_order = data.get('order', [])

            # Map point IDs to new orders
            order_mapping = {item['id']: item['order'] for item in point_order}

            # Update points in the database
            for point_id, new_order in order_mapping.items():
                Place.objects.filter(id=point_id).update(order=new_order)

            route = Route.objects.filter(user=request.user, isDraft=True).first()
            places = []
            for place in Place.objects.filter(route=route).order_by('order'):
                place_data = model_to_dict(place)
                place_data["icon"] = MarkerSubCategory.objects.get(id=place.category_id).emoji if place.category_id else ""
                places.append(place_data)

            return JsonResponse({'success': True, "places": places})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)

    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)


@login_required
def save_route(request):
    if request.method == 'POST':
        try:
            route_id = request.POST.get('routeId')
            distance = request.POST.get('distance')
            duration = request.POST.get('duration')
            price = request.POST.get('price')

            route = Route.objects.get(id=route_id)
            points = Place.objects.filter(route=route).order_by('order')
            start_point = points.first()
            end_point = points.last()

            # update route info
            route.name = start_point.name + ' - ' + end_point.name
            route.start_date = start_point.dt
            route.end_date = end_point.dt
            route.distance = float(distance) if distance else 0
            route.duration = float(duration) if duration else 0
            route.price = float(price) if price else 0
            route.isDraft = False
            route.save()

            return redirect('route_detail', route_id=route.id)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)

    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)


def route_detail(request, route_id):
    route = Route.objects.get(id=route_id)
    tmp_route = model_to_dict(route)
    tmp_route['form_distance'] = format_distance(route.distance)
    tmp_route['form_duration'] = format_duration(route.duration)
    tmp_route['price'] = tmp_route['price'] if tmp_route['price'] else 0

    places = Place.objects.filter(route=route).order_by('order')

    is_owner = request.user.is_authenticated and route.user == request.user

    user = model_to_dict(User.objects.get(id=route.user.id))

    return render(request, "diary/route_detail.html", {
        "route": tmp_route,
        "places": places,
        'is_owner': is_owner,
        "user_info": user,
        "user": request.user
    })


def routes_view(request, view_type):
    # what typ select
    title = ''
    if view_type == 'my_routes' and request.user.is_authenticated:
        routes = Route.objects.filter(user=request.user).order_by('-created_at')
        title = 'My Routes'
    elif view_type == 'all_routes':
        routes = Route.objects.filter(isPublished=True).order_by('-created_at')
        title = 'All Routes'

    processed_routes = []
    for route in routes:
        tmp_route = model_to_dict(route)
        tmp_route['form_distance'] = format_distance(route.distance)
        tmp_route['form_duration'] = format_duration(route.duration)
        tmp_route['price'] = tmp_route['price'] if tmp_route['price'] else 0
        tmp_route['user'] = model_to_dict(User.objects.get(id=route.user.id))
        tmp_route['is_owner'] = request.user.is_authenticated and route.user.id == request.user.id
        processed_routes.append(tmp_route)

    return render(request, 'diary/routes.html', {
        'routes': processed_routes,
        'title': title,
    })


@login_required
def apply_route_changes(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            route_id = data.get('routeId')

            route = Route.objects.get(id=route_id)

            route.name = data.get('name')
            route.start_date = make_aware(datetime.strptime(data.get('startDate'), "%Y-%m-%dT%H:%M"))
            route.end_date = make_aware(datetime.strptime(data.get('endDate'), "%Y-%m-%dT%H:%M"))
            route.rating = data.get('rating')
            route.difficulty = data.get('difficulty')
            route.description = data.get('description')
            route.isPlan = data.get('isPlan')
            route.isPublished = data.get('isPublished')

            # log_data ={"name": data.get('name'), "start_date": make_aware(datetime.strptime(data.get('startDate'), "%Y-%m-%dT%H:%M")), "end_date": make_aware(datetime.strptime(data.get('endDate'), "%Y-%m-%dT%H:%M")), "rating": data.get('rating'), "difficulty": data.get('difficulty'), "description": data.get('description'), "isPlan": data.get('isPlan'), "isPublished": data.get('isPublished')}
            # print(f"log_data={log_data}")

            route.save()

            return JsonResponse({'success': True, 'message': 'Route saved successfully!'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)

    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)

@login_required
def delete_route(request, route_id):
    if request.method == "DELETE":
        try:
            route = Route.objects.get(id=route_id, user=request.user)
            route.delete()
            return JsonResponse({'success': True, 'message': 'Route deleted successfully!'})
        except Route.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Route not found.'})
    return JsonResponse({'success': False, 'error': 'Invalid request method.'}, status=400)