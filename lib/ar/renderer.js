/**
 * renderer.js
 * Three.js WebGL renderer for real 3D AR objects.
 * The scene uses a flat-earth local coordinate system:
 *   1 unit = 1 metre, North = -Z, East = +X, Up = +Y
 * The Three.js camera rotates each frame to match device heading + pitch.
 */

import * as THREE from 'three'
import { state } from './sensors.js'
import { getDistance, getBearing, getAngularDelta } from '../geo/bearing.js'

// ── SCENE OBJECTS ──
let renderer, scene, camera, arrowGroup
let W, H
let rafId = null

// Spawn origin in GPS space
let originLat = null, originLng = null

// All placed banners
const banners = []

// Arrow target — when set, the arrow points toward this GPS coordinate
let arrowTarget = null  // { lat, lng, name }

/**
 * Convert GPS coordinates to local XZ metres relative to spawn origin.
 */
function gpsToLocal(lat, lng) {
  const dist = getDistance(originLat, originLng, lat, lng)
  const bear = getBearing(originLat, originLng, lat, lng) * (Math.PI / 180)
  const x = Math.sin(bear) * dist   // East = +X
  const z = -Math.cos(bear) * dist  // North = -Z
  return { x, z }
}

/**
 * Set the user's spawn origin. Must be called before placing banners.
 */
/**
 * Set the arrow to point toward a target mural.
 * Pass null to clear.
 */
export function setArrowTarget(target) {
  arrowTarget = target
}

export function getArrowTarget() {
  return arrowTarget
}

export function setSpawnPoint(lat, lng) {
  originLat = lat
  originLng = lng
}

/**
 * Place an urban treasure banner in the 3D scene.
 * @param {object} opts
 * @param {number} opts.lat        - GPS latitude
 * @param {number} opts.lng        - GPS longitude
 * @param {string} opts.name       - treasure name (top of banner)
 * @param {string} opts.description - treasure description (bottom of banner)
 * @param {string} [opts.photoUrl] - URL to a photo (middle of banner)
 */
export function placeBanner({ lat, lng, name, description, photoUrl }) {
  if (originLat === null) return

  const { x, z } = gpsToLocal(lat, lng)

  // ── Build banner texture on a 2D canvas ──
  const texW = 512, texH = 700
  const cvs = document.createElement('canvas')
  cvs.width = texW
  cvs.height = texH
  const ctx = cvs.getContext('2d')

  // Background
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 0, 0, texW, texH, 24)
  ctx.fill()

  // Subtle border
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 3
  roundRect(ctx, 1.5, 1.5, texW - 3, texH - 3, 24)
  ctx.stroke()

  // ── Name at top ──
  ctx.fillStyle = '#111111'
  ctx.font = 'bold 38px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  wrapText(ctx, name, texW / 2, 30, texW - 60, 44)

  // ── Description at bottom ──
  ctx.fillStyle = '#555555'
  ctx.font = '26px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  wrapTextBottom(ctx, description, texW / 2, texH - 30, texW - 60, 34)

  // ── Photo placeholder (grey box in center) ──
  const photoY = 120, photoH = 320, photoW = texW - 80
  ctx.fillStyle = '#f0f0f0'
  roundRect(ctx, 40, photoY, photoW, photoH, 16)
  ctx.fill()
  ctx.strokeStyle = '#ddd'
  ctx.lineWidth = 2
  roundRect(ctx, 40, photoY, photoW, photoH, 16)
  ctx.stroke()

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(cvs)
  texture.colorSpace = THREE.SRGBColorSpace

  // If a photo URL is provided, load it into the photo area
  if (photoUrl) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Draw photo scaled to fit the photo area
      const scale = Math.min(photoW / img.width, photoH / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      const dx = 40 + (photoW - dw) / 2
      const dy = photoY + (photoH - dh) / 2

      // Clear the placeholder
      ctx.fillStyle = '#ffffff'
      roundRect(ctx, 40, photoY, photoW, photoH, 16)
      ctx.fill()

      // Draw the image
      ctx.save()
      ctx.beginPath()
      roundRect(ctx, 40, photoY, photoW, photoH, 16)
      ctx.clip()
      ctx.drawImage(img, dx, dy, dw, dh)
      ctx.restore()

      texture.needsUpdate = true
    }
    img.src = photoUrl
  }

  // ── 3D Box with same texture on all 4 side faces ──
  const bannerW = 2, bannerH = bannerW * (texH / texW), bannerD = 2
  const geometry = new THREE.BoxGeometry(bannerW, bannerH, bannerD)

  const faceMat = new THREE.MeshBasicMaterial({ map: texture })
  const topBottomMat = new THREE.MeshBasicMaterial({ color: 0xfafafa })
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
  const materials = [faceMat, faceMat, topBottomMat, topBottomMat, faceMat, faceMat]

  const mesh = new THREE.Mesh(geometry, materials)
  mesh.position.set(x, 1.4, z)  // float at ~1.4m (eye level)
  scene.add(mesh)

  // ── Yellow circle on the ground below the banner ──
  const circleRadius = 1.5
  const circleGeo = new THREE.RingGeometry(circleRadius - 0.15, circleRadius, 48)
  const circleMat = new THREE.MeshBasicMaterial({ color: 0xffdd00, side: THREE.DoubleSide })
  const circle = new THREE.Mesh(circleGeo, circleMat)
  circle.rotation.x = -Math.PI / 2  // lay flat on the ground
  circle.position.set(x, 0.01, z)   // just above ground
  scene.add(circle)

  banners.push({ mesh, lat, lng, circle, circleMat, circleRadius })
}

