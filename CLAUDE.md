# urban-treasures

## Overview
AR web app for iPhone that renders 3D objects over a live camera feed using GPS + compass positioning. Built as a mobile-first experience targeting iOS Safari.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **3D Engine:** Three.js (WebGL) — renders real 3D geometry over camera feed
- **Language:** JavaScript (no TypeScript)
- **Styling:** Plain CSS via `app/globals.css`
- **Key browser APIs:** WebRTC (camera), Geolocation, DeviceOrientation

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
  globals.css            # global styles (fullscreen AR layout, HUD)
  components/
    ARApp.js             # 'use client' — main AR component (wires all modules)
lib/
  ar/
    camera.js            # attach rear camera stream to <video>
    sensors.js           # compass heading + GPS (iOS/Android compatible)
    renderer.js          # Three.js WebGL renderer — 3D scene, camera, objects
    renderer2d.js        # Canvas 2D overlay — crosshair + sensor warnings
  geo/
    bearing.js           # Haversine distance, bearing, destinationPoint (pure math)
  ui/
    permissions.js       # permission request flow (orientation first, then camera, GPS)
public/
  models/                # placeholder for future .glb 3D models
```

## Rendering Layers (bottom to top)
1. `<video>` — live camera feed
2. Three.js `<canvas>` — WebGL with transparent background, renders 3D objects
3. 2D HUD `<canvas>` — crosshair and warning text
4. DOM HUD — heading pill, GPS pill, debug panel

## AR Coordinate System
- Flat-earth local coords centred on user's spawn GPS position
- 1 unit = 1 metre. North = -Z, East = +X, Up = +Y
- Three.js camera Y rotation tracks compass heading, X rotation tracks phone pitch
- Objects are placed using `destinationPoint()` from `bearing.js` then converted to local XZ

## Key Constraints
- **HTTPS required** — `npm run dev` uses `--experimental-https` (uses `mkcert`, needs sudo once)
- **iOS Safari target** — test on real device, not desktop browser
- **Orientation permission must be requested first** — before camera/GPS, or iOS silently fails
- **All browser APIs are client-side** — AR modules only run inside `'use client'` components
- **No TypeScript** — plain `.js` files throughout

## Current 3D Objects
- **White spinning box** — `BoxGeometry(1, 1.5, 0.1)`, placed 3m ahead of spawn point, slowly rotates
- **Yellow 3D arrow** — extruded arrow shape, attached to camera (always visible at bottom of view), points forward
