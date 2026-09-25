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
    minZoom: 13,
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

    Promise.all([
        fetch('poi_frankfurt_points2.geojson').then(res => res.json()),
        fetch('location_areas.geojson').then(res => res.json()),
    ]).then(([poi, locationAreas]) => {
        poiData = poi;
        setupPointLayers(locationAreas); // build all layers once both datasets are ready
    });
});

// ---------------------------------------------------------------
// Area overview map (#areaMap)
// ---------------------------------------------------------------
const areaMap = new maplibregl.Map({
    container: 'areaMap',
    style: MAPTILER_STYLE_URL,
    center: FRANKFURT_CENTER,
    zoom: 13,
    dragPan: false,
    scrollZoom: false,
    doubleClickZoom: false,
    touchZoomRotate: false,
    boxZoom: false,
    keyboard: false,
});

// ---------------------------------------------------------------
// Click on the area map to drop a pin. Points are kept in
// localStorage (so they survive reloads in this browser) and are
// also shown live as their own toggleable category on #map.
// ---------------------------------------------------------------
const CUSTOM_POINTS_STORAGE_KEY = 'customPlacedPoints';
const CUSTOM_CATEGORY_KEY = 'custom';
const CUSTOM_CATEGORY_LABEL = 'My Points';
const CUSTOM_CATEGORY_COLOR = '#FF6B6B70';

const PLACED_PREVIEW_SOURCE_ID = 'placed-points-preview';
const PLACED_PREVIEW_LAYER_ID = 'placed-points-preview-layer';
const PREVIEW_HIDE_DELAY_MS = 3000;

let visiblePreviewPointsData = { type: 'FeatureCollection', features: [] };
const previewHideTimers = new Map();

