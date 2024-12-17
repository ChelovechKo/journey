from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib import messages
from django.db import IntegrityError
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import render, redirect
from django.urls import reverse
from django.core.files.storage import default_storage
from django.utils import timezone
import json
import requests

from .models import User, Place, MarkerSubCategory, MarkerCategory


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
        new_username = request.POST.get("username")
        old_password = request.POST.get("old_password")
        new_password = request.POST.get("new_password")
        password_confirmation = request.POST.get("password_confirmation")
        avatar = request.FILES.get("avatar")
        selected_icon = request.POST.get("selectedIconInput")
        selected_color = request.POST.get("selectedColorInput")
        isChangeProfile = False

        # renew User's Name
        if new_username and new_username != user.username:
            user.username = new_username
            isChangeProfile = True

        # renew User's Avatar
        if avatar:
            user.avatar = avatar
            user.selected_icon = None
            user.selected_color = None
            isChangeProfile = True
        elif user.selected_icon:
            user.avatar = None
            user.selected_icon = selected_icon
            user.selected_color = selected_color
            isChangeProfile = True

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

        if isChangeProfile:
            user.save()
            messages.success(request, "Profile updated successfully.")

        return redirect("profile") # Redirect after successful update

    return render(request, "diary/profile.html", {"user": user})

@login_required
def my_places(request):
    '''Save User Places'''
    places = Place.objects.all()  # Get all places
    places_list = list(places.values("name", "latitude", "longitude", "country", "city"))
    places_json = json.dumps(places_list)

    categories = MarkerCategory.objects.all()
    subCategories = MarkerSubCategory.objects.all()

    categories_data = list(MarkerSubCategory.objects.values("value", "icon", "marker_color", "emoji"))
    return render(request, "diary/my_places.html", {
        "places": places_json,
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