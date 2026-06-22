# Urban Treasures — AR Web App

## Project structure

```
urban-treasures/
├── index.html              # entry point
├── vite.config.js          # dev server with HTTPS
├── package.json
├── styles/
│   └── main.css            # fullscreen AR layout
├── src/
│   ├── main.js             # wires everything together
│   ├── ar/
│   │   ├── camera.js       # rear camera stream
│   │   ├── sensors.js      # compass + GPS, iOS/Android unified
│   │   └── renderer.js     # canvas draw loop (arrow, banner, edge indicators)
│   ├── geo/
│   │   └── bearing.js      # haversine distance + bearing math
│   └── ui/
│       └── permissions.js  # camera / GPS / orientation permission flow
└── public/
    └── models/             # put your .glb files here later
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Run the dev server
```bash
npm run dev
```

You'll see something like:
```
  ➜  Local:   https://localhost:5173/
  ➜  Network: https://192.168.1.42:5173/   ← use this on your phone
```

### 3. Open on your iPhone
- Make sure your phone and Mac are on the **same WiFi network**
- Open Safari on your iPhone
- Go to `https://192.168.1.42:5173` (your Network URL from above)
- You'll get an SSL warning — tap "Show Details" → "visit this website" → "Visit Website"
  (This is because the SSL cert is self-signed for local dev. It's safe.)
- Tap "Grant access & start"
- Allow camera, location, and motion when prompted

### 4. What you'll see
- Rear camera feed fullscreen
- A debug panel showing live compass heading, GPS coordinates, pitch/roll
- A green crosshair in the centre
- Arrows pointing toward the placeholder treasures (currently set to Paris coords)
- Edge chevrons when a treasure is off-screen

## Next steps

### Add real treasures
Open `src/ar/renderer.js` and replace the `TREASURES` array with your actual locations.
Get lat/lng by geocoding an address:
```js
const res = await fetch(
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
  { headers: { 'User-Agent': 'UrbanTreasures/0.1' } }
)
const [r] = await res.json()
// r.lat, r.lon
```

### Improve the AR visuals
All drawing happens in `src/ar/renderer.js` inside `drawTreasureMarker()`.
Swap the placeholder arrow shape for your custom design, add the banner card, etc.

### Remove the debug panel
Delete the `hud-debug` div from `index.html` and the `startDebugHUD()` call in `main.js`.

## iOS notes
- HTTPS is required — the Vite SSL plugin handles this automatically
- `DeviceOrientationEvent.requestPermission()` is called automatically inside the button tap
- The `playsinline` attribute on `<video>` is critical — without it iOS fullscreens the camera
- If the compass reads 0° constantly, move the phone in a figure-8 to calibrate the magnetometer
