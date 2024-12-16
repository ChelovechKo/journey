// Add and Edit Point on the User's Map
function myPlaces(){
    const map = L.map("map").setView([51.505, -0.09], 2);  // Init Map
    const markers = [];
    const categoryIcons = {};
    const categoriesData = JSON.parse(document.getElementById("categories-data").textContent);
    const LegendToggleBtn = document.getElementById('legend-toggle-btn');
    const mapLegend = document.getElementById('map-legend');
    const mapContainer = document.getElementById('map-container');
    const mapElement = document.getElementById('map');

    let isLegendVisible = true;
    let hideTimeout;

    // location determination
    function locateUser() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(function (position) {
                    const userLat = position.coords.latitude;
                    const userLng = position.coords.longitude;

                    // Smoothly zooms to your current location
                    map.flyTo([userLat, userLng], 13, {
                        duration: 2, // Animation duration
                        easeLinearity: 0.25 // Smoothness of animation
                    });
                }, function () {}
            );
        }
    }

    // Collect Categories From HTML template
    function collectCategoriesFromHTML() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="category-"]');
        return Array.from(checkboxes).filter(checkbox => checkbox.checked).map(checkbox => {
            const categoryId = checkbox.id.replace("category-", "");
            const parts = categoryId.split(":");
            return {
                key: parts[0],
                value: parts[1]
            };
        });
    }

    // Checkbox Handle
    function handleCheckboxChange() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="category-"]');

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener("change", () => {
                updateMapWithOSMData();
            });
        });
    }

    // Collect places in new bounds
    async function fetchPlacesFromOSM(categories, bounds) {
        const overpassUrl = "https://overpass-api.de/api/interpreter";
        // Visible bounds
        const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

        // Active Categories
        const activeCategories = categories.filter(category => {
            const checkbox = document.getElementById(`category-${category.key}:${category.value}`);
            return checkbox && checkbox.checked;
        });

        if (activeCategories.length === 0) {
            return [];
        }

        // Create query
        const categoryQueries = activeCategories.map(category => {
            return `node["${category.key}"="${category.value}"](${bbox});`;
        }).join("\n");

        const query = `
            [out:json];
            (
              ${categoryQueries}
            );
            out body;
        `;

        try {
            const response = await fetch(overpassUrl, {
                method: "POST",
                body: query,
                headers: { "Content-Type": "text/plain" }
            });

            const data = await response.json();
            return data.elements.map(el => ({
                id: el.id,
                lat: el.lat,
                lng: el.lon,
                name: el.tags.name || "Unnamed Location",
                category: el.tags
            }));
        } catch (err) {
            console.error("Error fetching data from Overpass API:", err);
            return [];
        }
    }

    // Renew markers, when map is moved
    function updateMapWithOSMData() {
        const categories = collectCategoriesFromHTML(); // Collect categories from checkboxes
        const bounds = map.getBounds(); // get current bounds

        // Collect places in new bounds
        fetchPlacesFromOSM(categories, bounds).then(places => {
            // reset old markers
            markers.forEach(marker => map.removeLayer(marker));
            markers.length = 0;

            // add new markers
            places.forEach(place => {
                const categoryKey = Object.keys(place.category).find(key => categoryIcons[place.category[key]]);
                const icon = categoryIcons[place.category[categoryKey]] || L.AwesomeMarkers.icon({ prefix: 'fa', icon: 'map-marker', markerColor: 'gray' });
                const marker = L.marker([place.lat, place.lng], {icon: icon, id: place.category[categoryKey] });

                marker.bindPopup(`<b>${place.name}</b><br>Category: ${place.category[categoryKey]}`);
                marker.addTo(map);
                markers.push(marker);
            });
        });
    }

    // Show ToggleLegendBtn
    function showToggleLegendBtn() {
        LegendToggleBtn.style.visibility = "visible";
        LegendToggleBtn.style.opacity = "1";
        clearTimeout(hideTimeout); // Clean Timer
    }

    // Hide ToggleLegendBtn
    function hideToggleLegendBtn() {
        if(isLegendVisible){
            hideTimeout = setTimeout(() => {
                LegendToggleBtn.style.opacity = "0";
                LegendToggleBtn.style.visibility = "hidden";
            }, 500);
        }
    }

    //Hide/Show Map Legend Handle
    function hideShowMapLegend(){
        if (isLegendVisible) {
            // Hide Legend
            mapLegend.classList.add('hidden');
            LegendToggleBtn.querySelector('i').classList.remove('fa-chevron-right');
            LegendToggleBtn.querySelector('i').classList.add('fa-chevron-left');
            mapContainer.classList.remove('col-md-9');
            mapContainer.classList.add('col-md-12');
        } else {
            // Show Legend
            mapLegend.classList.remove('hidden');
            LegendToggleBtn.querySelector('i').classList.remove('fa-chevron-left');
            LegendToggleBtn.querySelector('i').classList.add('fa-chevron-right');
            mapContainer.classList.remove('col-md-12');
            mapContainer.classList.add('col-md-9');
        }

        isLegendVisible = !isLegendVisible;

        setTimeout(() => {
            map.invalidateSize();
        }, 300);
    }

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Fill categoryIcons
    categoriesData.forEach(category => {
        categoryIcons[category.value] = L.AwesomeMarkers.icon({
            icon: category.icon,
            prefix: "fa",
            markerColor: category.marker_color
        });
    });

    locateUser(); // user location determination
    updateMapWithOSMData(); // init markers

    // Checkbox Handle
    handleCheckboxChange();

    // Map Handle
    map.on("moveend", () => {updateMapWithOSMData();});

    // Hide/Show ToggleLegendBtn
    mapLegend.addEventListener("mouseenter", showToggleLegendBtn);
    mapLegend.addEventListener("mouseleave", hideToggleLegendBtn);

    // Hide/Show Map Legend Handle
    LegendToggleBtn.addEventListener("mouseenter", showToggleLegendBtn);
    LegendToggleBtn.addEventListener("mouseleave", hideToggleLegendBtn);

    LegendToggleBtn.addEventListener('click', hideShowMapLegend);
}

