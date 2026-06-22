/**
 * bearing.js
 * Pure geo math — no dependencies.
 * All inputs in decimal degrees, outputs in metres / degrees.
 */

const toRad = deg => deg * Math.PI / 180

/**
 * Compass bearing from point A to point B (0–360°, 0 = North).
 */
export function getBearing(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1)
  const rlat1 = toRad(lat1)
  const rlat2 = toRad(lat2)

  const x = Math.sin(dLng) * Math.cos(rlat2)
  const y = Math.cos(rlat1) * Math.sin(rlat2) -
            Math.sin(rlat1) * Math.cos(rlat2) * Math.cos(dLng)

  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360
}

/**
 * Great-circle distance between two GPS points in metres.
 */
export function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Angular delta between device heading and a target bearing.
 * Returns a value between -180 and +180.
 * Negative = target is to the left, positive = to the right.
 */
export function getAngularDelta(deviceHeading, targetBearing) {
  let delta = targetBearing - deviceHeading
  if (delta > 180)  delta -= 360
  if (delta < -180) delta += 360
  return delta
}

/**
 * Convert angular delta to a screen X position.
 * @param {number} delta      - from getAngularDelta (-180 to +180)
 * @param {number} fovDeg     - camera horizontal field of view (default 60°)
 * @param {number} screenWidth
 */
export function deltaToScreenX(delta, screenWidth, fovDeg = 60) {
  return screenWidth / 2 + (delta / (fovDeg / 2)) * (screenWidth / 2)
}

/**
 * Format a distance value for display.
 */
export function formatDistance(metres) {
  if (metres < 1000) return `${Math.round(metres)} m`
  return `${(metres / 1000).toFixed(1)} km`
}

/**
 * Compute a destination point given a start, bearing, and distance.
 * Returns { lat, lng } in decimal degrees.
 */
export function destinationPoint(lat, lng, bearingDeg, distanceM) {
  const R = 6371000
  const d = distanceM / R
  const b = toRad(bearingDeg)
  const lat1 = toRad(lat), lng1 = toRad(lng)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b))
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: lat2 * 180 / Math.PI, lng: (lng2 * 180 / Math.PI + 540) % 360 - 180 }
}
