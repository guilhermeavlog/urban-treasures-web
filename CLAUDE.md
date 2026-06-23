# urban-treasures

## Overview
AR web app for discovering street murals through your phone camera. Uses GPS + compass to place 3D banners, bird flocks for walking navigation, and a paint-splash arrow for direction. iOS Safari only.

## Tech Stack
- **Next.js 15** (App Router), **Three.js** (WebGL), **Plain JS** (no TypeScript)
- **OSRM** for walking routes (free, no API key)
- **Web Audio API** for synthesized sounds (bird chirps, UI chime)
- **Browser APIs:** WebRTC, Geolocation, DeviceOrientation, Vibration

## Dev Commands
```bash
npm install       # install dependencies
npm run dev       # HTTPS dev server (required for camera + sensors)
npm run build && npm start  # production
```
iPhone testing: same WiFi, `https://<local-ip>:3000`, accept self-signed cert.

## Architecture
```
app/
  layout.js, page.js       # root layout + home page
  globals.css              # all styles
  components/ARApp.js      # main component — permission screen, AR view, HUD, nearby menu
lib/
  ar/camera.js             # rear camera stream
  ar/sensors.js            # compass + GPS
  ar/renderer.js           # Three.js scene — banners, birds, arrow, audio
  ar/renderer2d.js         # 2D canvas overlay — crosshair, warnings
  geo/bearing.js           # haversine math
  geo/routing.js           # OSRM walking directions
  csv.js                   # CSV parser
  ui/permissions.js        # permission request sequence (orientation > camera > GPS)
public/treasures.csv       # mural data (name, lat, lng, description, photoUrl)
```

## AR Coordinates
Flat-earth local coords centered on spawn GPS. 1 unit = 1m. North = -Z, East = +X, Up = +Y. `gpsToLocal()` converts lat/lng to XZ.

## Key Constraints
- **HTTPS required** — `--experimental-https` via mkcert
- **iOS Safari only** — no WebXR, no ground plane; Y positions assumed (camera 1.6m, ground 0)
- **Orientation permission must be first** — before camera/GPS or iOS silently fails
- **No AudioContext before permissions** — creating one consumes the iOS user gesture, blocking permission popups
- **Client-side only** — all AR code in `'use client'` components
- **GLSL precision** — use `(Date.now() % 100000) / 1000` for time uniforms, never raw timestamps
- **No emojis in UI** — keep the app looking clean and artistic, no emoji icons

## Permission Screen
- 3D Three.js animated sphere cluster (9 spheres, vibrant MeshPhysicalMaterial with emissive glow)
- Soft white background (#f7f7fa), gradient title, dark flat button
- Button press: bubble scale animation, haptic vibration, synthesized chime (plays after permissions)
- Two iOS popups expected: motion sensors, then camera
