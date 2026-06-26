'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { requestAllPermissions } from '@/lib/ui/permissions'
import { startCompass, startGPS, state as sensorState } from '@/lib/ar/sensors'
import { attachCamera } from '@/lib/ar/camera'
import { initRenderer, startRenderLoop, setSpawnPoint, placeBanner, getBannerDebug, setArrowTarget, getArrowTarget, getVisitedMap, setRoutePath, initAudio, setMuted, isMuted } from '@/lib/ar/renderer'
import { initHUD, startHUDLoop } from '@/lib/ar/renderer2d'
import { getDistance } from '@/lib/geo/bearing'
import { getWalkingRoute } from '@/lib/geo/routing'

export default function ARApp() {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const hudRef     = useRef(null)
  const [screen, setScreen] = useState('permissions')
  const [btnDisabled, setBtnDisabled] = useState(false)
  const [btnText, setBtnText] = useState('Start exploring')
  const [permStatus, setPermStatus] = useState('')
  const [nearbyMurals, setNearbyMurals] = useState([])
  const [selectedMural, setSelectedMural] = useState(null)
  const [muted, setMutedState] = useState(false)
  const [nearbyExpanded, setNearbyExpanded] = useState(false)
  const [visitedMap, setVisitedMap] = useState({})

  const iconCanvasRef = useRef(null)

  const hudHeadingRef = useRef(null)
  const hudGpsRef     = useRef(null)
  const dbgHeadingRef = useRef(null)
  const dbgGpsRef     = useRef(null)
  const dbgSensorRef  = useRef(null)
  const dbgDbRef     = useRef(null)
  const dbgBannerRef  = useRef(null)
  const dbgRouteRef   = useRef(null)
  const intervalRef   = useRef(null)
  const allTreasuresRef = useRef([])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // 3D spheres icon on permission screen
  useEffect(() => {
    const canvas = iconCanvasRef.current
    if (!canvas || screen !== 'permissions') return

    const size = 140
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = size + 'px'
    canvas.style.height = size + 'px'

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(dpr)
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0, 6)

    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(3, 4, 5)
    scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5)
    fillLight.position.set(-3, -2, 3)
    scene.add(fillLight)

    const spheres = []
    const palette = [
      { color: 0x4fffb0, pos: [0, 0, 0], r: 0.55 },
      { color: 0xff3388, pos: [-1.1, 0.9, 0.3], r: 0.35 },
      { color: 0x00ccff, pos: [1.05, 1.1, -0.2], r: 0.4 },
      { color: 0xff8800, pos: [1.0, -0.9, 0.2], r: 0.35 },
      { color: 0xcc44ff, pos: [-1.15, -0.75, -0.1], r: 0.28 },
      { color: 0xffdd00, pos: [0, 1.5, -0.3], r: 0.22 },
      { color: 0xff3388, pos: [1.5, 0.1, -0.4], r: 0.2 },
      { color: 0x00ccff, pos: [-1.4, 0.05, 0.1], r: 0.22 },
      { color: 0x4fffb0, pos: [0, -1.45, 0.15], r: 0.28 },
    ]

    for (const { color, pos, r } of palette) {
      const geo = new THREE.SphereGeometry(r, 32, 32)
      const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, metalness: 0.0, clearcoat: 0.4, clearcoatRoughness: 0.1, emissive: color, emissiveIntensity: 0.35 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(...pos)
      scene.add(mesh)
      spheres.push({ mesh, baseY: pos[1], phase: Math.random() * Math.PI * 2 })
    }

    let raf
    function animate() {
      raf = requestAnimationFrame(animate)
      const t = Date.now() / 1000
      for (const s of spheres) {
        s.mesh.position.y = s.baseY + Math.sin(t * 0.8 + s.phase) * 0.08
      }
      scene.rotation.y = t * 0.15
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      renderer.dispose()
    }
  }, [screen])

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

  async function selectMural(mural) {
    if (selectedMural && selectedMural.name === mural.name) {
      // Deselect if tapping the same one
      setSelectedMural(null)
      setArrowTarget(null)
      setRoutePath(null)
    } else {
      setSelectedMural(mural)
      setArrowTarget({ lat: mural.lat, lng: mural.lng, name: mural.name })
      initAudio()  // start audio on user gesture (required by iOS)

      // Fetch walking route and render path
      if (sensorState.gpsReady) {
        if (dbgRouteRef.current) dbgRouteRef.current.textContent = 'Route: fetching...'
        try {
          const route = await getWalkingRoute(sensorState.lat, sensorState.lng, mural.lat, mural.lng)
          if (dbgRouteRef.current) dbgRouteRef.current.textContent = `Route: ${route.length} waypoints`
          setRoutePath(route)
        } catch (err) {
          if (dbgRouteRef.current) dbgRouteRef.current.textContent = `Route: fallback (${err.message})`
          // Fallback: straight line
          setRoutePath([
            { lat: sensorState.lat, lng: sensorState.lng },
            { lat: mural.lat, lng: mural.lng },
          ])
        }
      }
    }
  }

  function formatDist(m) {
    if (m < 1000) return `${Math.round(m)}m away`
    return `${(m / 1000).toFixed(1)}km away`
  }

  function playStartSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime

    // Rising sweep
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(300, now)
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.25)
    gain1.gain.setValueAtTime(0.15, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35)
    osc1.connect(gain1).connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.35)

    // Shimmer tone
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(800, now + 0.1)
    osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.4)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
    osc2.connect(gain2).connect(ctx.destination)
    osc2.start(now + 0.1)
    osc2.stop(now + 0.5)

    // Confirmation chime
    const osc3 = ctx.createOscillator()
    const gain3 = ctx.createGain()
    osc3.type = 'sine'
    osc3.frequency.setValueAtTime(1400, now + 0.3)
    gain3.gain.setValueAtTime(0.12, now + 0.3)
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.7)
    osc3.connect(gain3).connect(ctx.destination)
    osc3.start(now + 0.3)
    osc3.stop(now + 0.7)

    setTimeout(() => ctx.close(), 1000)
  }

  async function handleGrant() {
    setBtnDisabled(true)
    setBtnText('Starting...')

    const perms = await requestAllPermissions(setPermStatus)

    // Play sound + vibrate after permissions (AudioContext before would consume the iOS user gesture)
    if (navigator.vibrate) navigator.vibrate([30, 50, 60])
    playStartSound()

    if (!perms.camera) {
      setPermStatus('Camera is required. Please allow it in Settings.')
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

    // Wait for GPS to lock, then load treasures from database
    const spawnPoll = setInterval(async () => {
      if (sensorState.gpsReady) {
        clearInterval(spawnPoll)
        setSpawnPoint(sensorState.lat, sensorState.lng)

        try {
          if (dbgDbRef.current) dbgDbRef.current.textContent = 'DB: fetching...'
          const res = await fetch('/api/murals')
          const parsed = await res.json()
          allTreasuresRef.current = parsed
          if (dbgDbRef.current) dbgDbRef.current.textContent = `DB: ${parsed.length} treasures loaded`
          for (const t of parsed) {
            placeBanner(t)
          }
          if (dbgDbRef.current) dbgDbRef.current.textContent = `DB: ${parsed.length} banners placed`
          updateNearbyList()
        } catch (err) {
          if (dbgDbRef.current) dbgDbRef.current.textContent = `DB: ERROR ${err.message}`
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
      // Update nearby list + visited state
      updateNearbyList()
      setVisitedMap(getVisitedMap())
    }, 2000)
  }

  return (
    <>
      {/* Permission screen */}
      <div
        id="screen-permissions"
        className={`screen${screen === 'permissions' ? ' active' : ''}`}
        style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f7f7fa', padding: '2rem', textAlign: 'center' }}
      >
        <div className="perm-content">
          <div className="perm-icon">
            <canvas ref={iconCanvasRef} />
          </div>
          <h1>Urban Treasures</h1>
          <p className="perm-subtitle">Discover murals in augmented reality</p>
          <p className="perm-desc">Requires camera, location, and motion sensors</p>
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

        {/* Mute button */}
        <button
          className="mute-btn"
          onClick={() => { const next = !muted; setMutedState(next); setMuted(next) }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {muted ? (
              <>
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : (
              <>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </>
            )}
          </svg>
        </button>

        {/* Layer 5: Nearby murals pill */}
        {nearbyMurals.length > 0 && (
          <div className="nearby-wrap">
            <button className="nearby-pill" onClick={() => setNearbyExpanded(!nearbyExpanded)}>
              NEARBY · {nearbyMurals.length} {nearbyExpanded ? '▴' : '▾'}
            </button>
            {nearbyExpanded && (
              <div className="nearby-dropdown">
                {nearbyMurals.map((m, i) => {
                  const isSelected = selectedMural && selectedMural.name === m.name
                  const isVisited = visitedMap[m.name]
                  const cardStyle = {
                    ...(isSelected ? { border: '2px solid #fff' } : {}),
                    ...(!isVisited ? { filter: 'grayscale(100%)' } : {}),
                  }
                  return (
                    <div key={i} className="nearby-card" style={cardStyle} onClick={() => selectMural(m)}>
                      {m.photoUrl ? (
                        <img className="nearby-card-img" src={m.photoUrl} alt={m.name} />
                      ) : (
                        <div className="nearby-card-img" />
                      )}
                      <div className="nearby-card-body">
                        <div className="nearby-card-name">{m.name}</div>
                        <div className="nearby-card-dist">
                          {formatDist(m.dist)}
                          {isVisited && ' · Visited'}
                        </div>
                      </div>
                      <button className="nearby-card-go" style={isSelected ? { background: '#ff3388', color: '#fff' } : undefined} onClick={(e) => { e.stopPropagation(); selectMural(m) }}>
                        {isSelected ? 'Stop' : 'Go'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Layer 4: DOM HUD */}
        <div className="hud-debug">
          <div ref={dbgHeadingRef}>Heading: –</div>
          <div ref={dbgGpsRef}>GPS: –</div>
          <div ref={dbgSensorRef}>Sensor: –</div>
          <div ref={dbgDbRef}>CSV: waiting for GPS...</div>
          <div ref={dbgBannerRef}>Banner: –</div>
          <div ref={dbgRouteRef}>Route: –</div>
        </div>
      </div>
    </>
  )
}
