# National Land Sliding (NLS)

A GitHub Pages-ready, mobile-first landslide + avalanche awareness website with:

- NLS AL-0 through AL-7 event ratings
- Public event archive with sources and media links
- NLS Watch / Warning / Emergency products
- Day 1 / Day 2 / Day 3 outlook polygons
- Hourly/daily area probabilities
- Global event map ("radar-style" event intensity visualization)
- NASA COOLR automatic landslide reports
- Supabase realtime public updates
- Owner-only rating/publishing enforced with database Row Level Security
- iPhone/iPad PWA support and home-screen icon
- Responsive mobile layout

## 1. Put it on GitHub Pages from iOS

1. In Safari, sign in to GitHub and make a new public repository, e.g. `national-land-sliding`.
2. Upload every file/folder in this project to the repository root.
3. Open repository **Settings -> Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then save.
6. GitHub will show the public Pages address after deployment.

The site works immediately in demo/read mode. Supabase is needed for secure owner-only ratings and realtime writes.

## 2. Create the secure NLS database

Create a Supabase project, then:

1. Open **SQL Editor**.
2. Paste/run `supabase-schema.sql`.
3. In **Project Settings / API**, copy the Project URL and anon/public key.
4. Put both values in `config.js`.
5. Commit the changed `config.js` to GitHub.

The anon key is meant for browser apps; security comes from Row Level Security. Never put a Supabase service-role key in this website.

## 3. Make YOU the only NLS owner

1. Open your deployed NLS site -> **Owner**.
2. Enter your owner email and request the magic sign-in link.
3. Open that email and sign in.
4. In Supabase -> **Authentication -> Users**, copy your account's UUID.
5. In Supabase SQL Editor run:

```sql
insert into public.admin_users (user_id)
values ('PASTE-YOUR-USER-UUID-HERE');
```

Only UIDs inside `admin_users` are allowed by the database policies to publish/change/delete events, ratings, alerts, polygons and probabilities. Public users only have SELECT/read permission.

## 4. Realtime / instant updates

In Supabase, enable Realtime/Replication for:

- `events`
- `alerts`
- `outlooks`
- `probabilities`

The web app subscribes to all four. If you publish an AL-7, connected users automatically reload the public data. The app also refreshes feeds every 2 minutes as a fallback.

## 5. Automatic source data

`config.js` contains a NASA COOLR GeoJSON query. Those points appear as gray, **unrated** NASA-source reports until you separately create/rate an NLS event.

This avoids pretending an external report already has an NLS AL rating.

## 6. iPhone/iPad app icon

The project contains 192px and 512px NLS icons plus a web app manifest. On iOS Safari:

**Share -> Add to Home Screen**

It opens in standalone mode with the NLS icon.

## 7. Outlook polygons

Owner -> **Draw Outlook Polygon**

Choose Day 1–3, hazard, probability, draw a polygon, then publish. Everyone sees the polygon on the Outlook page.

## 8. Terminology / safety

NLS is independent. Keep the on-site disclaimer. NLS Watches, Warnings, Emergencies and AL ratings should not be presented as official NOAA/NWS/USGS/NASA emergency products.

The map's colored dots are an **NLS event-intensity visualization**, not Doppler radar.

## NLS v3 rating-evidence upgrade

The event editor and public archive now support much more evidence for AL ratings:

- volume and mass
- speed and runout
- vertical drop, width/area, slope angle, depth
- estimated kinetic energy when enough source data exists
- fatalities, injuries, people exposed, evacuated, rescued, buried/trapped
- structures/roads/rail/utilities affected
- trigger
- avalanche-specific and landslide-specific evidence
- confidence level and source count
- primary source + multiple photo/video links

If your Supabase database already exists, re-run `supabase-schema.sql`; the included `add column if not exists` migration adds the new fields safely.

## NLS v4 — automatic data + no daily polygon work

Major changes:

- NASA COOLR history now loads in pages instead of only one 2,000-record response (default cap: 20,000).
- NASA source records appear in the Event Explorer even before an NLS AL rating is assigned.
- NASA LHASA global hazard/exposure areas are loaded automatically.
- Owner outlook polygons are now OPTIONAL overrides.
- Search any town/area (or use GPS) to build an automatic NLS Day 1–3 local guidance area.
- The local Day 1–3 signal uses Open-Meteo forecast precipitation/snowfall/temperature/wind and is explicitly labeled experimental.
- Data-source/freshness cards tell visitors what actually loaded.
- Map filters now include 24h / 7d / 30d / 1y / all loaded history.
- NASA and LHASA layers can be toggled independently.
- Large NASA source archives are visually separated from owner-rated NLS events.
- Automatic source records are never silently assigned AL ratings.
- Avalanche.org's API requires permission, so NLS does not pretend it has complete worldwide avalanche coverage. Owner/imported avalanche records remain supported.

### Important accuracy rule

NLS probabilities and NLS Watch/Warning/Emergency products are independent project outputs, not official emergency alerts. NASA LHASA and COOLR retain their own source labels.
