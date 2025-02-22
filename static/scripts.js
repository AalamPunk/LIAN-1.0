let startMarker = null;
let endMarker = null;
let routeLayer = null;
let explorationLayer = null;



// Click handlers
map.on('click', (e) => {
    if (!startMarker) {
        startMarker = L.marker(e.latlng).addTo(map);
    } else if (!endMarker) {
        endMarker = L.marker(e.latlng).addTo(map);
        // Removed automatic call to calculatePath()
    }
});

// Animate exploration: add one circle marker at a time.
function animateExploration(explorationCoords, callback) {
    explorationLayer = L.layerGroup().addTo(map);
    let index = 0;
    function drawNext() {
        if (index < explorationCoords.length) {
            const coord = explorationCoords[index];
            let lat, lng;
            if (coord) {
                if (Array.isArray(coord)) {
                    // Assuming the coordinate array is [lat, lng] or [lat, lon]
                    lat = parseFloat(coord[0]);
                    lng = parseFloat(coord[1]);
                } else if (typeof coord === 'object') {
                    // Try to get lng or lon
                    if (coord.lat != null && (coord.lng != null || coord.lon != null)) {
                        lat = parseFloat(coord.lat);
                        lng = coord.lng != null ? parseFloat(coord.lng) : parseFloat(coord.lon);
                    }
                }
            }
            if (!isNaN(lat) && !isNaN(lng)) {
                L.circleMarker([lat, lng], { color: 'blue', radius: 5 }).addTo(explorationLayer);
            } else {
                console.warn(`Skipping invalid coordinate at index ${index}:`, coord);
            }
            index++;
            setTimeout(drawNext, 100); // Delay between markers
        } else {
            if (callback) callback();
        }
    }
    drawNext();
}

function animateExplorationEdges(segments, onComplete) {
    if (!segments || segments.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    explorationLayer = L.layerGroup().addTo(map);
    let index = 0;
    function drawNext() {
        if (index < segments.length) {
            // Draw the current edge segment.
            L.polyline(segments[index], { color: 'blue', weight: 3 }).addTo(explorationLayer);
            index++;
            // Delay (in milliseconds) between drawing each segment.
            setTimeout(drawNext, 100);  // Adjust delay as needed to slow/speed the animation.
        } else {
            if (onComplete) onComplete();
        }
    }
    drawNext();
}

function animateExplorationBranches(segments, onComplete) {
    if (!segments || segments.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    explorationLayer = L.layerGroup().addTo(map);
    let completedBranches = 0;

    segments.forEach(segment => {
        // For each branch, create an empty polyline
        let branchLine = L.polyline([], { color: 'blue', weight: 3 }).addTo(explorationLayer);
        let index = 0;
        function animateBranch() {
            if (index < segment.length) {
                branchLine.addLatLng(segment[index]);
                index++;
                // Delay between adding successive points (adjust as needed)
                setTimeout(animateBranch, 50);
            } else {
                completedBranches++;
                // When all branches finished, call onComplete
                if (completedBranches === segments.length && onComplete) {
                    onComplete();
                }
            }
        }
        animateBranch();
    });
}

// After receiving finalCoords from the backend, create the route layer with glowing effect:
routeLayer = L.polyline([], {
    color: 'red',
    weight: 5,
    className: 'glow-polyline'
}).addTo(map);

// Then animate the final path as before:
function animateFinalPath(finalCoords, callback) {
    let index = 1;
    function animate() {
        if (index >= finalCoords.length) {
            if (callback) callback();
            return;
        }
        // Append the next coordinate to the glowing polyline
        routeLayer.addLatLng(finalCoords[index]);
        index++;
        requestAnimationFrame(animate);
    }
    animate();
}

function displayInfoBar(data) {
    let dataBar = document.getElementById('dataBar');
    console.log("Raw distance from backend:", data.distance);

    let distance = parseFloat(data.distance);
    if (isNaN(distance)) {
        distance = 0;
    }
    
    // Convert the distance from meters to kilometers.
    let kmDistance = distance / 1000;
    
    let distanceStr = `${kmDistance.toFixed(2)} km`;
    
    dataBar.innerHTML = `Distance: ${distanceStr} | Explored Nodes: ${data.num_explored} | Final Path Nodes: ${data.num_final_path}`;
    dataBar.style.display = "block";
}

function calculatePath() {
    document.getElementById('loading').style.display = 'block';

    const algorithm = document.getElementById('algorithm').value;
    if (explorationLayer) map.removeLayer(explorationLayer);
    if (routeLayer) map.removeLayer(routeLayer);

    fetch('/get-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            start_lat: startMarker.getLatLng().lat,
            start_lon: startMarker.getLatLng().lng,
            end_lat: endMarker.getLatLng().lat,
            end_lon: endMarker.getLatLng().lng,
            algorithm: algorithm
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.exploration && Array.isArray(data.exploration) && data.exploration.length > 0 &&
            data.final_path && Array.isArray(data.final_path) && data.final_path.length > 0) {

            console.log("Exploration coordinates:", data.exploration);

            // Create the final path polyline with glowing effect.
            routeLayer = L.polyline([], {
                color: 'red',
                weight: 5,
                className: 'glow-polyline'
            }).addTo(map);

            // Animate exploration nodes first, then animate final path.
            animateExploration(data.exploration, function() {
                animateFinalPath(data.final_path, function() {
                    displayInfoBar(data);
                    document.getElementById('loading').style.display = 'none';
                });
            });
        } else {
            console.error("Invalid data format", data);
            document.getElementById('loading').style.display = 'none';
        }
    })
    .catch(err => {
        console.error("Error fetching path:", err);
        document.getElementById('loading').style.display = 'none';
    });
}

