const fs = require('fs');

const data = JSON.parse(fs.readFileSync('poi_frankfurt_points.geojson', 'utf8'));

// Distance between two points in meters (Haversine formula)
function distanceMeters(coord1, coord2) {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    const R = 6371000; // Earth radius in meters
    const toRad = deg => deg * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const DISTANCE_THRESHOLD_METERS = 50; // tune this as needed

const kept = [];
const removedCount = { total: 0 };

data.features.forEach(feature => {
    const name = feature.properties?.name;
    const coords = feature.geometry?.coordinates;

    if (!name || !coords) {
        kept.push(feature); // keep features with no name/coords untouched
        return;
    }

    // check against everything already kept
    const isDuplicate = kept.some(existing => {
        const existingName = existing.properties?.name;
        const existingCoords = existing.geometry?.coordinates;
        if (existingName !== name || !existingCoords) return false;

        return distanceMeters(coords, existingCoords) < DISTANCE_THRESHOLD_METERS;
    });

    if (isDuplicate) {
        removedCount.total++;
    } else {
        kept.push(feature);
    }
});

const deduped = {
    type: "FeatureCollection",
    features: kept
};

fs.writeFileSync('poi_frankfurt_points2.geojson', JSON.stringify(deduped));
console.log(`Removed ${removedCount.total} duplicate(s). Kept ${kept.length} of ${data.features.length} features.`);