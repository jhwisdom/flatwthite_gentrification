// Shared settings for both pages.
window.APP_CONFIG = {
  // Paste the Google Apps Script web app URL here (ends with /exec).
  // Leave it empty to run the pages with built-in demo data (nothing is saved).
  API_URL: "",

  // Input limits. Keep them in sync with apps-script/Code.gs.
  MAX_INDICATOR_LENGTH: 60,
  MAX_COMMENT_LENGTH: 200,

  // How often the pages reload data from the sheet (milliseconds).
  POLL_INTERVAL_MS: 8000,

  // Map start view: Frankfurt am Main.
  MAP_CENTER: [50.1109, 8.6821],
  MAP_ZOOM: 13,

  // Mietspiegel overlays. Each one gets its own checkbox and legend.
  // url:      GeoJSON file with the areas (replace the demo files with real data)
  // property: name of the value in each feature's properties
  // breaks:   class limits; an area gets colors[i] for the first breaks[i] its value is below
  // colors:   one more entry than breaks (the last one is for values above the last break)
  OVERLAYS: [
    {
      id: "rent",
      label: "Average rent (€/m²)",
      url: "data/rent-demo.geojson",
      property: "avg_rent",
      breaks: [11, 13, 15, 17],
      colors: ["#fef0d9", "#fdcc8a", "#fc8d59", "#e34a33", "#b30000"],
      legendLabels: ["< 11", "11–13", "13–15", "15–17", "≥ 17"],
    },
    {
      id: "location",
      label: "Location class (1–10)",
      url: "data/location-demo.geojson",
      property: "location_class",
      breaks: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      colors: ["#f7fcf0", "#e0f3db", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#0868ac", "#084081", "#041f4a"],
      legendLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    },
  ],
};
