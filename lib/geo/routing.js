/**
 * routing.js
 * Fetch walking directions from OSRM (free, no API key).
 * Returns an array of { lat, lng } waypoints along streets.
 */

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot'

/**
 * Get walking route between two GPS points.
 * @returns {Promise<{lat:number, lng:number}[]>} array of waypoints
 */
export async function getWalkingRoute(fromLat, fromLng, toLat, toLng) {
  const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM ${res.status}`)

  const data = await res.json()
  if (!data.routes || !data.routes.length) throw new Error('No route found')

  // GeoJSON coordinates are [lng, lat]
  const coords = data.routes[0].geometry.coordinates
  return coords.map(([lng, lat]) => ({ lat, lng }))
}
