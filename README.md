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
