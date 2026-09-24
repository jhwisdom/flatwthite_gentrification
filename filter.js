const fs = require('fs');

const data = JSON.parse(fs.readFileSync('frankfurt.geojson', 'utf8'));

const filtered = {
    type: "FeatureCollection",
    features: data.features.filter(feature => {
        const props = feature.properties || {};
        const haystack = [
            props.name, props.sport, props.leisure, props.shop, props.amenity
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack;
    })
};

fs.writeFileSync('poi_frankfurt.geojson', JSON.stringify(filtered));
console.log(`Found ${filtered.features.length} matching features`);