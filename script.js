// Initialize the map with MapTiler
const map = L.map('map').setView([50.1109, 8.6821], 13); // Frankfurt coordinates

// Add MapTiler layer (replace YOUR_MAPTILER_KEY with your actual key)
L.tileLayer('https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=4dQmVB8bRuFfGXFPPxg3', {
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
}).addTo(map);

//disable move and zoom
map.dragging.disable();

//add max zoom out
map.setZoom(13);
map.setMinZoom(13);
map.setMaxZoom(17);
map.touchZoom.disable();
map.doubleClickZoom.disable();
map.scrollWheelZoom.disable();
map.boxZoom.disable();
map.keyboard.disable();

//hide the zoom control
map.zoomControl.remove();

let poiData = null;      // holds the raw geojson once loaded
let poiLayer = null;     // holds the currently-rendered Leaflet layer

const input = document.getElementById('search');  

// Load once when the page starts
fetch('poi_frankfurt_points2.geojson')
    .then(response => response.json())
    .then(data => {
        poiData = data;
        renderFilteredPOIs(''); // still call this, but it'll now render nothing
    });

function matchesQuery(feature, query) {
    if (!query) return false; // empty search = show nothing

    const props = feature.properties || {};
    const haystack = [
        props.name, props.shop, props.amenity, props.cuisine,
        props.leisure, props.tourism, props.sport
    ].filter(Boolean).join(' ').toLowerCase();

    return haystack.includes(query.toLowerCase());
}

function renderFilteredPOIs(query) {
    if (!poiData) return; // not loaded yet

    // remove the old layer before adding a new one
    if (poiLayer) {
        map.removeLayer(poiLayer);
    }

    poiLayer = L.geoJSON(poiData, {
        filter: feature => matchesQuery(feature, query),
        pointToLayer: function (feature, latlng) {
            const label = feature.properties.name
                || feature.properties.shop
                || feature.properties.amenity
                || "Point of Interest";
            return L.marker(latlng).bindPopup(label);
        }
    }).addTo(map);
}

input.addEventListener('keydown', (event) => {  
  // Check if the pressed key is Enter  
  if (event.key === 'Enter') {  
    event.preventDefault(); // Prevent default behavior (e.g., form submission)  
    const query = input.value.trim();  
    if (query) handleSearch(query); // Only trigger if input is not empty  
  }  
}); 

function handleEnterButton() { 
    const query = input.value.trim();  
    if (query) handleSearch(query); // Only trigger if input is not empty 
}

function handleSearch(query) {  
  //result.textContent = `Searching for: ${query}`;
  window.scrollTo(0, 700);  
  renderFilteredPOIs(query);
}

// Live filtering as the user types
/*document.getElementById('search').addEventListener('input', (e) => {
    renderFilteredPOIs(e.target.value);
});*/