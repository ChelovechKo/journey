let editingPlaceId = null;
const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
const toggleButtons = document.querySelectorAll(".btn-toggle");
const messageBlock = document.getElementById('message-block');
let userMarker = null;

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

function handleRouteClick(cardElement) {
    const routeId = cardElement.getAttribute('data-route-id');
    const isDraft = cardElement.getAttribute('data-is-draft').toLowerCase() === 'true';

    if (isDraft) {
        // Redirect to the my-places page
        window.location.href = '/my-places/';
    } else {
        // Redirect to the route detail page
        window.location.href = `/route/${routeId}/`;
    }
}

function showMessage(arg_class, arg_message){
    messageBlock.className = `alert alert-${arg_class}`;
    messageBlock.textContent = arg_message;

    messageBlock.style.opacity = '1';
    messageBlock.style.height = 'auto';
    messageBlock.style.overflow = 'hidden';

    setTimeout(() => {
        messageBlock.style.opacity = '0';
        messageBlock.style.height = '0';
    }, 2000);

    setTimeout(() => {
        messageBlock.className = '';
        messageBlock.textContent = '';
        messageBlock.style.opacity = '';
        messageBlock.style.height = '';
    }, 3000);
}

// Add and Edit Point on the User's Map
function myPlaces(){
    const map = L.map("map").setView([51.505, -0.09], 2);  // Init Map
    const routeDetailsDiv = document.getElementById("route-details");
    const markers = [];
    const categoryIcons = {};
    const categoriesData = JSON.parse(document.getElementById("categories-data").textContent);
    const LegendToggleBtn = document.getElementById('legend-toggle-btn');
    const mapLegend = document.getElementById('map-legend');
    const placeForm = document.getElementById('place-form');
    const routePoints = document.getElementById('route-points');
    const submitPlaceButton = placeForm.querySelector('button[type="submit"]');
    const editButton = document.getElementById("edit-name-btn")
    const nameInputEl = document.getElementById('place-name');
    const nameDisplayEl = document.getElementById("place-name-display");
    const getDirectionButton = document.getElementById('get-direction-btn');
    const saveRouteButton = document.getElementById('save-route-btn');
    const routeDetails = document.getElementById("route-details");
    const routeId = routeDetails.getAttribute("route-id");
    let userMapMarkers = [];

    let isLegendVisible = true;
    let hideTimeout;

    // get route's data
    function extractRouteData() {
        if (!window.currentRoute) {
            console.error("No route available to save.");
            return [];
        }

        return window.currentRoute.getWaypoints().map((waypoint, i) => ({
            lat: waypoint.latLng.lat,
            lng: waypoint.latLng.lng,
            pointId: waypoint.options.pointId || null,
            isVisited: waypoint.options.isVisited || false,
            name: waypoint.name || '',
            order: i + 1
        }));
    }

    // Save Route
    function saveRouteButtonClick(){
        const distance = document.getElementById("route-distance-save").value;
        const duration = document.getElementById("route-duration-save").value;
        const price = document.getElementById("route-price-save").value;

        // Save waypoints
        const waypoints = extractRouteData();

        // Send form
        fetch('/save_route/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                routeId: routeId,
                distance: distance,
                duration: duration,
                price: price,
                waypoints: waypoints
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showMessage('success', 'Route saved successfully!');
                window.location.href = `/route/${routeId}/`; // Redirect to created route
            } else {
                console.error('Error saving route (saveRouteButtonClick): ', data.error);
                showMessage('danger', 'An error occurred while saving the route.');
            }
        })
        .catch(error => {
            console.error('Error saving route (saveRouteButtonClick):', error);
            showMessage('danger', 'An error occurred while saving the route.');
        });
    }

    // Get Direction
    function buildRoute() {
        const isCircularRoute = document.getElementById('circular-route').checked;

        // Collect points
        const points = Array.from(routePoints.querySelectorAll('.point-item')).map(item => ({
            latitude: parseFloat(item.getAttribute('data-latitude')),
            longitude: parseFloat(item.getAttribute('data-longitude')),
            isVisited: item.getAttribute('data-is-visited').toLowerCase() === 'true',
            pointId: item.getAttribute('data-point-id'),
            price: parseFloat(item.getAttribute('data-price')) || 0,
            name: item.querySelector('.card-title').textContent
        }));

        if (points.length < 2) {
            showMessage('info', 'Please add at least two points to build a route.');
            return;
        }

        // Sort places
        points.sort((a, b) => a.order - b.order);

        // If circular route is enabled, add the first point to the end
        if (isCircularRoute) {
            points.push(points[0]); // Add the first point to the end
        }

        // Format waypoints
        const waypoints = points.map(point => {
            return L.Routing.waypoint(
                L.latLng(point.latitude, point.longitude),
                point.name,
                { pointId: point.pointId, isVisited: point.isVisited } // Custom options
            );
        });

        // Clean last route
        if (window.currentRoute) {
            map.removeControl(window.currentRoute);
        }

        // Add Route with Leaflet Routing Machine
        window.currentRoute = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: false,
            lineOptions: {
                styles: [{ color: 'blue', weight: 4 }]
            },
            createMarker: function(i, waypoint) {
                // i: order, waypoint: point info
                if (isCircularRoute && i === waypoints.length - 1) {
                        return null;
                }

                const markerIcon = L.divIcon({
                    className: waypoint.options.isVisited ? 'visited-marker' : 'unvisited-marker',
                    html: `<div class="marker-icon">#${i + 1}</div>`,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41]
                });

                const marker = L.marker(waypoint.latLng, { icon: markerIcon });
                marker.on('click', () => {handleMarkerClick(waypoint.options.pointId);});
                return marker;
            }
        }).addTo(map);

        window.currentRoute.on('routesfound', function (e) {
            const route = e.routes[0];

            // Convert distance to kilometers and meters
            const totalDistance = route.summary.totalDistance; // in meters
            const kilometers = Math.floor(totalDistance / 1000);
            const meters = Math.round(totalDistance % 1000);
            document.getElementById('route-distance').textContent = `${kilometers} km ${meters} m`;
            document.getElementById('route-distance-save').value = totalDistance.toFixed(2);

            // Convert time to days, hours, and minutes
            const totalTime = route.summary.totalTime; // in seconds
            const days = Math.floor(totalTime / (24 * 3600));
            const hours = Math.floor((totalTime % (24 * 3600)) / 3600);
            const minutes = Math.round((totalTime % 3600) / 60);

            let timeString = '';
            if (days > 0) timeString += `${days} days `;
            if (hours > 0) timeString += `${hours} hours `;
            timeString += `${minutes} mins`;

            document.getElementById('route-duration').textContent = timeString;
            document.getElementById('route-duration-save').value = totalTime;

            // Calculate total route price
            let totalPrice;
            if (isCircularRoute) {
                // If the route is circular, exclude the last point
                totalPrice = points.slice(0, -1).reduce((sum, point) => sum + point.price, 0);
            } else {
                // For a linear route, include all points
                totalPrice = points.reduce((sum, point) => sum + point.price, 0);
            }

            document.getElementById('route-price').textContent = `${totalPrice.toFixed(2)}`;
            document.getElementById('route-price-save').value = totalPrice.toFixed(2);

            saveRouteButton.style.display = "block";
        });
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

        // Reset the existing route and clean route details
        if (window.currentRoute) {
            map.removeControl(window.currentRoute);
            window.currentRoute = null;
        }
        document.getElementById('route-distance').textContent = '?';
        document.getElementById('route-duration').textContent = '?';
        document.getElementById('route-price').textContent = '?';

        saveRouteButton.style.display = "none";
    }

    // Delete point on the Route
    function deletePointFromRoute(event, pointId) {
        if (event) {
            event.stopPropagation(); // Stop show Detail place info
        }
        fetch(`/delete_point_from_route/${pointId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            }
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
                console.error('Error deleting point (deletePointFromRoute): ', data.error);
                showMessage('danger', 'An error occurred while deleting the point.');
            }
        })
        .catch(error => {
            console.error('Error deleting point (deletePointFromRoute):', error);
            showMessage('danger', 'An error occurred while deleting the point.');
        });
    }

    // Click on user's marker = click on the place's card
    function handleMarkerClick(pointId) {
        const pointCard = document.querySelector(`.point-item[data-point-id="${pointId}"]`);
        if (pointCard) {
            // Create and send event "click"
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
                        console.error('Failed to load point data (handlePointClick): ', data.error);
                        showMessage('danger', 'An error occurred while loading point data.');
                    }
                })
                .catch(error => {
                    console.error('Failed to load point data (handlePointClick):', error);
                    showMessage('danger', 'An error occurred while loading point data.');
                });
        }
    }

    // Clean the PlaceForm
    function cleanPlaceForm(form){
        form.reset();
        document.getElementById("place-longitude").value = '';
        document.getElementById("place-latitude").value = '';
        document.getElementById("place-longlat").textContent = '';
        //document.getElementById("place-altitude").textContent = '';
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
        document.getElementById("place-price").value = '';
        document.getElementById("place-isVisited").checked = false;
        document.getElementById("place-details").classList.add("hidden");
        placeForm.classList.add('d-none');
        if (userMarker) {
            map.removeLayer(userMarker);
        }
    }

    // Add point to route
    function submitPlaceForm(event) {
        event.preventDefault();

        const placeForm = event.target;
        const formData = new FormData(placeForm);
        formData.append('placeId', editingPlaceId);
        formData.append('routeId', routeId);

        if(submitPlaceButton.textContent === 'Edit Point'){
            fetch(`/update_point/${editingPlaceId}/`, {
                        method: 'POST',
                        body: formData,
                        headers: { 'X-CSRFToken': csrfToken }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // console.log("data: ", data)
                            // Clean the form
                            cleanPlaceForm(placeForm);

                            submitPlaceButton.textContent = 'Add Point to Route';
                            editingPlaceId = null;

                            // Renew UI
                            const card = document.querySelector(`[data-point-id="${data.place.id}"]`);
                            if (card) {
                                card.querySelector('.card-title').textContent = data.place.name;
                                card.setAttribute('data-is-visited', data.place.isVisited);
                                card.setAttribute('data-price', data.place.price);
                            }

                            // Renew Marker
                            const marker = userMapMarkers[data.place.id];
                            if (marker) {
                                const markerIcon = L.divIcon({
                                    className: data.place.isVisited ? 'visited-marker' : 'unvisited-marker',
                                    html: `<div class="marker-icon">#${data.place.order}</div>`,
                                    iconSize: [25, 41],
                                    iconAnchor: [12, 41]
                                });
                                marker.setIcon(markerIcon);
                            }
                        } else {
                            console.error('Error updating point (submitPlaceForm): ', data.error);
                            showMessage('danger', 'An error occurred while updating point.');
                        }
                    })
                    .catch(error => {
                        console.error('Error updating point (submitPlaceForm):', error);
                        showMessage('danger', 'An error occurred while updating point.');
                    });
        }
        else {
            fetch('/add_point_to_route/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': csrfToken
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
                        newPoint.setAttribute('data-price', data.place_info.price);
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
                        console.error('Error adding point (submitPlaceForm): ', data.error);
                        showMessage('danger', 'An error occurred while adding point.');
                    }
                })
                .catch(error => {
                    console.error('Error adding point (submitPlaceForm):', error);
                    showMessage('danger', 'An error occurred while adding point.');
                });
        }
    }

    // Find Elevation with coordinates
    /*async function getElevation(lat, lon) {
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
    }*/

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
        const detailBlock = document.getElementById("place-details");

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
                /*getElevation(place.lat, place.lng).then(elevation => {
                    document.getElementById("place-altitude").value = elevation;
                    document.getElementById("place-alt").textContent = `⛰️ ${elevation !== null ? `${elevation} ` : '?'} m`;
                });*/

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

                // Price
                document.getElementById("place-price").value = '';

                // isVisited
                document.getElementById("place-isVisited").checked = false;
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
            //document.getElementById('place-alt').textContent =  `⛰️ ${place.altitude !== null ? `${place.altitude} ` : '?'} m`;
            //document.getElementById('place-altitude').value =  place.altitude;

            document.getElementById("place-country-flag").className = `flag-icon flag-icon-${place.countryISO.toLowerCase()}`;
            document.getElementById("place-country-tooltip").setAttribute("title", place.country);
            document.getElementById("place-addr").value = place.address || '';
            document.getElementById("place-address").textContent = place.address;
            document.getElementById("place-price").value = place.price || '';
            document.getElementById("place-isVisited").checked = place.isVisited || false;

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
                marker.on('click', () => displayPlaceInfo(place, true));
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
            }, 300);
        }
    }

    //Hide/Show Map Legend Handle
    function hideShowMapLegend(){
        const mapContainer = document.getElementById('map-container');
        const tooltipInstance = bootstrap.Tooltip.getInstance(LegendToggleBtn);

        if (isLegendVisible) {
            // Hide Legend
            mapLegend.classList.add('hidden');
            LegendToggleBtn.querySelector('i').classList.replace('fa-chevron-right', 'fa-chevron-left');
            mapContainer.classList.replace('col-md-7', 'col-md-9');

            // Update tooltip to 'Show Map Legend'
            LegendToggleBtn.setAttribute('title', 'Show Map Legend');
            if (tooltipInstance) {
                tooltipInstance.hide(); // Hide current tooltip
                tooltipInstance.setContent({ '.tooltip-inner': 'Show Map Legend' }); // Update tooltip content
            }
        } else {
            // Show Legend
            mapLegend.classList.remove('hidden');
            LegendToggleBtn.querySelector('i').classList.replace('fa-chevron-left', 'fa-chevron-right');
            mapContainer.classList.replace('col-md-9', 'col-md-7');

            // Update tooltip to 'Hide Map Legend'
            LegendToggleBtn.setAttribute('title', 'Hide Map Legend');
            if (tooltipInstance) {
                tooltipInstance.hide(); // Hide current tooltip
                tooltipInstance.setContent({ '.tooltip-inner': 'Hide Map Legend' }); // Update tooltip content
            }
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

    // Map click
    map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        if (userMarker) {
            map.removeLayer(userMarker);
        }

        const isMarkerHere = userMapMarkers.some(marker => {
            const markerLatLng = marker.getLatLng();
            return markerLatLng.lat === lat && markerLatLng.lng === lng;
        });

        if (!isMarkerHere) {
            const icon = L.AwesomeMarkers.icon({ prefix: 'fa', icon: 'map-marker', markerColor: 'red' });
            const marker = L.marker([lat, lng], {icon: icon });

            marker.on('click', () => displayPlaceInfo({
                lat: lat,
                lng: lng,
                name: "Unknown Location",
                category: { country: null, city: null, countryCode: null }
            }, true));

            marker.addTo(map);
            userMarker = marker;
            marker.fire('click');
        }
    });

    // Reset the existing route and clean route details
    if (window.currentRoute) {
        map.removeControl(window.currentRoute);
        window.currentRoute = null;
    }

    // Hide/Show ToggleLegendBtn
    mapLegend.addEventListener("mouseenter", showToggleLegendBtn);
    mapLegend.addEventListener("mouseleave", hideToggleLegendBtn);

    // Hide/Show Map Legend Handle
    LegendToggleBtn.addEventListener("mouseenter", showToggleLegendBtn);
    LegendToggleBtn.addEventListener("mouseleave", hideToggleLegendBtn);

    LegendToggleBtn.addEventListener('click', hideShowMapLegend);

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

    //Save Route
    saveRouteButton.addEventListener('click', saveRouteButtonClick);

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
                        'X-CSRFToken': csrfToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        route_id: routeId,
                        order: pointOrder
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Renew order on the card
                        updatePointOrderAfterChange(data.places);
                    } else {
                        console.error('Error updating point order (update_point_order): ', data.error);
                        showMessage('danger', 'An error occurred while updating point order.');
                    }
                })
                .catch(error => {
                    console.error('Error updating point order (update_point_order):', error);
                    showMessage('danger', 'An error occurred while updating point order.');
                });
            }
        });

        // for places
        document.querySelectorAll('.point-item').forEach((point, index) => {
            const pointId = point.getAttribute('data-point-id');
            const isVisited = point.getAttribute('data-is-visited').toLowerCase() === 'true';
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

        routeDetailsDiv.classList.remove("hidden");
    }

    if (getDirectionButton) {
        getDirectionButton.addEventListener('click', function () {
            buildRoute();
        });
    }

    saveRouteButton.style.display = "none";
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

// Route Details Page
function routeDetailsPage(){
    let selectedRating = 0;
    let selectedDifficulty = 0;

    const rdRoutePoints = document.getElementById('rd-route-points');

    const routeInfo = document.getElementById('routeJSinfo');
    const isOwner = routeInfo.getAttribute('rd-is-owner') === 'true';
    const routeId = routeInfo.getAttribute('rd-route-id');
    const rdRating = parseInt(routeInfo.getAttribute('rd-rating')) || 0;
    const rdDifficulty = parseInt(routeInfo.getAttribute('rd-difficulty')) || 0;

    const rdNameDisplay = document.getElementById('rd-name-display');
    const rdNameInput = document.getElementById('rd-name-input');
    const rdStatusToogleButton = document.getElementById('rd-status-toggle-btn');
    const rdCompletionToogleButton = document.getElementById('rd-completion-toggle-btn');
    const rdNameEditButton = document.getElementById('rd-name-edit-btn');
    const rdStartDateButton = document.getElementById('rd-start-date-btn');
    const rdEndDateButton = document.getElementById('rd-end-date-btn');
    const rdDescriptionEditButton = document.getElementById('rd-description-edit-btn');
    const rdDescriptionTextarea = document.getElementById('rd-description');
    const rdApplyRouteChangesButton = document.getElementById('rd-apply-route-changes-btn');
    const rdDeleteRouteButton = document.getElementById('rd-delete-route-btn');
    const rdStarsRatingButton = document.getElementById('rd-star-rating-btn');
    const rdBootsDifficultyButton = document.getElementById('rd-difficulty-rating-btn');
    const rdPointsEditButton = document.getElementById('rd-points-edit-btn');
    const rdLikeButton = document.getElementById('rd-like-route-btn');

    const confirmDeleteButton = document.getElementById('confirmDeleteRoute');

    const stars = document.querySelectorAll('#rd-star-rating-btn .star');
    const boots = document.querySelectorAll('#rd-difficulty-rating-btn .boot');

    function click_rdLikeButton(){
        const icon = this.querySelector('.icon-heart');
        const likeCountSpan = this.querySelector('small');

        // Send request to toggle like
        fetch(`/toggle_like/${routeId}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json',
            },
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error toggling like on route (click_rdLikeButton): ', data.error);
                    showMessage('danger', 'An error occurred while toggling like on route.');
                    return;
                }

                // Update icon based on the new liked state
                if (data.liked) {
                    icon.classList.remove('bi-heart');
                    icon.classList.add('bi-heart-fill');
                } else {
                    icon.classList.remove('bi-heart-fill');
                    icon.classList.add('bi-heart');
                }

                // Update like count
                likeCountSpan.textContent = `${data.likes_count}`;
            })
            .catch(error => {
                console.error('Error toggling like on route (click_rdLikeButton): ', error);
                showMessage('danger', 'An error occurred while toggling like on route.');
            });
    }

    function click_rdDeleteRouteButton(){
        const deleteRouteModal = new bootstrap.Modal(document.getElementById('deleteRouteModal'));
        deleteRouteModal.show();
    }

    function click_confirmDeleteButton(){
        fetch(`/delete_route/${routeId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showMessage('success', 'Route deleted successfully!');
                window.location.href = '/routes/my_routes/'; // Redirect to routes list
            } else {
                console.error('Error deleting route (click_confirmDeleteButton): ', data.error);
                showMessage('danger', 'An error occurred while deleting the route.');
            }
        })
        .catch(error => {
            console.error('Error deleting route (click_confirmDeleteButton):', error);
            showMessage('danger', 'An error occurred while deleting the route.');
        });
    }

    function click_rdApplyRouteChangesButton(e){
        e.preventDefault();

        // const log_data = {routeId: routeId, name: rdNameDisplay.textContent, startDate: rdStartDateButton.value, endDate: rdEndDateButton.value, rating: selectedRating, difficulty: selectedDifficulty, description: rdDescriptionTextarea.value, isPlan: rdCompletionToogleButton.textContent === '⏳', isPublished: rdStatusToogleButton.textContent === 'Published'};
        // console.log('log_data=', log_data);

        // Send data to save
        fetch('/apply_route_changes/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                routeId: routeId,
                name: rdNameDisplay.textContent,
                startDate: rdStartDateButton.value,
                endDate: rdEndDateButton.value,
                rating: selectedRating,
                difficulty: selectedDifficulty,
                description: rdDescriptionTextarea.value,
                isPlan: rdCompletionToogleButton.textContent === '⏳',
                isPublished: rdStatusToogleButton.textContent === 'Published'
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showMessage('success', 'Route saved successfully!');
            }else {
                console.error('Error saving route (click_rdApplyRouteChangesButton):', data.error);
                showMessage('danger', 'An error occurred while saving the route.');
            }
        })
        .catch(error => {
            console.error('Error saving route (click_rdApplyRouteChangesButton):', error);
            showMessage('danger', 'An error occurred while saving the route.');
        });
    }

    function click_rdDescriptionEditButton(){
        // Edit
        if (rdDescriptionEditButton.textContent.trim() === '✏️') {
            rdDescriptionTextarea.readOnly = false;
            rdDescriptionTextarea.classList.add('editable');
            rdDescriptionEditButton.innerHTML = '✅';
            rdDescriptionTextarea.focus();
            rdNameEditButton.setAttribute('title', 'Save description');
            rdDescriptionTextarea.style.cursor = 'default'
        // Save
        } else {
            rdDescriptionTextarea.readOnly = true;
            rdDescriptionTextarea.classList.remove('editable');
            rdDescriptionEditButton.innerHTML = '✏️';
            rdNameEditButton.setAttribute('title', 'Edit description');
            rdDescriptionTextarea.style.cursor = 'not-allowed'
        }
    }

    function click_rdNameEditButton(){
        // Edit
        if (rdNameEditButton.textContent.trim() === '✏️') {
            rdNameDisplay.classList.add('d-none');
            rdNameInput.classList.remove('d-none');
            rdNameEditButton.textContent = '✅';
            rdNameEditButton.setAttribute('title', 'Save route name');
        }
        // Save
        else {
            const newName = rdNameInput.value.trim();

            if (newName) {
                rdNameDisplay.textContent = newName;
            }

            rdNameDisplay.classList.remove('d-none');
            rdNameInput.classList.add('d-none');
            rdNameEditButton.textContent = '✏️';
            rdNameEditButton.setAttribute('title', 'Edit route name');
        }
    }

    function click_rdStatusToogleButton(){
        const tooltipInstance = bootstrap.Tooltip.getInstance(rdStatusToogleButton);
        if (tooltipInstance) {
            tooltipInstance.hide();
        }
        const currentStatus = rdStatusToogleButton.textContent.trim();
        const newStatus = currentStatus === 'Published' ? 'Saved' : 'Published';
        rdStatusToogleButton.textContent = newStatus;
        rdStatusToogleButton.classList.remove('bg-success', 'bg-primary');
        rdStatusToogleButton.classList.add(newStatus === 'Published' ? 'bg-primary' : 'bg-success');
    }

    function click_rdCompletionToogleButton(){
        const currentIcon = rdCompletionToogleButton.textContent.trim();
        rdCompletionToogleButton.textContent = currentIcon === '🎯' ? '⏳' : '🎯';
    }

    function click_rdPointsEditButton(){
        window.location.href = `/my-places/?route_id=${routeId}`;
    }

    function rateStars(){
        stars.forEach((star, index) => {
            star.addEventListener('mouseover', () => {
                stars.forEach((s, i) => {
                    s.style.color = i <= index ? '#ffc107' : '#ddd';
                });
            });

            star.addEventListener('mouseout', () => {
                stars.forEach((s, i) => {
                    s.style.color = i < selectedRating ? '#ffc107' : '#ddd';
                });
            });

            star.addEventListener('click', () => {
                selectedRating = index + 1;
                stars.forEach((s, i) => {
                    s.style.color = i < selectedRating ? '#ffc107' : '#ddd';
                });
            });
        });
    }

    function bootDifficulty(){
        boots.forEach((boot, index) => {
            boot.addEventListener('mouseover', () => {
                boots.forEach((b, i) => {
                    b.style.color = i <= index ? '#f0ad4e' : '#ddd';
                    b.style.filter = i <= index ? 'brightness(100%)' : 'brightness(70%)';
                });
            });

            boot.addEventListener('mouseout', () => {
                boots.forEach((b, i) => {
                    b.style.color = i < selectedDifficulty ? '#ffc107' : '#ddd';
                    b.style.filter = i < selectedDifficulty ? 'brightness(100%)' : 'brightness(70%)';
                });
            });

            boot.addEventListener('click', () => {
                selectedDifficulty = index + 1;
                boots.forEach((b, i) => {
                    b.style.color = i < selectedDifficulty ? '#ffc107' : '#ddd';
                    b.style.filter = i < selectedDifficulty ? 'brightness(100%)' : 'brightness(70%)';
                });
            });
        });
    }

    // Click on point = click on the place's card
    function hover_rdMarker(pointId, eventType) {
        const pointCard = document.querySelector(`.point-item[rd-point-id="${pointId}"]`);
        if (pointCard) {
            // Emulate hover behavior
            if (eventType === 'mouseover') {
                pointCard.classList.add('hovered');
            } else if (eventType === 'mouseout') {
                pointCard.classList.remove('hovered');
            }

            // Create and send event "click"
            const hoverEvent = new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: window,
            });

            pointCard.dispatchEvent(hoverEvent);
        }
    }

    function mouse_over_rdPoint(e) {
        const pointCard = e.target.closest('.point-item');
        if (!pointCard) return;

        const pointId = pointCard.getAttribute('rd-point-id');

        const enlargedIcon = L.divIcon({
            className: rdWaypoints[pointId].isVisited ? 'visited-marker' : 'unvisited-marker',
            html: `<div class="marker-icon">#${rdWaypoints[pointId].order}</div>`,
            iconSize: [35, 55],
            iconAnchor: [17, 55]
        });

        const marker = rdWaypoints[pointId]["marker"];
        marker.setIcon(enlargedIcon);
    }

    function mouse_out_rdPoint(e) {
        const pointCard = e.target.closest('.point-item');
        if (!pointCard) return;

        const pointId = pointCard.getAttribute('rd-point-id');

        const originalIcon = L.divIcon({
            className: rdWaypoints[pointId].isVisited ? 'visited-marker' : 'unvisited-marker',
            html: `<div class="marker-icon">#${rdWaypoints[pointId].order}</div>`,
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        });

        const marker = rdWaypoints[pointId]["marker"];
        marker.setIcon(originalIcon);
    }

    // Add Route on the map
    if (rdWaypoints && Object.keys(rdWaypoints).length > 0) {
        const rdWaypointsArray = Object.values(rdWaypoints).sort((a, b) => a.order - b.order);
        const isCircularRoute = rdWaypointsArray[0].latitude === rdWaypointsArray[rdWaypointsArray.length - 1].latitude &&
                            rdWaypointsArray[0].longitude === rdWaypointsArray[rdWaypointsArray.length - 1].longitude;

        // map init
        const map = L.map('rd-map-container').setView([rdWaypointsArray[0].latitude, rdWaypointsArray[0].longitude], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        // restore route
        const routeControl = L.Routing.control({
            waypoints: rdWaypointsArray.map(point => {
                return L.Routing.waypoint(
                    L.latLng(point.latitude, point.longitude),
                    point.name,
                    {pointId: point.id, isVisited: point.isVisited, order: point.order}
                );
            }),
            routeWhileDragging: false, // prohibition of moving route points
            lineOptions: { styles: [{ color: 'blue', weight: 4 }] },
            createMarker: function(i, waypoint) {
                // i: order, waypoint: point info
                if (isCircularRoute && i === rdWaypointsArray.length - 1) {
                    return null;
                }

                const markerIcon = L.divIcon({
                    className: waypoint.options.isVisited ? 'visited-marker' : 'unvisited-marker',
                    html: `<div class="marker-icon">#${i + 1}</div>`,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41]
                });

                const marker = L.marker(waypoint.latLng, { icon: markerIcon });
                rdWaypoints[waypoint.options.pointId]["marker"] = marker;

                // bindTooltip
                marker.bindTooltip(`<strong>${waypoint.name}</strong>`, {permanent: false, direction: "top", offset: [0, -40]});

                marker.on('mouseover', () => {
                    hover_rdMarker(waypoint.options.pointId, 'mouseover');
                });

                marker.on('mouseout', () => {
                    hover_rdMarker(waypoint.options.pointId, 'mouseout');
                });

                return marker;
            }
        }).addTo(map);

        // Setting boundaries after building a route
        routeControl.on('routesfound', function (e) {
            const route = e.routes[0]; // first route
            const bounds = L.latLngBounds(route.coordinates); // define the boundaries of the route
            // Set the map area
            map.fitBounds(bounds, {padding: [50, 50]});
        });
    }

    // Init rating
    if (rdRating > 0) {
            selectedRating = rdRating;
            stars.forEach((s, i) => {
                s.style.color = i < selectedRating ? '#ffc107' : '#ddd';
            });
        }

    // Init Difficulty
    if (rdDifficulty > 0) {
        selectedDifficulty = rdDifficulty;
        boots.forEach((b, i) => {
            b.style.color = i < selectedDifficulty ? '#ffc107' : '#ddd';
            b.style.filter = i < selectedDifficulty ? 'brightness(100%)' : 'brightness(70%)';
        });
    }

    // Apply changes button
    if (isOwner) {
        rdStarsRatingButton.classList.remove('no-interaction');
        rdBootsDifficultyButton.classList.remove('no-interaction');

        rdCompletionToogleButton.style.display = 'block';
        rdNameEditButton.style.display = 'block';
        rdStartDateButton.disabled = false;
        rdEndDateButton.disabled = false;
        rdDescriptionEditButton.style.display = 'block';
        rdApplyRouteChangesButton.style.display = 'block';
        rdDeleteRouteButton.style.display = 'block';
        confirmDeleteButton.style.display = 'block';
        rdPointsEditButton.style.display = 'block';

        rdNameEditButton.addEventListener('click', click_rdNameEditButton);
        rdStatusToogleButton.addEventListener('click', click_rdStatusToogleButton);
        rdCompletionToogleButton.addEventListener('click', click_rdCompletionToogleButton);
        rdApplyRouteChangesButton.addEventListener('click', click_rdApplyRouteChangesButton);
        rdDeleteRouteButton.addEventListener('click', click_rdDeleteRouteButton);
        confirmDeleteButton.addEventListener('click', click_confirmDeleteButton);
        rdDescriptionEditButton.addEventListener('click', click_rdDescriptionEditButton);
        rdPointsEditButton.addEventListener('click', click_rdPointsEditButton);

        rateStars();
        bootDifficulty();
    }
    else {
        rdStarsRatingButton.classList.add('no-interaction');
        rdBootsDifficultyButton.classList.add('no-interaction');
        rdCompletionToogleButton.style.display = 'none';
        rdNameEditButton.style.display = 'none';
        rdStartDateButton.disabled = true;
        rdEndDateButton.disabled = true;
        rdDescriptionEditButton.style.display = 'none';
        rdApplyRouteChangesButton.style.display = 'none';
        rdDeleteRouteButton.style.display = 'none';
        confirmDeleteButton.style.display = 'none';
        rdPointsEditButton.style.display = 'none';
        rdLikeButton.addEventListener('click', click_rdLikeButton);
    }

    rdRoutePoints.addEventListener('mouseover', mouse_over_rdPoint);
    rdRoutePoints.addEventListener('mouseout', mouse_out_rdPoint);
}

