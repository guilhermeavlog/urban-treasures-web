/**
 * sensors.js
 * Unified sensor readings: compass heading + GPS position.
 * Handles iOS vs Android differences transparently.
 * Exports a live `state` object that updates in place.
 */

export const state = {
  // compass
  headingRaw: null,       // latest raw reading from device
  headingSmooth: null,    // exponentially smoothed
  headingSource: null,    // 'ios' | 'android-absolute' | 'android-relative'

  // GPS
  lat: null,
  lng: null,
  gpsAccuracy: null,      // metres

  // tilt (for vertical AR placement)
  pitch: null,            // e.beta  — phone tilted up/down
  roll: null,             // e.gamma — phone tilted sideways

  // status
  compassReady: false,
  gpsReady: false
}

// ── COMPASS ──

const SMOOTH_FACTOR = 0.12  // 0 = no smoothing, 1 = instant (0.08–0.15 feels good)

function applySmoothing(raw) {
  if (state.headingSmooth === null) {
    state.headingSmooth = raw
    return
  }
  // handle wraparound at 0°/360°
  let delta = raw - state.headingSmooth
  if (delta > 180)  delta -= 360
  if (delta < -180) delta += 360
  state.headingSmooth = (state.headingSmooth + delta * SMOOTH_FACTOR + 360) % 360
}

function onOrientationEvent(e) {
  let heading = null

  if (e.webkitCompassHeading != null) {
    // iOS — already absolute, 0 = North
    heading = e.webkitCompassHeading
    state.headingSource = 'ios'
  } else if (e.absolute && e.alpha != null) {
    // Android with absolute heading
    heading = (360 - e.alpha) % 360
    state.headingSource = 'android-absolute'
  } else if (e.alpha != null) {
    // Android relative (less reliable — no true North reference)
    heading = (360 - e.alpha) % 360
    state.headingSource = 'android-relative'
  }

  if (heading === null) return

  state.headingRaw = heading
  state.pitch = e.beta   // tilt up/down  (-180 to 180)
  state.roll  = e.gamma  // tilt sideways (-90 to 90)
  applySmoothing(heading)
  state.compassReady = true
}

export function startCompass() {
  // listen for both — deviceorientationabsolute fires on Android,
  // deviceorientation fires on iOS (with webkitCompassHeading)
  window.addEventListener('deviceorientationabsolute', onOrientationEvent, true)
  window.addEventListener('deviceorientation', onOrientationEvent, true)

  // Safari pauses events when the screen dims — re-sync smoothing on return
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.headingRaw !== null) {
      state.headingSmooth = state.headingRaw
    }
  })
}

export function stopCompass() {
  window.removeEventListener('deviceorientationabsolute', onOrientationEvent, true)
  window.removeEventListener('deviceorientation', onOrientationEvent, true)
}

// ── GPS ──

let watchId = null

export function startGPS() {
  if (!navigator.geolocation) return

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      state.lat = pos.coords.latitude
      state.lng = pos.coords.longitude
      state.gpsAccuracy = pos.coords.accuracy
      state.gpsReady = true
    },
    (err) => {
      console.warn('GPS error:', err.message)
    },
    {
      enableHighAccuracy: true,
      maximumAge: 2000,       // accept cached position up to 2s old
      timeout: 10000
    }
  )
}

export function stopGPS() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
}