// Changing Avatar's icon. Page Register and Profile
function avatarEditing(){
    // preview click Handle
    function updateAvatarImage(input, avatarPreview) {
        const file = input.files[0];
        const avatarIcon = document.getElementById("avatarIcon"); // default icon

        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                avatarPreview.src = e.target.result;
                avatarPreview.style.display = "block"; // show img
                avatarIcon.style.display = "none"; // hide icon
            };
            reader.readAsDataURL(file);
        }
    }

    // animal click Handle
    function updateAnimalPreview(icon, avatarIcon, avatarPreview) {
        const newIcon = icon.getAttribute("data-animal");
        const currentColor = document.querySelector(".selected-color").getAttribute("data-color");

        resetSelection(document.querySelectorAll(".animal-icon"), "selected-icon"); // reset selected animal icon

        // renew preview (animal + color)
        icon.classList.add("selected-icon");
        avatarIcon.className = newIcon;
        avatarIcon.style.color = currentColor;

        avatarIcon.style.display = "block"; // show icon
        avatarPreview.style.display = "none"; // hide img

        // renew hidden input
        document.getElementById("selectedIconInput").value = newIcon;
    }

    // color click Handle
    function updateAvatarColor(option, avatarPreview) {
        const newColor = option.getAttribute("data-color");
        const selectedAnimal = document.querySelector(".selected-icon i");

        avatarPreview.style.color = newColor; // renew color on preview
        document.getElementById("selectedColorInput").value = newColor;
        if (selectedAnimal) selectedAnimal.style.color = newColor; // renew animal icons color

        // renew selected color
        resetSelection(document.querySelectorAll(".color-icon"), "selected-color");
        option.classList.add("selected-color");
    }

    // reset selection
    function resetSelection(elements, className) {
        elements.forEach(el => el.classList.remove(className));
    }

    const avatarInput = document.getElementById('avatarInput');
    const colorIcons = document.querySelectorAll(".color-icon"); // colors
    const animalIcons = document.querySelectorAll(".animal-icon"); // animals
    const avatarIcon = document.getElementById("avatarIcon");
    const avatarPreview = document.getElementById("avatarPreview"); // avatar

    // color click Handle
    if(colorIcons){
        colorIcons.forEach(color => {
            color.addEventListener("click", () => {
                    updateAvatarColor(color, avatarIcon);
            });
        });
    }
    // animal click Handle
    if(animalIcons){
        animalIcons.forEach(animal => {
            animal.addEventListener("click", () => {
                updateAnimalPreview(animal, avatarIcon, avatarPreview);
            });
        });
    }
    // preview click Handle
    if (avatarInput){
        avatarInput.addEventListener('change', function () {
            updateAvatarImage(this, avatarPreview);
        });
    }
}

// main
document.addEventListener('DOMContentLoaded', function() {
    const currentUrl = window.location.href; // current page url

    if(currentUrl.includes('profile') || currentUrl.includes('register')){
        avatarEditing();
    } else if(currentUrl.includes('my-places')) {
        myPlaces();
    }
});