/**
 * permissions.js
 * Requests camera, geolocation, and DeviceOrientation in sequence.
 * Returns a result object so the caller can decide what to do.
 */

export async function requestAllPermissions(onStatus) {
  const result = {
    camera: false,
    gps: false,
    orientation: false,
    cameraStream: null
  }

  // ── 1. DEVICE ORIENTATION first — must be closest to the user gesture on iOS ──
  onStatus('Requesting motion sensors...')
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission()
      result.orientation = res === 'granted'
      onStatus(result.orientation ? 'Sensors ✓' : 'Sensors denied — compass disabled')
    } catch (err) {
      onStatus(`Sensors failed: ${err.message}`)
    }
  } else {
    // Android and desktop — no permission needed
    result.orientation = true
    onStatus('Sensors ✓')
  }

  // ── 2. CAMERA ──
  onStatus('Requesting camera...')
  try {
    result.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },  // rear camera
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    })
    result.camera = true
    onStatus('Camera ✓')
  } catch (err) {
    onStatus(`Camera failed: ${err.message}`)
    return result
  }

  // ── 3. GEOLOCATION ──
  onStatus('Requesting location...')
  const gpsGranted = await new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      (err) => {
        onStatus(`GPS failed: ${err.message}`)
        resolve(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
  result.gps = gpsGranted
  if (gpsGranted) onStatus('Location ✓')

  return result
}