/**
 * Get debug info about the first banner relative to current position/heading.
 */
export function getBannerDebug() {
  if (!banners.length || !state.gpsReady || originLat === null) return null
  const b = banners[0]
  const bearing = getBearing(state.lat, state.lng, b.lat, b.lng)
  const dist = getDistance(state.lat, state.lng, b.lat, b.lng)
  const delta = state.headingSmooth !== null ? getAngularDelta(state.headingSmooth, bearing) : null
  return { bearing: Math.round(bearing), dist: Math.round(dist), delta: delta !== null ? Math.round(delta) : null, x: Math.round(b.mesh.position.x), z: Math.round(b.mesh.position.z) }
}

export function initRenderer(canvas) {
  W = window.innerWidth
  H = window.innerHeight

  // ── THREE RENDERER ──
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setSize(W, H)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setClearColor(0x000000, 0)

  // ── SCENE ──
  scene = new THREE.Scene()

  // ── CAMERA ──
  camera = new THREE.PerspectiveCamera(60, W / H, 0.01, 1000)
  camera.position.set(0, 1.6, 0)

  // ── LIGHTING ──
  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(5, 10, 5)
  scene.add(sun)

  // ── YELLOW 3D ARROW ──
  const arrowShape = new THREE.Shape()
  arrowShape.moveTo(0, 0.06)
  arrowShape.lineTo(0.01, 0.06)
  arrowShape.lineTo(0.01, 0.15)
  arrowShape.lineTo(0.035, 0.15)
  arrowShape.lineTo(0, 0.26)
  arrowShape.lineTo(-0.035, 0.15)
  arrowShape.lineTo(-0.01, 0.15)
  arrowShape.lineTo(-0.01, 0.06)
  arrowShape.lineTo(0, 0.06)

  const extrudeSettings = { depth: 0.015, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, extrudeSettings)
  const yellowFront = new THREE.MeshBasicMaterial({ color: 0xffdd00 })
  const yellowSide  = new THREE.MeshBasicMaterial({ color: 0xcc9900 })
  const arrowMesh = new THREE.Mesh(arrowGeo, [yellowFront, yellowSide])
  arrowGeo.center()

  arrowGroup = new THREE.Group()
  arrowGroup.add(arrowMesh)
  arrowGroup.position.set(0, -0.18, -0.5)
  arrowGroup.rotation.x = -Math.PI / 2

  camera.add(arrowGroup)
  scene.add(camera)

  window.addEventListener('resize', onResize)
}

function onResize() {
  W = window.innerWidth
  H = window.innerHeight
  renderer.setSize(W, H)
  camera.aspect = W / H
  camera.updateProjectionMatrix()
}

export function startRenderLoop() {
  if (rafId) return
  loop()
}

export function stopRenderLoop() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
}

function loop() {
  rafId = requestAnimationFrame(loop)

  const heading = state.headingSmooth
  const pitch   = state.pitch

  // Update camera position from live GPS
  if (state.gpsReady && originLat !== null) {
    const pos = gpsToLocal(state.lat, state.lng)
    camera.position.x = pos.x
    camera.position.z = pos.z
  }

  // Build camera rotation from heading + pitch only (no roll)
  const yaw = heading !== null ? -heading * (Math.PI / 180) : 0
  const pitchRad = pitch !== null ? (pitch - 90) * (Math.PI / 180) : 0

  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchRad)
  camera.quaternion.copy(qYaw.multiply(qPitch))

  for (const b of banners) {
    // Slow clockwise spin
    b.mesh.rotation.y -= 0.005

    // Check circle proximity
    const dx = camera.position.x - b.mesh.position.x
    const dz = camera.position.z - b.mesh.position.z
    const distToCircle = Math.sqrt(dx * dx + dz * dz)
    if (distToCircle < b.circleRadius) {
      b.circleMat.color.setHex(0x44ff44)
    } else {
      b.circleMat.color.setHex(0xffdd00)
    }
  }

  // Rotate arrow toward target mural (relative to current heading)
  if (arrowGroup) {
    if (arrowTarget && state.gpsReady && heading !== null) {
      const bearingToTarget = getBearing(state.lat, state.lng, arrowTarget.lat, arrowTarget.lng)
      const delta = getAngularDelta(heading, bearingToTarget)
      const deltaRad = delta * (Math.PI / 180)
      // Arrow points forward (-Z) by default, rotate Z axis in camera space
      arrowGroup.rotation.set(-Math.PI / 2, 0, -deltaRad)
    } else {
      // No target — point straight ahead
      arrowGroup.rotation.set(-Math.PI / 2, 0, 0)
    }
  }

  renderer.render(scene, camera)
}

// ── CANVAS UTIL ──

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy)
      line = word
      cy += lineH
    } else {
      line = test
    }
  }
  ctx.fillText(line, x, cy)
}

function wrapTextBottom(ctx, text, x, bottomY, maxW, lineH) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  lines.push(line)

  let cy = bottomY - (lines.length - 1) * lineH
  for (const l of lines) {
    ctx.fillText(l, x, cy)
    cy += lineH
  }
}
