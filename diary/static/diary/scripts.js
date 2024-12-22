let editingPlaceId = null;

function getCSRFToken() {
    const csrfToken = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return csrfToken ? csrfToken.value : '';
}

// Add and Edit Point on the User's Map
function myPlaces(){
    const map = L.map("map").setView([51.505, -0.09], 2);  // Init Map
    const markers = [];
    const categoryIcons = {};
    const categoriesData = JSON.parse(document.getElementById("categories-data").textContent);
    const LegendToggleBtn = document.getElementById('legend-toggle-btn');
    const mapLegend = document.getElementById('map-legend');
    const toggleButtons = document.querySelectorAll(".btn-toggle");
    const placeForm = document.getElementById('place-form');
    const routePoints = document.getElementById('route-points');
    const submitPlaceButton = placeForm.querySelector('button[type="submit"]');
    const editButton = document.getElementById("edit-name-btn")
    const nameInputEl = document.getElementById('place-name');
    const nameDisplayEl = document.getElementById("place-name-display");
    const getDirectionButton = document.getElementById('get-direction-btn');
    let userMapMarkers = [];

    let isLegendVisible = true;
    let hideTimeout;

    // Get Direction
    function buildRoute() {
        // Collect
        const points = Array.from(routePoints.querySelectorAll('.point-item')).map(item => ({
            latitude: parseFloat(item.getAttribute('data-latitude')),
            longitude: parseFloat(item.getAttribute('data-longitude')),
            order: parseInt(item.getAttribute('data-order'))
        }));

        // Sort places
        points.sort((a, b) => a.order - b.order);

        if (points.length < 2) {
            alert("Please add at least two points to build a route.");
            return;
        }

        // Format waypoints
        const waypoints = points.map(point => L.latLng(point.latitude, point.longitude));

        // Clean last route
        if (window.currentRoute) {
            map.removeControl(window.currentRoute);
        }

        // Add Route with Leaflet Routing Machine
        window.currentRoute = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: true,
            lineOptions: {
                styles: [{ color: 'blue', weight: 4 }]
            }
        }).addTo(map);
    }

    // Renew order on the card
    function updatePointOrderAfterChange(points) {
        points.forEach(point => {
            // In Place's Card
            const pointCard = document.querySelector(`.point-item[data-point-id="${point.id}"]`);
            if (pointCard) {
                pointCard.setAttribute('data-order', point.order);
                pointCard.querySelector('.badge').textContent = point.order;
            }

            // In Marker
            const marker = userMapMarkers[point.id];
            if (marker) {
                const markerIcon = L.divIcon({
                    className: point.isVisited ? 'visited-marker' : 'unvisited-marker',
                    html: `<div class="marker-icon">#${point.order}</div>`,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41]
                });
                marker.setIcon(markerIcon);
            }
        });
    }

    // Delete point in the Route
    function deletePointFromRoute(event, pointId) {
        if (event) {
            event.stopPropagation(); // Stop show Detail place info
        }
        fetch(`/delete_point_from_route/${pointId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCSRFToken(),
                'Content-Type': 'application/json'
            },
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Delete place's card
                document.querySelector(`[data-point-id="${pointId}"]`).remove();

                // Delete place's marker
                map.removeLayer(userMapMarkers[pointId]);
                delete userMapMarkers[pointId];

                // Renew order on the card
                updatePointOrderAfterChange(data.places);
            } else {
                alert('Error deleting point: ' + data.error);
            }
        })
        .catch(error => console.error('Error:', error));
    }

    // Click on user's marker = click on the place's card
    function handleMarkerClick(pointId) {
        const pointCard = document.querySelector(`.point-item[data-point-id="${pointId}"]`);
        if (pointCard) {
            // Создаем и отправляем событие "click"
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            pointCard.dispatchEvent(clickEvent);
        }
    }
    // Click on the Point Card to edit info
    function handlePointClick(e) {
        const clickedElement = e.target;
        const pointCard = clickedElement.closest('.point-item');
        if (!pointCard) return;

        const pointId = pointCard.getAttribute('data-point-id');

        // Check, if button
        if (clickedElement.closest('.btn')) {
            deletePointFromRoute(event, pointId);
        }
        else {
            map.flyTo(userMapMarkers[pointId].getLatLng(), 13); // fly map to marker

            fetch(`/get_point/${pointId}/`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        displayPlaceInfo(data.place, false);
                    } else {
                        alert('Failed to load point data');
                    }
                })
                .catch(error => console.error('Error loading point:', error));
        }
    }

    // Clean the PlaceForm
    function cleanPlaceForm(form){
        form.reset();
        document.getElementById("place-longitude").value = '';
        document.getElementById("place-latitude").value = '';
        document.getElementById("place-longlat").textContent = '';
        document.getElementById("place-altitude").textContent = '';
        document.getElementById("place-country-iso").value = '';
        document.getElementById("place-country-name").value = '';
        document.getElementById("place-city-name").value = '';
        document.getElementById("place-country-flag").className = "";
        document.getElementById("place-country-tooltip").removeAttribute("title");
        document.getElementById("place-address").textContent = '';
        document.getElementById("place-addr").value = '';
        document.getElementById("place-category-id").value = '';
        //document.getElementById("place-category-tooltip").removeAttribute("title");
        document.getElementById("place-name-display").innerHTML = "";
        document.getElementById("place-name").value = '';
        document.getElementById("detail-place-info").classList.add("hidden");
        placeForm.classList.add('d-none');
    }

    // Add point to route
    function submitPlaceForm(event) {
        event.preventDefault();

        const placeForm = event.target;
        const formData = new FormData(placeForm);
        formData.append('placeId', editingPlaceId);

        if(submitPlaceButton.textContent === 'Edit Point'){
            fetch(`/update_point/${editingPlaceId}/`, {
                        method: 'POST',
                        body: formData,
                        headers: { 'X-CSRFToken': getCSRFToken() }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            //console.log("data: ", data)
                            // Clean the form
                            cleanPlaceForm(placeForm);

                            submitPlaceButton.textContent = 'Add Point to Route';
                            editingPlaceId = null;

                            // Renew UI
                            document.querySelector(`[data-point-id="${data.place.id}"] .card-title`).textContent = data.place.name;
                        } else {
                            alert('Error updating point');
                        }
                    })
                    .catch(error => console.error('Error updating point:', error));
        }
        else {
            fetch('/add_point_to_route/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': formData.get('csrfmiddlewaretoken'),
                },
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Add point to the Route (template)
                        const pointId = data.place_info.id;
                        const newPoint = document.createElement('div');
                        newPoint.className = 'point-item card mb-1 shadow-sm';
                        newPoint.setAttribute('data-point-id', data.place_info.id);
                        newPoint.setAttribute('data-latitude', data.place_info.latitude);
                        newPoint.setAttribute('data-longitude', data.place_info.longitude);
                        newPoint.setAttribute('data-is-visited', data.place_info.isVisited);
                        newPoint.setAttribute('data-order', data.place_info.order);

                        // Create the card body
                        const cardBody = document.createElement('div');
                        cardBody.className = 'card-body d-flex align-items-center gap-2 position-relative';

                        // Order number
                        const orderBadge = document.createElement('span');
                        orderBadge.className = 'badge bg-info position-absolute top-0 start-0';
                        orderBadge.textContent = data.place_info.order;

                        // Categories icon and name
                        const infoWrapper = document.createElement('div');
                        infoWrapper.className = 'd-flex align-items-center w-100 gap-2';

                        const placeIcon = document.createElement('span');
                        placeIcon.className = 'icon-category';
                        placeIcon.textContent = data.place_info.icon;

                        const cardTitle = document.createElement('h6');
                        cardTitle.className = 'card-title mb-0';
                        cardTitle.textContent = data.place_info.name;

                        infoWrapper.appendChild(placeIcon);
                        infoWrapper.appendChild(cardTitle);

                        // Delete button
                        const deleteButton = document.createElement('button');
                        deleteButton.type = 'button';
                        deleteButton.className = 'btn btn-link text-secondary position-absolute top-0 end-0';

                        const delIcon = document.createElement('i');
                        delIcon.className = 'bi bi-trash';
                        deleteButton.appendChild(delIcon);

                        // Append all elements to the card body
                        cardBody.appendChild(orderBadge);
                        cardBody.appendChild(infoWrapper);
                        cardBody.appendChild(deleteButton);

                        // Append the card body to the main card
                        newPoint.appendChild(cardBody);

                        // Add the new card to the route points container
                        routePoints.appendChild(newPoint);

                        const markerIcon = L.divIcon({
                            className: data.place_info.isVisited ? 'visited-marker' : 'unvisited-marker',
                            html: `<div class="marker-icon">#${data.place_info.order}</div>`,
                            iconSize: [25, 41],
                            iconAnchor: [12, 41]
                        });

                        const marker = L.marker([data.place_info.latitude, data.place_info.longitude], { icon: markerIcon }).addTo(map);
                        marker.bindTooltip(`<strong>${data.place_info.name}</strong>`, { permanent: false, direction: "top", offset: [0, -40] });
                        userMapMarkers[pointId] = marker;
                        marker.on('click', () => {
                            handleMarkerClick(pointId);
                        });

                        // Clean the form
                        cleanPlaceForm(placeForm);
                    } else {
                        alert('Error adding point: ' + data.error);
                    }
                })
                .catch(error => console.error('Error:', error));
        }
    }

    // Find Elevation with coordinates
    async function getElevation(lat, lon) {
        const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`;

        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                return data.results[0].elevation;
            })
            .catch(error => {
                console.error('Error fetching elevation:', error);
                return '';
            });
    }

    // Get geo-info with coordinates
    async function reverseGeocode(lat, lng) {
        const url = `/api/reverse-geocode/?lat=${lat}&lon=${lng}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            //console.log("data:", data);
            return {
                country: data.address?.country,
                city: data.address?.city || data.address?.town,
                countryCode: data.address?.country_code,
                category: data.type.trim().toLowerCase(),
                road: data.address.road,
                house_number: data.address.house_number,
                postcode: data.address.postcode
            };
        } catch (err) {
            console.error("Error in reverse geocoding:", err);
            return { country: "", city: "" };
        }
    }

    // If Marker Click Handle than show details
    function displayPlaceInfo(place, isNew = true) {
        const detailBlock = document.getElementById("detail-place-info");
        const routeMainBlock = document.getElementById("route-main-block");

        // format longitude & latitude
        function formatCoordinates(lat, lng) {
            if (lat && lng) {
                const latDirection = lat >= 0 ? "N" : "S";
                const lngDirection = lng >= 0 ? "E" : "W";

                const formattedLat = `${Math.abs(lat).toFixed(2)}° ${latDirection}`;
                const formattedLng = `${Math.abs(lng).toFixed(2)}° ${lngDirection}`;

                return `${formattedLat} ${formattedLng}`;
            }
            return '';
        }
        // format date
        function formattedDateTime(){
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');

            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }

        // Edit Place Name
        nameInputEl.value = place.name;
        nameDisplayEl.textContent = place.name;
        nameInputEl.classList.add("d-none");
        nameDisplayEl.classList.remove("d-none");
        editButton.innerHTML = "✏";

        if(isNew) {
            // Fill detailBlock
            reverseGeocode(place.lat, place.lng).then(location => {
                const countryName = place.category.country || location.country || '';
                const cityName = place.category.city || location.city || '';
                const countryCode = location.countryCode || '';
                const categoryValue = location.category;
                const category = categoriesData.find(cat => cat.value === categoryValue);
                const categoryId = category ? category.id : null;
                const address = location.road + ' ' + location.house_number + ', ' + cityName + ' ' + location.postcode + ', ' + countryName;

                // Altitude + Longitude + Latitude
                document.getElementById("place-longitude").value = place.lng;
                document.getElementById("place-latitude").value = place.lat;
                document.getElementById("place-longlat").textContent = formatCoordinates(place.lng, place.lat);
                getElevation(place.lat, place.lng).then(elevation => {
                    document.getElementById("place-altitude").value = elevation;
                    document.getElementById("place-alt").textContent = `⛰️ ${elevation !== null ? `${elevation} ` : '?'} m`;
                });

                // Country + City
                document.getElementById("place-country-iso").value = countryCode;
                document.getElementById("place-country-name").value = countryName;
                document.getElementById("place-city-name").value = cityName;

                document.getElementById("place-country-flag").className = `flag-icon flag-icon-${countryCode.toLowerCase()}`;
                document.getElementById("place-country-tooltip").setAttribute("title", countryName);
                document.getElementById("place-address").textContent = address;
                document.getElementById("place-addr").value = address;

                // Category
                document.getElementById("place-category-id").value = categoryId;

                // Date
                document.getElementById("place-datetime-picker").value = formattedDateTime();
            });

            // Button "Edit" -> "Add"
            submitPlaceButton.textContent = 'Add Point to Route';
        }
        else {
            document.getElementById('place-longitude').value = place.longitude || '';
            document.getElementById('place-latitude').value = place.latitude || '';
            document.getElementById("place-longlat").textContent = formatCoordinates(place.longitude, place.latitude);
            document.getElementById('place-datetime-picker').value = place.dt || '';
            document.getElementById('place-description').value = place.description || '';
            document.getElementById('place-category-id').value = place.category_id || '';
            document.getElementById('place-country-iso').value = place.countryISO || '';
            document.getElementById('place-country-name').value = place.country || '';
            document.getElementById('place-city-name').value = place.city || '';
            document.getElementById('place-alt').textContent =  `⛰️ ${place.altitude !== null ? `${place.altitude} ` : '?'} m`;
            document.getElementById('place-altitude').value =  place.altitude;

            document.getElementById("place-country-flag").className = `flag-icon flag-icon-${place.countryISO.toLowerCase()}`;
            document.getElementById("place-country-tooltip").setAttribute("title", place.country);
            document.getElementById("place-addr").value = place.address || '';
            document.getElementById("place-address").textContent = place.address;

            // Button "Add" -> "Edit"
            submitPlaceButton.textContent = 'Edit Point';
            editingPlaceId = place.id;
        }

        // Show detailBlock
        detailBlock.classList.remove("hidden");
        placeForm.classList.remove('d-none');
    }

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
                country: el.tags["addr:country"] || "N/A",
                city: el.tags["addr:city"] || "N/A",
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

                // Adding a hover tooltip
                marker.bindTooltip(place.name, {permanent: false, direction: "top", offset: [0, -10] });

                // Marker Click Handle
                marker.on('click', () => {displayPlaceInfo(place);});
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
        const mapContainer = document.getElementById('map-container');
        if (isLegendVisible) {
            // Hide Legend
            mapLegend.classList.add('hidden');
            LegendToggleBtn.querySelector('i').classList.replace('fa-chevron-right', 'fa-chevron-left');
            mapContainer.classList.replace('col-md-7', 'col-md-9');
        } else {
            // Show Legend
            mapLegend.classList.remove('hidden');
            LegendToggleBtn.querySelector('i').classList.replace('fa-chevron-left', 'fa-chevron-right');
            mapContainer.classList.replace('col-md-9', 'col-md-7');
        }

        isLegendVisible = !isLegendVisible;

        setTimeout(() => {
            map.invalidateSize();
        }, 300);
    }

    // Collapse SidebarGroup
    function collapseSidebarGroup(button){
        const sidebarGroup = button.closest(".sidebar-group");
        const content = sidebarGroup.querySelector(".group-content");

        content.classList.toggle("hidden");

        if (content.classList.contains("hidden")) {
            button.innerHTML = "+";
        } else {
            button.innerHTML = "&minus;";
        }
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

    toggleButtons.forEach(button => {
        button.addEventListener("click", () => {collapseSidebarGroup(button);});
    });

    // Click on the Point Card to edit info
    routePoints.addEventListener('click', handlePointClick);

    // Submit -> Add point to route
    placeForm.addEventListener('submit', submitPlaceForm);

    editButton.addEventListener("click", () => {
        // Toggle Edit Mode
        if (nameInputEl.classList.contains("d-none")) {
            nameInputEl.classList.remove("d-none");
            nameDisplayEl.classList.add("d-none");
            nameInputEl.value = nameDisplayEl.textContent;
            nameInputEl.focus();
            editButton.innerHTML = "✅";
        } else {
            nameInputEl.classList.add("d-none");
            nameDisplayEl.classList.remove("d-none");
            nameDisplayEl.textContent = nameInputEl.value;
            editButton.innerHTML = "✏";
        }
    });

    if (routePoints) {
        // Init SortableJS
        new Sortable(routePoints, {
            animation: 150, // smooth animation
            ghostClass: 'dragging',
            onEnd: function (event) {
                // Collect new point order
                const pointOrder = [];
                document.querySelectorAll('.point-item').forEach((item, index) => {
                    pointOrder.push({
                        id: item.getAttribute('data-point-id'),
                        order: index + 1 // new order start with 1
                    });
                });

                // send new order
                fetch('/update_point_order/', {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCSRFToken(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ order: pointOrder })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Renew order on the card
                        updatePointOrderAfterChange(data.places);
                    } else {
                        alert('Error updating order: ' + data.error);
                    }
                })
                .catch(error => console.error('Error updating order:', error));
            }
        });

        // for places
        document.querySelectorAll('.point-item').forEach((point, index) => {
            const pointId = point.getAttribute('data-point-id');
            const isVisited = point.getAttribute('data-is-visited') === 'true';
            const latitude = point.getAttribute('data-latitude');
            const longitude = point.getAttribute('data-longitude');
            const order = point.getAttribute('data-order');
            const pointName = point.querySelector('.card-title').textContent;

            const markerIcon = L.divIcon({
                className: isVisited ? 'visited-marker' : 'unvisited-marker',
                html: `<div class="marker-icon">#${order}</div>`,
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            });

            const marker = L.marker([latitude, longitude], { icon: markerIcon }).addTo(map);
            marker.bindTooltip(`<strong>${pointName}</strong>`, {permanent: false, direction: "top", offset: [0, -40]});
            userMapMarkers[pointId] = marker;

            marker.on('click', () => {
                handleMarkerClick(pointId);
            });
        });
    }

    if (getDirectionButton) {
        getDirectionButton.addEventListener('click', function () {
            buildRoute();
        });
    }
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

    /*
    // Init ALL tooltip
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    */

    if(currentUrl.includes('profile') || currentUrl.includes('register')){
        avatarEditing();
    } else if(currentUrl.includes('my-places')) {
        myPlaces();
    }
});