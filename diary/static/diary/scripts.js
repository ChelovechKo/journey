const markers = [];

// location determination
function locateUser(map) {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function (position) {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;

                // Smoothly zooms to your current location
                map.flyTo([userLat, userLng], 13, {
                    duration: 2, // Animation duration
                    easeLinearity: 0.25 // Smoothness of animation
                });
            }, function () {
            }
        );
    }
}

//Get uniq categories
async function getCategories() {
    const overpassUrl = "https://overpass-api.de/api/interpreter"; // Overpass API URL

    const query = `
    [out:json];
    (
      node["amenity"](51.5,-0.2,51.6,-0.1);
      node["leisure"](51.5,-0.2,51.6,-0.1);
      node["natural"](51.5,-0.2,51.6,-0.1);
      node["historic"](51.5,-0.2,51.6,-0.1);
    );
    out body;`;

    try {
        const response = await fetch(overpassUrl, {
            method: "POST",
            body: query,
            headers: { "Content-Type": "text/plain" }
        });

        const data = await response.json();
        const elements = data.elements;

        // Collect unique categories from tags
        const categories = {};
        const excludedCategories = ["note", "name", "capacity", "operator", "opening_hours", "ref", "phone"]; // Categories for excluded

        elements.forEach(el => {
            const keys = Object.keys(el.tags);
            keys.forEach(key => {
                if (!excludedCategories.includes(key) && !key.includes("recycling") && !key.includes("currency") && !key.includes("wikidata") && !key.includes("addr") && !key.includes("fhrs") && !key.includes("payment")) { // for excluded
                    if (!categories[key]) categories[key] = new Set();
                    categories[key].add(el.tags[key]);
                }
            });
        });

        // Save to categoryList
        const categoryList = Object.keys(categories);
        return categoryList;
    } catch (err) {
        console.error("Error while receiving data:", err);
        return [];
    }
}

// Checkbox Handle
function handleCheckboxChange(map) {
    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="category-"]');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener("change", () => {
            updateMapWithOSMData(map); // Обновляем маркеры на карте
        });
    });
}

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
        console.warn("No active categories selected.");
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

function updateMapWithOSMData(map) {
    const categories = collectCategoriesFromHTML(); // Collect categories from checkboxes
    const bounds = map.getBounds(); // get current bounds

    fetchPlacesFromOSM(categories, bounds).then(places => {
        // reset old markers
        markers.forEach(marker => map.removeLayer(marker));
        markers.length = 0;

        // add new markers
        places.forEach(place => {
            const marker = L.marker([place.lat, place.lng], { id: place.category.key });
            marker.bindPopup(`<b>${place.name}</b><br>Category: ${place.category}`);
            marker.addTo(map);
            markers.push(marker);
        });
    });
}

// Add and Edit Point on the User's Map
function myPlaces(){
    const map = L.map("map").setView([51.505, -0.09], 2);  // Init Map

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    locateUser(map); // user location determination
    updateMapWithOSMData(map); // init markers

    // Checkbox Handle
    handleCheckboxChange(map);

    // Map Handle
    map.on("moveend", () => {
        updateMapWithOSMData(map);
    });

    // get Categories
    /*getCategories()
        .then(categoryList => {
            console.log(categoryList);

            // Generate checkbox
            //generateCheckboxes(categoryList);
        })
        .catch(err => {
            console.error("Error while receiving categories:", err);
        });
    */
    //generateCheckboxes(categoryList); // Generate checkbox
}

// reset selection
function resetSelection(elements, className) {
    elements.forEach(el => el.classList.remove(className));
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

document.addEventListener('DOMContentLoaded', function() {
    const avatarInput = document.getElementById('avatarInput');
    const colorIcons = document.querySelectorAll(".color-icon"); // colors
    const animalIcons = document.querySelectorAll(".animal-icon"); // animals
    const avatarIcon = document.getElementById("avatarIcon");
    const avatarPreview = document.getElementById("avatarPreview"); // avatar

    const currentUrl = window.location.href; // current page url

    // color click Handle
    if(colorIcons){
        colorIcons.forEach(color => {color.addEventListener("click", () => {updateAvatarColor(color, avatarIcon);});});
    }
    // animal click Handle
    if(animalIcons){
        animalIcons.forEach(animal => {animal.addEventListener("click", () => {updateAnimalPreview(animal, avatarIcon, avatarPreview);});});
    }
    // preview click Handle
    if (avatarInput){
        avatarInput.addEventListener('change', function () {updateAvatarImage(this, avatarPreview);});
    }

    if (currentUrl.includes('my-places')) {
        myPlaces();
    }
});