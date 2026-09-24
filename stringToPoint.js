const fs = require('fs');

// ---- CONFIG ----
const INPUT_FILE = 'poi_frankfurt_deduped2.geojson';
const OUTPUT_FILE = 'poi_frankfurt_points.geojson';

// ---- Convert LineStrings to Points (centroid) ----
function lineStringToPoint(feature) {
    const coords = feature.geometry.coordinates;
    const total = coords.reduce(
        (acc, [lon, lat]) => {
            acc.lon += lon;
            acc.lat += lat;
            return acc;
        },
        { lon: 0, lat: 0 }
    );
    const centroid = [total.lon / coords.length, total.lat / coords.length];
    return {
        ...feature,
        geometry: { type: "Point", coordinates: centroid }
    };
}

// ---- Load, convert, write ----
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

let convertedCount = 0;
const converted = data.features.map(feature => {
    if (feature.geometry?.type === "LineString" || feature.geometry?.type === "MultiLineString" || feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon") {
        convertedCount++;
        return lineStringToPoint(feature);
    }
    return feature;
});

const output = {
    type: "FeatureCollection",
    features: converted
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));
console.log(`Converted ${convertedCount} LineString feature(s) to Points. Wrote ${converted.length} total features to ${OUTPUT_FILE}`);