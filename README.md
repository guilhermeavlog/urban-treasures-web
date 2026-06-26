# Urban Treasures

AR web app for discovering street murals through your phone camera. Uses GPS + compass to place 3D banners in the real world, bird flocks for walking navigation, and a paint-splash arrow for direction. Built for iOS Safari.

## Tech Stack

- **Next.js 15** (App Router) + **Three.js** (WebGL) + **Plain JS**
- **pnpm** package manager
- **PostgreSQL 17** for mural data
- **OSRM** for walking routes (free, no API key needed)

## Prerequisites

- **Node.js** 18+
- **pnpm** (`brew install pnpm`)
- **PostgreSQL 17** (`brew install postgresql@17`)

## Setup

### 1. Start PostgreSQL

```bash
brew services start postgresql@17
```

> Note: PostgreSQL runs on **port 5433** (not the default 5432). This is configured in the connection string.

### 2. Create the database and seed it

```bash
/opt/homebrew/opt/postgresql@17/bin/createdb -p 5433 urban_treasures
node scripts/seed.js
```

This creates the `murals` table and inserts dummy mural data.

### 3. Configure environment

Create a `.env.local` file in the project root:

```
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5433/urban_treasures
SITE_PASSWORD=your-password-here
```

Replace `YOUR_USERNAME` with your macOS username. `SITE_PASSWORD` is the password users must enter to access the app.

### 4. Install dependencies and run

```bash
pnpm install
pnpm dev
```

The dev server starts at `https://localhost:3000` (HTTPS is required for camera and sensor access).

## Testing on iPhone

1. Make sure your phone and Mac are on the **same WiFi network**
2. Open Safari on your iPhone
3. Go to `https://<your-mac-ip>:3000`
4. You'll get an SSL warning -- tap "Show Details" > "visit this website" (self-signed cert, safe for local dev)
5. Enter the site password
6. Tap "Grant access & start"
7. Allow camera, location, and motion when prompted

## Project Structure

```
middleware.js                # password wall -- redirects to /login without auth cookie
scripts/seed.js              # creates murals table + inserts dummy data
app/
  layout.js, page.js         # root layout + home page
  globals.css                # all styles
  login/page.js              # password entry page
  api/login/route.js         # POST -- validates password, sets cookie
  api/murals/route.js        # GET -- serves murals from PostgreSQL
  components/ARApp.js        # main component -- permission screen, AR view, HUD, nearby menu
lib/
  db.js                      # PostgreSQL connection pool
  ar/camera.js               # rear camera stream
  ar/sensors.js              # compass + GPS
  ar/renderer.js             # Three.js scene -- banners, birds, arrow, audio
  ar/renderer2d.js           # 2D canvas overlay -- crosshair, warnings
  geo/bearing.js             # haversine distance + bearing math
  geo/routing.js             # OSRM walking directions
  ui/permissions.js          # permission request sequence (orientation > camera > GPS)
```

## Database

Mural data is stored in PostgreSQL. To inspect it:

```bash
/opt/homebrew/opt/postgresql@17/bin/psql -p 5433 urban_treasures
```

Useful commands inside psql:
- `\dt` -- list tables
- `SELECT * FROM murals;` -- view all murals
- `\q` -- quit

To re-seed (reset to dummy data):

```bash
node scripts/seed.js
```

## Production Build

```bash
pnpm build
pnpm start
```
