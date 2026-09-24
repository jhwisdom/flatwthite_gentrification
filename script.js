// Initialize the map with MapTiler
const map = L.map('map').setView([50.1109, 8.6821], 13); // Frankfurt coordinates

// Add MapTiler layer (replace YOUR_MAPTILER_KEY with your actual key)
L.tileLayer('https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=4dQmVB8bRuFfGXFPPxg3', {
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
}).addTo(map);

// Load GeoJSON data
fetch('frankfurt.geojson')
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng).bindPopup(
                    feature.properties.name || feature.properties.shop || "Pilates Location"
                );
            }
        }).addTo(map);
    });

// Optional: Add search functionality (for later real-time extension)
document.getElementById('search').addEventListener('change', (e) => {
    const query = e.target.value;
    alert(`Searching for: ${query} (Real-time functionality to be added later)`);
});