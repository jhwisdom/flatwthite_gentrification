const MAPTILER_STYLE_URL = 'https://api.maptiler.com/maps/01a0d3cd-a4c3-74a0-b334-a7b39dbe66a8/style.json?key=WiAh6CxRmr05hDg1jDBe';
const FRANKFURT_CENTER = [8.6821, 50.1109]; // [lng, lat]

// ---------------------------------------------------------------
// Main interactive map (#map) — POI search + categories live here
// ---------------------------------------------------------------
const map = new maplibregl.Map({
    container: 'map',
    style: MAPTILER_STYLE_URL,
    center: FRANKFURT_CENTER,
    zoom: 12,
    minZoom: 11,
    maxZoom: 17,
    dragPan: false,
    scrollZoom: false,
    doubleClickZoom: false,
    touchZoomRotate: false,
    boxZoom: false,
    keyboard: false,
    attributionControl: false,
});

map.on('load', () => {
    map.addControl(new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
            '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ' +
            '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
    }));

    fetch('poi_frankfurt_points2.geojson')
        .then(res => res.json())
        .then(data => {
            poiData = data;
            // search bar starts empty — nothing rendered until the user searches
        });
});

// ---------------------------------------------------------------
// Area overview map (#areaMap)
// ---------------------------------------------------------------
const areaMap = new maplibregl.Map({
    container: 'areaMap',
    style: MAPTILER_STYLE_URL,
    center: FRANKFURT_CENTER,
    zoom: 11,
    dragPan: false,
    scrollZoom: false,
    doubleClickZoom: false,
    touchZoomRotate: false,
    boxZoom: false,
    keyboard: false,
});

areaMap.on('load', () => {
    fetch('frankfurt_boundaries.geojson')
        .then(res => res.json())
        .then(data => {
            areaMap.addSource('frankfurt-boundary', { type: 'geojson', data });
            areaMap.addLayer({
                id: 'frankfurt-boundary-line',
                type: 'line',
                source: 'frankfurt-boundary',
                paint: {
                    'line-color': '#3388ff',
                    'line-width': 3,
                    'line-opacity': 1,
                },
            });
        });
});

// ---------------------------------------------------------------
// Shared helper: a simple colored circle marker + popup
// ---------------------------------------------------------------
function addCircleMarker(feature, color) {
    const [lng, lat] = feature.geometry.coordinates;
    const label = feature.properties.name
        || feature.properties.shop
        || feature.properties.amenity
        || 'Point of Interest';

    const el = document.createElement('div');
    el.className = 'circle-marker';
    el.style.backgroundColor = color;

    return new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        //.setPopup(new maplibregl.Popup({ offset: 12 }).setText(label))
        .addTo(map);
}

let poiData = null; // holds the raw geojson once loaded

// ---------------------------------------------------------------
// Search bar — ONE fixed color, replaces its own markers each search
// ---------------------------------------------------------------
const SEARCH_COLOR = '#A08BFD70'; // change this to whatever color you want search results to be

let searchMarkers = [];
const input = document.getElementById('search');

function matchesQuery(feature, query) {
    if (!query) return false;
    const props = feature.properties || {};
    const haystack = [
        props.name, props.shop, props.amenity, props.cuisine,
        props.leisure, props.tourism, props.sport,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase());
}

function renderFilteredPOIs(query) {
    if (!poiData) return;

    // clear only the previous SEARCH markers — categories are untouched
    searchMarkers.forEach(marker => marker.remove());
    searchMarkers = [];

    poiData.features
        .filter(feature => matchesQuery(feature, query))
        .forEach(feature => {
            searchMarkers.push(addCircleMarker(feature, SEARCH_COLOR));
        });
}

input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        const query = input.value.trim();
        if (query) handleSearch(query);
    }
});

function handleEnterButton() {
    const query = input.value.trim();
    if (query) handleSearch(query);
}

function handleSearch(query) {
    window.scrollTo(0, 700);
    renderFilteredPOIs(query);
}

// ---------------------------------------------------------------
// Category toggles (left sidebar / #toolbox) — each has its own
// fixed color, stays on the map independently of the search bar.
// Edit this list once you know your real categories + match rules.
// ---------------------------------------------------------------
const CATEGORIES = [
    { key: 'pilates', label: 'Pilates', color: '#2a9d8f', match: f => matchesQuery(f, 'pilates') },
    { key: 'bike', label: 'Bike', color: '#457b9d', match: f => matchesQuery(f, 'bike') },
    // add more: { key: 'cafe', label: 'Cafés', color: '#f4a261', match: f => matchesQuery(f, 'cafe') },
];

const categoryMarkers = {}; // key -> array of markers currently shown
const categoryActive = {};  // key -> boolean

function toggleCategory(key) {
    if (!poiData) return; // POIs not loaded yet

    const category = CATEGORIES.find(c => c.key === key);
    if (!category) return;

    if (categoryActive[key]) {
        // currently on -> turn off, remove its markers only
        (categoryMarkers[key] || []).forEach(marker => marker.remove());
        categoryMarkers[key] = [];
        categoryActive[key] = false;
    } else {
        // currently off -> turn on, add markers in this category's color
        categoryMarkers[key] = poiData.features
            .filter(category.match)
            .map(feature => addCircleMarker(feature, category.color));
        categoryActive[key] = true;
    }
}

// Minimal auto-generated buttons inside #toolbox, one per category.
// Replace this with your own sidebar markup once it's designed —
// just make sure each button calls toggleCategory('<key>') on click.
function renderCategoryToolbox() {
    const toolbox = document.getElementById('toolbox');
    toolbox.innerHTML = '';
    CATEGORIES.forEach(category => {
        const btn = document.createElement('button');
        btn.textContent = category.label;
        btn.style.borderLeft = `6px solid ${category.color}`;
        btn.addEventListener('click', () => toggleCategory(category.key));
        toolbox.appendChild(btn);
    });
}

map.on('load', () => {
    // build the toolbox once the map exists; toggling still waits on poiData internally
    renderCategoryToolbox();
});