function clearMap() {
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routeLayer) map.removeLayer(routeLayer);
    if (explorationLayer) map.removeLayer(explorationLayer);
    startMarker = null;
    endMarker = null;
}

function renderExplorationSegments(segments) {
    explorationLayer = L.layerGroup().addTo(map);
    segments.forEach(segment => {
        L.polyline(segment, { color: 'blue', weight: 3 }).addTo(explorationLayer);
    });
}

function renderExplorationMarkers(markers) {
    markers.forEach(marker => {
        L.circleMarker([marker.lat, marker.lon], { radius: marker.radius })
         .addTo(map)
         .bindPopup("Order: " + marker.order);
    });
}

// Only add the toggle event listener if the element exists
var sidebarToggle = document.getElementById('toggleSidebar');
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function() {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
}

// Add event listeners for the search button and 'Enter' key in the input.
document.getElementById('searchBtn').addEventListener('click', searchLocation);
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchLocation();
    }
});

function searchLocation() {
    const query = document.getElementById('searchInput').value;
    if (query.trim() === "") {
        alert("Please enter a location");
        return;
    }
    // Use Nominatim's geocoding API to get the location's coordinates.
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      .then(response => response.json())
      .then(data => {
         if (data && data.length > 0) {
              const lat = parseFloat(data[0].lat);
              const lon = parseFloat(data[0].lon);
              // Center the map on the returned coordinates. Adjust zoom level as needed.
              map.setView([lat, lon], 13);
         } else {
              alert("Location not found.");
         }
      })
      .catch(err => {
          console.error("Geocoding error:", err);
          alert("Error searching location");
      });
}

var viewReportBtn = document.getElementById('viewReportBtn');
if (viewReportBtn) {
    viewReportBtn.addEventListener('click', function() {
        var pdfContainer = document.getElementById('pdfContainer');
        // Toggle display
        if (pdfContainer.style.display === 'none' || pdfContainer.style.display === '') {
            pdfContainer.style.display = 'block';
        } else {
            pdfContainer.style.display = 'none';
        }
    });
}

// Example: After a successful fetch using actual cached data
fetch('/get-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        start_lat: startMarker.getLatLng().lat,
        start_lon: startMarker.getLatLng().lng,
        end_lat: endMarker.getLatLng().lat,
        end_lon: endMarker.getLatLng().lng,
        algorithm: document.getElementById('algorithm').value
    })
})
.then(response => response.json())
.then(data => {
    // data.final_path holds an array of [lat, lon] coordinates.
    renderAnimatedPath(data.final_path);
});

function renderAnimatedPath(finalPathCoords) {
    console.log("Animating path:", finalPathCoords);
    // Remove any existing route layer.
    if (window.routeLayer) {
        map.removeLayer(window.routeLayer);
    }
    // Create an animated ant path using leaflet-ant-path.
    window.routeLayer = L.polyline.antPath(finalPathCoords, {
        paused: false,
        reverse: false,
        hardwareAccelerated: true,
        delay: 300,       
        dashArray: [10, 20],
        weight: 5,
        color: '#00FF00', // Use a bright color to ensure visibility.
        pulseColor: '#FFFFFF',
        opacity: 0.8,
        className: 'glow-polyline'
    });
    window.routeLayer.addTo(map);
}