# urban-treasures

## Overview
AR web app for iPhone that displays 3D mural banners and navigation aids over a live camera feed using GPS + compass positioning. Features colorful bird flocks for route guidance, animated paint-splash arrow, and a visit-tracking system. Built as a mobile-first experience targeting iOS Safari.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **3D Engine:** Three.js (WebGL) — renders real 3D geometry over camera feed
- **Routing:** OSRM (free, no API key) — walking directions for bird flight paths
- **Audio:** Web Audio API — synthesized bird chirps
- **Language:** JavaScript (no TypeScript)
- **Styling:** Plain CSS via `app/globals.css`
- **Key browser APIs:** WebRTC (camera), Geolocation, DeviceOrientation, Web Audio

## Dev Commands
```bash
npm install       # install dependencies
npm run dev       # start HTTPS dev server (required for camera + sensors on iOS)
npm run build     # production build
npm start         # start production server
```

To test on iPhone: connect to the same WiFi, open `https://<your-local-ip>:3000`, accept the self-signed SSL cert.

## Architecture

```
app/
  layout.js              # root layout with metadata + global CSS
  page.js                # home page — renders <ARApp>
  globals.css            # global styles (fullscreen AR layout, HUD, nearby pill)
  components/
    ARApp.js             # 'use client' — main AR component (wires all modules)
lib/
  ar/
    camera.js            # attach rear camera stream to <video>
    sensors.js           # compass heading + GPS (iOS/Android compatible)
    renderer.js          # Three.js WebGL renderer — 3D scene, camera, banners, birds, arrow
    renderer2d.js        # Canvas 2D overlay — crosshair + sensor warnings
  geo/
    bearing.js           # Haversine distance, bearing, destinationPoint (pure math)
    routing.js           # OSRM walking directions API — returns GPS waypoints along streets
  csv.js                 # CSV parser handling quoted fields with commas
  ui/
    permissions.js       # permission request flow (orientation first, then camera, GPS)
public/
  treasures.csv          # mural data: name, lat, lng, description, photoUrl
```

## Rendering Layers (bottom to top)
1. `<video>` — live camera feed
2. Three.js `<canvas>` — WebGL with transparent background, renders 3D objects
3. 2D HUD `<canvas>` — crosshair and warning text
4. DOM — nearby pill, mute button, debug panel

## AR Coordinate System
- Flat-earth local coords centred on user's spawn GPS position
- 1 unit = 1 metre. North = -Z, East = +X, Up = +Y
- Three.js camera Y rotation tracks compass heading, X rotation tracks phone pitch
- Camera position updates from live GPS each frame
- Objects placed via gpsToLocal() converting lat/lng to local XZ metres

## 3D Objects

### Mural Banners
- `BoxGeometry(2.5, h, 2.5)` — 2.5m cubes with CanvasTexture on all 4 side faces
- Shows mural name (top), photo (middle), description (bottom)
- Greyscale when unvisited, full color when visited (pixel-by-pixel conversion)
- Yellow `RingGeometry` circle on ground below — turns green on proximity (1.5m radius)
- Slowly spins clockwise (one rotation per 45 seconds)
- Loaded from `/treasures.csv`

### Navigation Arrow
- Extruded arrow shape attached to camera (always visible at bottom of view)
- White `ShaderMaterial` — plain white when idle
- When navigating: animated paint splotches (pink, blue, orange, cyan, magenta, yellow, green) drift outward using noise-based shader
- Points toward selected mural destination via compass bearing
- Gentle floating bob animation
- **GLSL note:** time uniform uses `(Date.now() % 100000) / 1000` to avoid 32-bit float precision loss

### Bird Flock (Route Visualization)
- 20 birds spawn along OSRM walking route at 60m altitude
- Each bird: cone body + two triangle wings with flap animation
- 12 vivid colors cycling through the flock
- Birds fly along CatmullRomCurve3, loop back to start continuously
- Spread vertically (±15m) and sideways (±15m) for natural flock look
- Synthesized chirps via Web Audio API (random pitch/notes every 0.5-2s)
- Mute button (red speaker SVG icon, top right) toggles chirps

## UI Components

### Nearby Pill (top center)
- Frosted dark pill showing "NEARBY · {count} ▾"
- Tap to expand/collapse horizontal scroll of mural cards
- Cards: white background, photo thumbnail, name, distance, Navigate/Stop button
- Unvisited murals shown in greyscale

### Debug Panel (bottom right)
- Tiny white text: heading, GPS, pitch, CSV status, banner info, route waypoint count

## Key Constraints
- **HTTPS required** — `npm run dev` uses `--experimental-https` (uses `mkcert`, needs sudo once)
- **iOS Safari target** — test on real device, not desktop browser
- **Orientation permission must be requested first** — before camera/GPS, or iOS silently fails
- **All browser APIs are client-side** — AR modules only run inside `'use client'` components
- **No TypeScript** — plain `.js` files throughout
- **No ground plane detection** — iOS Safari doesn't support WebXR; all Y positions are assumed (camera at 1.6m, ground at 0)
- **GLSL float precision** — never pass raw `Date.now()/1000` to shader uniforms; use modulo to keep values small
