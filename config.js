// NLS CONFIGURATION
// 1) Create a free Supabase project.
// 2) Paste your Project URL and public anon key below.
// 3) Run supabase-schema.sql in the Supabase SQL editor.
// 4) Sign in once, then add your user UUID to public.admin_users (instructions in README).
window.NLS_CONFIG = {
  SUPABASE_URL: "PASTE_YOUR_SUPABASE_URL_HERE",
  SUPABASE_ANON_KEY: "PASTE_YOUR_SUPABASE_ANON_KEY_HERE",

  // Public NASA COOLR landslide reports (GeoJSON).
  // NLS refreshes this automatically in-browser.
  NASA_COOLR_URL:
    "https://gis.earthdata.nasa.gov/gis05/rest/services/Landslides/COOLR_Reports_Points/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson&resultRecordCount=2000&orderByFields=event_date%20DESC",

  AUTO_REFRESH_MS: 120000,
  DEFAULT_CENTER: [38.6, -96.0],
  DEFAULT_ZOOM: 4
};
