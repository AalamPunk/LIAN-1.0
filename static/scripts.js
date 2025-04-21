let startMarker = null;
let endMarker = null;
let routeLayer = null;
let explorationLayer = null;
let radarCircle = null;

map.on('click', (e) => {
    if (!startMarker) {
        startMarker = L.marker(e.latlng).addTo(map);
        radarCircle = L.circle(e.latlng, {
            radius: 1000,
            color: '#3388ff',
            fillColor: '#3388ff',
            fillOpacity: 0.2,
            dashArray: '5,5'
        }).addTo(map);
    } else if (!endMarker) {
        if (radarCircle && radarCircle.getBounds().contains(e.latlng)) {
            endMarker = L.marker(e.latlng).addTo(map);
            map.removeLayer(radarCircle);
            radarCircle = null;
        } else {
            alert("Please select an end point within the 1 km radius.");
        }
    }
});

function animateExploration(explorationCoords, callback) {
    if (explorationLayer) map.removeLayer(explorationLayer);
    explorationLayer = L.layerGroup().addTo(map);
    let index = 0;
    function drawNext() {
        if (index < explorationCoords.length) {
            const coord = explorationCoords[index];
            let lat, lng;
            if (coord) {
                if (Array.isArray(coord)) {
                    lat = parseFloat(coord[0]);
                    lng = parseFloat(coord[1]);
                } else if (typeof coord === 'object') {
                    if (coord.lat != null && (coord.lng != null || coord.lon != null)) {
                        lat = parseFloat(coord.lat);
                        lng = coord.lng != null ? parseFloat(coord.lng) : parseFloat(coord.lon);
                    }
                }
            }
            if (!isNaN(lat) && !isNaN(lng)) {
                L.circleMarker([lat, lng], { color: 'blue', radius: 5 }).addTo(explorationLayer);
            }
            index++;
            setTimeout(drawNext, 100);
        } else {
            if (callback) callback();
        }
    }
    drawNext();
}

function animateFinalPath(finalCoords, callback) {
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.polyline([], {
        color: 'red',
        weight: 5,
        className: 'glow-polyline'
    }).addTo(map);

    const uniqueCoords = [];
    const seen = new Set();

    finalCoords.forEach(coord => {
        const key = coord.join(',');
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCoords.push(coord);
        }
    });

    let index = 0;
    function animate() {
        if (index >= uniqueCoords.length) {
            if (callback) callback();
            return;
        }
        routeLayer.addLatLng(uniqueCoords[index]);
        index++;
        requestAnimationFrame(animate);
    }
    animate();
}

function displayInfoBar(data) {
    let dataBar = document.getElementById('dataBar');
    let distance = parseFloat(data.distance);
    if (isNaN(distance)) distance = 0;
    let kmDistance = distance / 1000;
    let distanceStr = `${kmDistance.toFixed(2)} km`;
    dataBar.innerHTML = `Distance: ${distanceStr} | Explored Nodes: ${data.num_explored} | Final Path Nodes: ${data.num_final_path}`;
    dataBar.style.display = "block";
}

function calculatePath() {
    document.getElementById('loading').style.display = 'block';

    const algorithm = document.getElementById('algorithm').value;

    if (explorationLayer) {
        map.removeLayer(explorationLayer);
        explorationLayer = null;
    }
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }

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
        if (data.exploration && Array.isArray(data.exploration) &&
            data.final_path && Array.isArray(data.final_path)) {

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

document.getElementById('toggleSidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('collapsed');
});

document.getElementById('searchBtn')?.addEventListener('click', searchLocation);
document.getElementById('searchInput')?.addEventListener('keypress', function(e) {
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
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      .then(response => response.json())
      .then(data => {
         if (data && data.length > 0) {
              const lat = parseFloat(data[0].lat);
              const lon = parseFloat(data[0].lon);
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

document.getElementById('viewReportBtn')?.addEventListener('click', () => {
    const pdfContainer = document.getElementById('pdfContainer');
    const isExpanded = pdfContainer.style.display === 'block';
    pdfContainer.style.display = isExpanded ? 'none' : 'block';
    document.getElementById('viewReportBtn').setAttribute('aria-expanded', !isExpanded);
});

document.getElementById('screenshotBtn')?.addEventListener('click', () => {
    const mapContainer = document.getElementById('map');
    const dataBar = document.getElementById('dataBar');
    const originalDisplay = dataBar.style.display;
    dataBar.style.display = 'block';

    html2canvas(mapContainer, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: window.devicePixelRatio
    }).then(canvas => {
        const link = document.createElement('a');
        link.href = canvas.toDataURL("image/png");
        link.download = 'final-path-screenshot.png';
        link.click();

        dataBar.style.display = originalDisplay;
    }).catch(error => {
        console.error("Screenshot failed:", error);
        alert("Error capturing the map screenshot.");
        dataBar.style.display = originalDisplay;
    });
});
