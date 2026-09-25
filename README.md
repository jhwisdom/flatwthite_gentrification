# Flat-White-Gentrification (prototype)

## We are... 

Two static pages for GitHub Pages, with Google Sheets as the database.

| File | Purpose |
|---|---|
| `index.html` | Landing page (QR code target): one text field; submitted indicators float in the background |
| `map.html` | OpenStreetMap centred on Frankfurt am Main; long-press to add a pin; indicator filter; Mietspiegel layers (average rent, location class) |
| `config.js` | All settings (API URL, limits, map centre, polling interval) |
| `api.js` | Shared code that talks to the Apps Script backend |
| `apps-script/Code.gs` | Backend, pasted into Google Apps Script |
| `data/rent-demo.geojson`, `data/location-demo.geojson` | **Demo grids with random values, not real data.** Replace with the real Mietspiegel |

With `API_URL` empty in `config.js`, the pages run in demo mode with sample data and save nothing.

## 1. Google Sheet + Apps Script

1. Create a new Google Sheet.
2. **Extensions → Apps Script**, replace the content of `Code.gs` with `apps-script/Code.gs`, save.
3. Choose `setup` in the function menu and click **Run** (grant permissions). This creates the sheets `indicators` and `pins`.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the web app URL (ends with `/exec`) into `API_URL` in `config.js`.

After changing `Code.gs` later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

## 2. Approval vs. no approval

In `Code.gs`, set:

```js
const REQUIRE_APPROVAL = true;  // entries appear after you tick "approved" in the sheet
const REQUIRE_APPROVAL = false; // entries appear immediately
```

then redeploy (new version). With approval on, a new indicator typed while adding a pin creates a row in **both** sheets; tick both to show it everywhere.

## 3. GitHub Pages

Push all files to a repository, then **Settings → Pages → Deploy from branch → main / root**.
Point the QR code at `https://<user>.github.io/<repo>/`.

## Data

- `indicators`: id, created_at, indicator, approved — every submission is kept as a row; the page shows each word only once (case and extra spaces ignored).
- `pins`: id, created_at, lat, lng, indicator, comment, approved.

## Mietspiegel layers

Two separate checkboxes, defined in `OVERLAYS` in `config.js`:

| Layer | File | Property | Colour classes |
|---|---|---|---|
| Average rent (€/m²) | `data/rent-demo.geojson` | `avg_rent` | < 11, 11–13, 13–15, 15–17, ≥ 17 |
| Location class (1–10) | `data/location-demo.geojson` | `location_class` | 1 … 10 |

To use real data, replace the files (or change `url`) and keep the property names, or change `property`.
Class limits and colours are set with `breaks` / `colors` / `legendLabels`. All properties of an area are shown in its popup.
