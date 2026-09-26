const MAPTILER_STYLE_URL = 'https://api.maptiler.com/maps/01a0d3cd-a4c3-74a0-b334-a7b39dbe66a8/style.json?key=WiAh6CxRmr05hDg1jDBe';
const FRANKFURT_CENTER = [8.6821, 50.1109]; // [lng, lat]

// ---------------------------------------------------------------
// Main interactive map (#map) — POI search + categories live here
// ---------------------------------------------------------------
const map = new maplibregl.Map({
    container: 'map',
    style: MAPTILER_STYLE_URL,
    center: FRANKFURT_CENTER,
    zoom: 12.5,
    minZoom: 12,
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
        fetch('leerstandsmelder.geojson').then(res => res.json()),
        fetch('nettokaltmiete.geojson').then(res => res.json()),
    ]).then(([poi, locationAreas, vacancies, rentalPrices]) => {
        poiData = poi;
        setupPointLayers(locationAreas, vacancies, rentalPrices); // build all layers once both datasets are ready
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
const CUSTOM_CATEGORY_COLOR = '#6E29C1';

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
            'circle-radius': 15,
            'circle-color': CUSTOM_CATEGORY_COLOR,
            'circle-opacity': 1,
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
const SEARCH_COLOR = '#A08BFD';
const SEARCH_SOURCE_ID = 'search-points';
const SEARCH_LAYER_ID = 'search-points-layer';
const LOCATION_AREAS_SOURCE_ID = 'location-areas';
const LOCATION_AREAS_FILL_LAYER_ID = 'location-areas-fill';
const LOCATION_AREAS_LINE_LAYER_ID = 'location-areas-line';
const RENTAL_PRICES_SOURCE_ID = 'rental-prices';
const RENTAL_PRICES_FILL_LAYER_ID = 'rental-prices-fill';
const RENTAL_PRICES_LINE_LAYER_ID = 'rental-prices-line';
const LOCATION_AREAS_COLOR = [
    'interpolate',
    ['linear'],
    ['to-number', ['get', 'location_class']],
    1, '#2FC4FF',
    10, '#DB5DCE',
];
const RENTAL_PRICES_COLOR = [
    'interpolate',
    ['linear'],
    ['to-number', ['get', 'value']],
    1.48, '#2d2aee',
    12, '#d2f547',
    25, '#f9484b',
    41.17, '#ad121a',
];

function matchesQuery(feature, query) {
    if (!query) return false;
    const props = feature.properties || {};
    const haystack = [
        props.name, props.shop, props.amenity, props.cuisine,
        props.leisure, props.tourism, props.sport, props.office,
        props.craft, props.brand,
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
    document.getElementById("toolbox").scrollIntoView();
    renderFilteredPOIs(query);
    updateSearchResultsButtonLabel();
}

// ---------------------------------------------------------------
// Category toggles (left sidebar / #toolbox) — each has its own
// fixed color, stays on the map independently of the search bar.
// Edit this list once you know your real categories + match rules.
// ---------------------------------------------------------------
const CATEGORIES = [
    { key: 'coffee', label: 'Coffee', color: '#99E73C', match: f => f.properties?.amenity === 'cafe' || f.properties?.cuisine === 'coffee_shop' || matchesQuery(f, 'coffee') },
    { key: 'winebar', label: 'Winebar', color: '#F68486', match: f => ['winebar', 'wine bar', 'weinbar', 'wein bar'].some(term => matchesQuery(f, term)) },
    { key: 'pilates', label: 'Pilates', color: '#2FC4FF', match: f => f.properties?.sport === 'pilates' || matchesQuery(f, 'pilates') },
    { key: 'gallery', label: 'Gallery', color: '#DB5DCE', match: f => f.properties?.tourism === 'gallery' || matchesQuery(f, 'gallery') },
    { key: 'coworking', label: 'Coworking', color: '#FF9ECB', match: f => f.properties?.office === 'coworking' || matchesQuery(f, 'coworking') },
    { key: 'delicatesse', label: 'Delicatesse', color: '#3D4E0A', match: f => ['deli', 'delicatessen'].includes(f.properties?.shop) || matchesQuery(f, 'delicatessen') },
    { key: 'design', label: 'Design', color: '#DFC269', match: f => matchesQuery(f, 'design') },
    { key: 'bike', label: 'Bike', color: '#4CD6FF', match: f => matchesQuery(f, 'bike') },
];

const categoryActive = {}; // key -> boolean
const searchResultsButton = document.querySelector('[data-map-toggle="search"]');

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

function toggleRentalPrices() {
    const isVisible = map.getLayoutProperty(RENTAL_PRICES_FILL_LAYER_ID, 'visibility') !== 'none';
    const visibility = isVisible ? 'none' : 'visible';
    map.setLayoutProperty(RENTAL_PRICES_FILL_LAYER_ID, 'visibility', visibility);
    map.setLayoutProperty(RENTAL_PRICES_LINE_LAYER_ID, 'visibility', visibility);
}

function toggleSearchResults() {
    const isVisible = map.getLayoutProperty(SEARCH_LAYER_ID, 'visibility') !== 'none';
    map.setLayoutProperty(SEARCH_LAYER_ID, 'visibility', isVisible ? 'none' : 'visible');
}

function getMapToggleVisibility(key) {
    const layerId = key === 'search'
        ? SEARCH_LAYER_ID
        : key === 'wohnlage'
            ? LOCATION_AREAS_FILL_LAYER_ID
            : key === 'rental'
                ? RENTAL_PRICES_FILL_LAYER_ID
            : categoryLayerId(key);
    return map.getLayoutProperty(layerId, 'visibility') !== 'none';
}

function setMapToggleButtonState(button, isActive) {
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
}

function syncCityDataLegend() {
        document.querySelectorAll('[data-legend-for]').forEach(legend => {
                const key = legend.dataset.legendFor;
                legend.classList.toggle('is-visible', getMapToggleVisibility(key));
        });
}

function getMapToggleColor(key) {
    if (key === 'wohnlage') return '#00A7A0';
    if (key === 'rental') return '#F68486';
    const color = key === 'search'
        ? SEARCH_COLOR
        : key === CUSTOM_CATEGORY_KEY
            ? CUSTOM_CATEGORY_COLOR
            : key === 'vacancies'
                ? '#f90303'
            : CATEGORIES.find(category => category.key === key)?.color || '#B2DB5D';
    return color;
}

function bindMapToggleButtons() {
    document.querySelectorAll('[data-map-toggle]').forEach(button => {
        const key = button.dataset.mapToggle;
        button.style.setProperty('--map-toggle-color', getMapToggleColor(key));
        setMapToggleButtonState(button, getMapToggleVisibility(key));
        button.addEventListener('click', () => {
            if (key === 'search') toggleSearchResults();
            else if (key === 'wohnlage') {
                if (!getMapToggleVisibility(key)) {
                    map.setLayoutProperty(RENTAL_PRICES_FILL_LAYER_ID, 'visibility', 'none');
                    map.setLayoutProperty(RENTAL_PRICES_LINE_LAYER_ID, 'visibility', 'none');
                    setMapToggleButtonState(document.querySelector('[data-map-toggle="rental"]'), false);
                }
                toggleWohnlage();
            } else if (key === 'rental') {
                if (!getMapToggleVisibility(key)) {
                    map.setLayoutProperty(LOCATION_AREAS_FILL_LAYER_ID, 'visibility', 'none');
                    map.setLayoutProperty(LOCATION_AREAS_LINE_LAYER_ID, 'visibility', 'none');
                    setMapToggleButtonState(document.querySelector('[data-map-toggle="wohnlage"]'), false);
                }
                toggleRentalPrices();
            }
            else toggleCategory(key);

            setMapToggleButtonState(button, getMapToggleVisibility(key));
            syncCityDataLegend();
        });
    });
    syncCityDataLegend();
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
function setupPointLayers(locationAreasData, vacanciesData, rentalPricesData) {
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
        layout: { visibility: 'none' },
        paint: {
            'circle-radius': 8,
            'circle-color': SEARCH_COLOR,
            'circle-opacity': 0.44,
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
            'line-color': '#00A7A0',
            'line-opacity': 0.45,
            'line-width': 1,
        },
    }, beforeId);

    map.addSource(RENTAL_PRICES_SOURCE_ID, { type: 'geojson', data: rentalPricesData });
    map.addLayer({
        id: RENTAL_PRICES_FILL_LAYER_ID,
        type: 'fill',
        source: RENTAL_PRICES_SOURCE_ID,
        layout: { visibility: 'none' },
        paint: {
            'fill-color': RENTAL_PRICES_COLOR,
            'fill-opacity': 0.65,
        },
    }, beforeId);
    map.addLayer({
        id: RENTAL_PRICES_LINE_LAYER_ID,
        type: 'line',
        source: RENTAL_PRICES_SOURCE_ID,
        layout: { visibility: 'none' },
        paint: {
            'line-color': '#8E2F37',
            'line-opacity': 0.45,
            'line-width': 1,
        },
    }, beforeId);

    map.addSource(categorySourceId('vacancies'), { type: 'geojson', data: vacanciesData });
    map.addLayer({
        id: categoryLayerId('vacancies'),
        type: 'circle',
        source: categorySourceId('vacancies'),
        layout: { visibility: 'none' },
        paint: {
            'circle-color': '#000000',
            'circle-radius': 5,
            'circle-opacity': 0,
            'circle-stroke-color': '#000000',
            'circle-stroke-width': 1.5,
            'circle-stroke-opacity': 1,
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
                'circle-radius': 11,
                'circle-color': category.color,
                'circle-opacity': 0.65,
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
            'circle-radius': 11,
            'circle-color': CUSTOM_CATEGORY_COLOR,
            'circle-opacity': 0.65,
        },
    }, beforeId);
    categoryActive[CUSTOM_CATEGORY_KEY] = false;

    bindMapToggleButtons();
}

// Minimal auto-generated buttons inside #toolbox, one per category plus
// "My Points". Replace this with your own sidebar markup once it's
// designed — just make sure each button calls toggleCategory('<key>').