function loadCustomPoints() {
    try {
        const raw = localStorage.getItem(CUSTOM_POINTS_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (err) {
        console.warn('Could not read saved points from localStorage:', err);
    }
    return { type: 'FeatureCollection', features: [] };
}

function saveCustomPointsToStorage() {
    try {
        localStorage.setItem(CUSTOM_POINTS_STORAGE_KEY, JSON.stringify(customPointsData));
    } catch (err) {
        console.warn('Could not save points to localStorage:', err);
    }
}

// loaded once at startup so both maps can use whatever was placed earlier
let customPointsData = loadCustomPoints();

function updateCustomCategoryOnMainMap() {
    const source = map.getSource(categorySourceId(CUSTOM_CATEGORY_KEY));
    if (source) source.setData(customPointsData); // no-op if #map isn't ready yet
}

function updateAreaMapPreview() {
    const source = areaMap.getSource(PLACED_PREVIEW_SOURCE_ID);
    if (source) source.setData(visiblePreviewPointsData);
}

function hidePreviewPoint(pointId) {
    visiblePreviewPointsData.features = visiblePreviewPointsData.features.filter(
        feature => feature.id !== pointId,
    );
    previewHideTimers.delete(pointId);
    updateAreaMapPreview();
}

function schedulePreviewHide(pointId) {
    const timer = setTimeout(() => hidePreviewPoint(pointId), PREVIEW_HIDE_DELAY_MS);
    previewHideTimers.set(pointId, timer);
}

function removePreviewPoint(pointId) {
    const timer = previewHideTimers.get(pointId);
    if (timer) clearTimeout(timer);
    hidePreviewPoint(pointId);
}

areaMap.on('load', () => {
    const beforeId = getFirstSymbolLayerId(areaMap);

    areaMap.addSource(PLACED_PREVIEW_SOURCE_ID, { type: 'geojson', data: visiblePreviewPointsData });
    areaMap.addLayer({
        id: PLACED_PREVIEW_LAYER_ID,
        type: 'circle',
        source: PLACED_PREVIEW_SOURCE_ID,
        paint: {
            'circle-radius': 20,
            'circle-color': CUSTOM_CATEGORY_COLOR,
        },
    }, beforeId);

    areaMap.getCanvas().style.cursor = 'url("DATADREAMS_icon_1.svg") 16 16, auto';

    areaMap.on('click', (event) => {
        const feature = {
            id: `custom-point-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [event.lngLat.lng, event.lngLat.lat],
            },
            properties: {},
        };
        customPointsData.features.push(feature);
        saveCustomPointsToStorage();

        visiblePreviewPointsData.features.push(feature);
        updateAreaMapPreview();
        schedulePreviewHide(feature.id);
        updateCustomCategoryOnMainMap();
    });

    renderNewPointsControls();
});

function undoLastCustomPoint() {
    const removedPoint = customPointsData.features.pop();
    if (removedPoint && removedPoint.id) removePreviewPoint(removedPoint.id);
    saveCustomPointsToStorage();
    updateCustomCategoryOnMainMap();
}

function clearCustomPoints() {
    customPointsData = { type: 'FeatureCollection', features: [] };
    previewHideTimers.forEach(timer => clearTimeout(timer));
    previewHideTimers.clear();
    visiblePreviewPointsData = { type: 'FeatureCollection', features: [] };
    saveCustomPointsToStorage();
    updateAreaMapPreview();
    updateCustomCategoryOnMainMap();
}

// Minimal auto-generated buttons under the area map. Replace with your
// own markup/placement once you've designed it.
function renderNewPointsControls() {
    const container = document.createElement('div');
    container.id = 'new-points-controls';

    const undoBtn = document.createElement('button');
    undoBtn.textContent = 'Undo last';
    undoBtn.addEventListener('click', undoLastCustomPoint);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', clearCustomPoints);

    container.appendChild(undoBtn);
    container.appendChild(clearBtn);

    document.querySelector('.areas').appendChild(container);
}

// ---------------------------------------------------------------
// Finds the first label ("symbol") layer in the style. Inserting our
// circle layers right before this one puts them above roads/buildings
// but underneath all text — so labels stay readable.
// Log map.getStyle().layers in the console if you want to insert
// relative to a different, more specific layer instead.
// ---------------------------------------------------------------
function getFirstSymbolLayerId(mapInstance) {
    const layers = mapInstance.getStyle().layers || [];
    const symbolLayer = layers.find(layer => layer.type === 'symbol');
    return symbolLayer ? symbolLayer.id : undefined;
}

let poiData = null; // holds the raw geojson once loaded

// ---------------------------------------------------------------
// Search bar — ONE fixed color, replaces its own points each search
// ---------------------------------------------------------------
const SEARCH_COLOR = '#A08BFD70'; // change this to whatever color you want search results to be
const SEARCH_SOURCE_ID = 'search-points';
const SEARCH_LAYER_ID = 'search-points-layer';
const LOCATION_AREAS_SOURCE_ID = 'location-areas';
const LOCATION_AREAS_FILL_LAYER_ID = 'location-areas-fill';
const LOCATION_AREAS_LINE_LAYER_ID = 'location-areas-line';
const LOCATION_AREAS_COLOR = [
    'interpolate',
    ['linear'],
    ['to-number', ['get', 'location_class']],
    1, '#fb0202',
    10, '#00fd08',
];

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

    const filtered = {
        type: 'FeatureCollection',
        features: poiData.features.filter(feature => matchesQuery(feature, query)),
    };

    map.getSource(SEARCH_SOURCE_ID).setData(filtered);
}

const input = document.getElementById('search');

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
    updateSearchResultsButtonLabel();
}

// ---------------------------------------------------------------
// Category toggles (left sidebar / #toolbox) — each has its own
// fixed color, stays on the map independently of the search bar.
// Edit this list once you know your real categories + match rules.
// ---------------------------------------------------------------
const CATEGORIES = [
    { key: 'pilates', label: 'Pilates', color: '#B2DB5D70', match: f => matchesQuery(f, 'pilates') },
    { key: 'bike', label: 'Bike', color: '#2FC4FF70', match: f => matchesQuery(f, 'bike') },
    { key: 'cafe', label: 'Cafés', color: '#FF9ECB70', match: f => matchesQuery(f, 'cafe') },
];

const categoryActive = {}; // key -> boolean
let searchResultsButton = null;

function categorySourceId(key) { return `category-${key}-points`; }
function categoryLayerId(key) { return `category-${key}-points-layer`; }

function toggleCategory(key) {
    const layerId = categoryLayerId(key);
    const isVisible = map.getLayoutProperty(layerId, 'visibility') !== 'none';
    map.setLayoutProperty(layerId, 'visibility', isVisible ? 'none' : 'visible');
    categoryActive[key] = !isVisible;
}

function toggleWohnlage() {
    const isVisible = map.getLayoutProperty(LOCATION_AREAS_FILL_LAYER_ID, 'visibility') !== 'none';
    const visibility = isVisible ? 'none' : 'visible';
    map.setLayoutProperty(LOCATION_AREAS_FILL_LAYER_ID, 'visibility', visibility);
    map.setLayoutProperty(LOCATION_AREAS_LINE_LAYER_ID, 'visibility', visibility);
}

function toggleSearchResults() {
    const isVisible = map.getLayoutProperty(SEARCH_LAYER_ID, 'visibility') !== 'none';
    map.setLayoutProperty(SEARCH_LAYER_ID, 'visibility', isVisible ? 'none' : 'visible');
}

function updateSearchResultsButtonLabel() {
    if (searchResultsButton) {
        searchResultsButton.textContent = input.value.trim() || 'Search results';
    }
}

// ---------------------------------------------------------------
// Build all map sources/layers once, right after the style
// and POI data are both ready. Everything starts empty/hidden and
// gets filled in by search or turned on by category toggles.
// ---------------------------------------------------------------
function setupPointLayers(locationAreasData) {
    const beforeId = getFirstSymbolLayerId(map);

    // search layer — starts empty, filled in on each search
    map.addSource(SEARCH_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
        id: SEARCH_LAYER_ID,
        type: 'circle',
        source: SEARCH_SOURCE_ID,
        paint: {
            'circle-radius': 20,
            'circle-color': SEARCH_COLOR,
        },
    }, beforeId);

    // Location areas stay visible as a transparent background layer.
    map.addSource(LOCATION_AREAS_SOURCE_ID, { type: 'geojson', data: locationAreasData });
    map.addLayer({
        id: LOCATION_AREAS_FILL_LAYER_ID,
        type: 'fill',
        source: LOCATION_AREAS_SOURCE_ID,
        layout: { visibility: 'none' },
        paint: {
            'fill-color': LOCATION_AREAS_COLOR,
            'fill-opacity': 0.65,
        },
    }, beforeId);
    map.addLayer({
        id: LOCATION_AREAS_LINE_LAYER_ID,
        type: 'line',
        source: LOCATION_AREAS_SOURCE_ID,
        layout: { visibility: 'none' },
        paint: {
            'line-color': '#3d3d3d',
            'line-opacity': 0.45,
            'line-width': 1,
        },
    }, beforeId);

    // one source/layer per category — pre-filled, hidden until toggled on
    CATEGORIES.forEach(category => {
        const filtered = {
            type: 'FeatureCollection',
            features: poiData.features.filter(category.match),
        };

        map.addSource(categorySourceId(category.key), { type: 'geojson', data: filtered });
        map.addLayer({
            id: categoryLayerId(category.key),
            type: 'circle',
            source: categorySourceId(category.key),
            layout: { visibility: 'none' },
            paint: {
                'circle-radius': 20,
                'circle-color': category.color,
            },
        }, beforeId);

        categoryActive[category.key] = false;
    });

    // "My Points" category — filled from whatever's been placed on the area map,
    // and kept live-updated by updateCustomCategoryOnMainMap() as more get added
    map.addSource(categorySourceId(CUSTOM_CATEGORY_KEY), { type: 'geojson', data: customPointsData });
    map.addLayer({
        id: categoryLayerId(CUSTOM_CATEGORY_KEY),
        type: 'circle',
        source: categorySourceId(CUSTOM_CATEGORY_KEY),
        layout: { visibility: 'none' },
        paint: {
            'circle-radius': 20,
            'circle-color': CUSTOM_CATEGORY_COLOR,
        },
    }, beforeId);
    categoryActive[CUSTOM_CATEGORY_KEY] = false;

    renderCategoryToolbox();
}

// Minimal auto-generated buttons inside #toolbox, one per category plus
// "My Points". Replace this with your own sidebar markup once it's
// designed — just make sure each button calls toggleCategory('<key>').
function renderCategoryToolbox() {
    const toolbox = document.getElementById('toolbox');
    toolbox.innerHTML = '';

    const entries = [
        { key: 'search', label: 'Search results', color: SEARCH_COLOR },
        { key: 'wohnlage', label: 'Wohnlage areas', color: '#3d3d3d' },
        ...CATEGORIES.map(c => ({ key: c.key, label: c.label, color: c.color })),
        { key: CUSTOM_CATEGORY_KEY, label: CUSTOM_CATEGORY_LABEL, color: CUSTOM_CATEGORY_COLOR },
    ];

    entries.forEach(entry => {
        const btn = document.createElement('button');
        btn.textContent = entry.key === 'search'
            ? input.value.trim() || entry.label
            : entry.label;
        btn.style.borderLeft = `6px solid ${entry.color}`;
        btn.addEventListener('click', () => {
            if (entry.key === 'search') toggleSearchResults();
            else if (entry.key === 'wohnlage') toggleWohnlage();
            else toggleCategory(entry.key);
        });
        if (entry.key === 'search') searchResultsButton = btn;
        toolbox.appendChild(btn);
    });
}
