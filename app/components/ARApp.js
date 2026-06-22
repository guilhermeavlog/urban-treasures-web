'use client'

import { useRef, useState, useEffect } from 'react'
import { requestAllPermissions } from '@/lib/ui/permissions'
import { startCompass, startGPS, state as sensorState } from '@/lib/ar/sensors'
import { attachCamera } from '@/lib/ar/camera'
import { initRenderer, startRenderLoop, setSpawnPoint, placeBanner, getBannerDebug, setArrowTarget, getArrowTarget } from '@/lib/ar/renderer'
import { initHUD, startHUDLoop } from '@/lib/ar/renderer2d'
import { parseCSV } from '@/lib/csv'
import { getDistance } from '@/lib/geo/bearing'

export default function ARApp() {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const hudRef     = useRef(null)
  const [screen, setScreen] = useState('permissions')
  const [btnDisabled, setBtnDisabled] = useState(false)
  const [btnText, setBtnText] = useState('Grant access & start')
  const [permStatus, setPermStatus] = useState('')
  const [nearbyMurals, setNearbyMurals] = useState([])
  const [selectedMural, setSelectedMural] = useState(null)

  const hudHeadingRef = useRef(null)
  const hudGpsRef     = useRef(null)
  const dbgHeadingRef = useRef(null)
  const dbgGpsRef     = useRef(null)
  const dbgSensorRef  = useRef(null)
  const dbgCsvRef     = useRef(null)
  const dbgBannerRef  = useRef(null)
  const intervalRef   = useRef(null)
  const allTreasuresRef = useRef([])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function updateNearbyList() {
    if (!sensorState.gpsReady || !allTreasuresRef.current.length) return
    const { lat, lng } = sensorState
    const withDist = allTreasuresRef.current.map(t => ({
      ...t,
      dist: getDistance(lat, lng, t.lat, t.lng)
    }))
    withDist.sort((a, b) => a.dist - b.dist)
    setNearbyMurals(withDist.slice(0, 10))
  }

  function selectMural(mural) {
    if (selectedMural && selectedMural.name === mural.name) {
      // Deselect if tapping the same one
      setSelectedMural(null)
      setArrowTarget(null)
    } else {
      setSelectedMural(mural)
      setArrowTarget({ lat: mural.lat, lng: mural.lng, name: mural.name })
    }
  }

  function formatDist(m) {
    if (m < 1000) return `${Math.round(m)}m away`
    return `${(m / 1000).toFixed(1)}km away`
  }

  async function handleGrant() {
    setBtnDisabled(true)
    setBtnText('Setting up...')

    const perms = await requestAllPermissions(setPermStatus)

    if (!perms.camera) {
      setPermStatus('❌ Camera is required. Please allow it in Settings.')
      setBtnDisabled(false)
      setBtnText('Try again')
      return
    }

    attachCamera(videoRef.current, perms.cameraStream)
    if (perms.orientation) startCompass()
    startGPS()

    initRenderer(canvasRef.current)
    startRenderLoop()

    initHUD(hudRef.current)
    startHUDLoop()

    setScreen('ar')

    // Wait for GPS to lock, then load treasures from CSV
    const spawnPoll = setInterval(async () => {
      if (sensorState.gpsReady) {
        clearInterval(spawnPoll)
        setSpawnPoint(sensorState.lat, sensorState.lng)

        try {
          if (dbgCsvRef.current) dbgCsvRef.current.textContent = 'CSV: fetching...'
          const res = await fetch('/treasures.csv')
          const text = await res.text()
          const treasures = parseCSV(text)
          const parsed = treasures.map(t => ({
            lat: parseFloat(t.lat),
            lng: parseFloat(t.lng),
            name: t.name,
            description: t.description,
            photoUrl: t.photoUrl || '',
          }))
          allTreasuresRef.current = parsed
          if (dbgCsvRef.current) dbgCsvRef.current.textContent = `CSV: ${parsed.length} treasures loaded`
          for (const t of parsed) {
            placeBanner(t)
          }
          if (dbgCsvRef.current) dbgCsvRef.current.textContent = `CSV: ${parsed.length} banners placed`
          updateNearbyList()
        } catch (err) {
          if (dbgCsvRef.current) dbgCsvRef.current.textContent = `CSV: ERROR ${err.message}`
        }
      }
    }, 200)

    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
    intervalRef.current = setInterval(() => {
      const h = sensorState.headingSmooth
      if (h !== null) {
        const dir = dirs[Math.round(h / 22.5) % 16]
        if (hudHeadingRef.current) hudHeadingRef.current.textContent = `${dir}  ${Math.round(h)}°`
        if (dbgHeadingRef.current) dbgHeadingRef.current.textContent = `Heading: ${h.toFixed(1)}° (${sensorState.headingSource})`
      }
      if (sensorState.gpsReady) {
        const { lat, lng, gpsAccuracy } = sensorState
        if (hudGpsRef.current) hudGpsRef.current.textContent = `GPS ±${Math.round(gpsAccuracy)}m`
        if (dbgGpsRef.current) dbgGpsRef.current.textContent = `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}  ±${Math.round(gpsAccuracy)}m`
      }
      if (sensorState.pitch !== null && dbgSensorRef.current) {
        dbgSensorRef.current.textContent = `Pitch: ${sensorState.pitch?.toFixed(1)}°  Roll: ${sensorState.roll?.toFixed(1)}°`
      }
      const bd = getBannerDebug()
      if (bd && dbgBannerRef.current) {
        dbgBannerRef.current.textContent = `Banner: ${bd.dist}m @ ${bd.bearing}° delta:${bd.delta}° pos:(${bd.x},${bd.z})`
      }
      // Update nearby list every tick
      updateNearbyList()
    }, 2000)
  }

  return (
    <>
      {/* Permission screen */}
      <div
        id="screen-permissions"
        className={`screen${screen === 'permissions' ? ' active' : ''}`}
        style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#090912', padding: '2rem', textAlign: 'center' }}
      >
        <div className="perm-content">
          <div className="perm-icon">🧭</div>
          <h1>Urban Treasures</h1>
          <p>Needs camera, location, and motion sensor access to show AR overlays.</p>
          <button className="btn-primary" disabled={btnDisabled} onClick={handleGrant}>
            {btnText}
          </button>
          <p className="perm-note">{permStatus}</p>
        </div>
      </div>

      {/* AR screen */}
      <div id="screen-ar" className={`screen${screen === 'ar' ? ' active' : ''}`} style={{ position: 'relative' }}>
        {/* Layer 1: camera feed */}
        <video ref={videoRef} id="camera-feed" autoPlay muted playsInline />
        {/* Layer 2: Three.js WebGL canvas */}
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }} />
        {/* Layer 3: 2D HUD canvas (crosshair, warnings) */}
        <canvas ref={hudRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }} />

        {/* Layer 5: Nearby murals menu */}
        {nearbyMurals.length > 0 && (
          <div className="nearby-menu">
            <div className="nearby-header">Nearby murals</div>
            <div className="nearby-scroll">
              {nearbyMurals.map((m, i) => {
                const isSelected = selectedMural && selectedMural.name === m.name
                return (
                  <div key={i} className="nearby-card" style={isSelected ? { border: '2px solid #4fffb0' } : undefined} onClick={() => selectMural(m)}>
                    {m.photoUrl ? (
                      <img className="nearby-card-img" src={m.photoUrl} alt={m.name} />
                    ) : (
                      <div className="nearby-card-img" />
                    )}
                    <div className="nearby-card-body">
                      <div className="nearby-card-name">{m.name}</div>
                      <div className="nearby-card-dist">{formatDist(m.dist)}</div>
                    </div>
                    <button className="nearby-card-go" style={isSelected ? { background: '#ff6b6b' } : undefined} onClick={(e) => { e.stopPropagation(); selectMural(m) }}>
                      {isSelected ? 'Stop navigation' : 'Navigate'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Layer 4: DOM HUD */}
        <div className="hud-top" style={{ top: nearbyMurals.length > 0 ? '220px' : undefined }}>
          <div className="hud-pill" ref={hudHeadingRef}>── °</div>
          <div className="hud-pill" ref={hudGpsRef}>No GPS</div>
        </div>
        <div className="hud-debug">
          <div ref={dbgHeadingRef}>Heading: –</div>
          <div ref={dbgGpsRef}>GPS: –</div>
          <div ref={dbgSensorRef}>Sensor: –</div>
          <div ref={dbgCsvRef}>CSV: waiting for GPS...</div>
          <div ref={dbgBannerRef}>Banner: –</div>
        </div>
      </div>
    </>
  )
}