// Routes Cards
function routes(){
    const routeLikeButtons = document.querySelectorAll('.routes-like-route-btn');

    routeLikeButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.stopPropagation(); // Prevent event bubbling to parent elements

            const selectedRouteId = this.getAttribute('data-route-id');
            const icon = this.querySelector('.icon-heart');
            const likeCountSpan = this.querySelector('small');

            // Send request to toggle like
            fetch(`/toggle_like/${selectedRouteId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/json',
                },
            })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        console.error('Error toggling like on route (routeLikeButtons): ', data.error);
                        showMessage('danger', 'An error occurred while toggling like on route.');
                        return;
                    }

                    // Update icon based on the new liked state
                    if (data.liked) {
                        icon.classList.remove('bi-heart');
                        icon.classList.add('bi-heart-fill');
                    } else {
                        icon.classList.remove('bi-heart-fill');
                        icon.classList.add('bi-heart');
                    }

                    // Update like count
                    likeCountSpan.textContent = `${data.likes_count}`;
                })
                .catch(error => {
                    console.error('Error toggling like on route (routeLikeButtons): ', error);
                    showMessage('danger', 'An error occurred while toggling like on route.');
                });
        });
    });
}

// main
document.addEventListener('DOMContentLoaded', function() {
    const currentUrl = window.location.href; // current page url

    // Init ALL tooltip
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl, {
            fallbackPlacements: []
        });
    });

    toggleButtons.forEach(button => button.addEventListener("click", () => collapseSidebarGroup(button)));

    if(currentUrl.includes('profile') || currentUrl.includes('register')){
        avatarEditing();
    } else if(currentUrl.includes('my-places')) {
        myPlaces();
    } else if(currentUrl.includes('/route/')){
        routeDetailsPage();
    } else if(currentUrl.includes('/routes/')){
        routes();
    }
});