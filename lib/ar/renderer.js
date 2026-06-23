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
let renderer, scene, camera, arrowGroup, arrowMat
let W, H
let rafId = null

// Spawn origin in GPS space
let originLat = null, originLng = null

// All placed banners
const banners = []

// Arrow target — when set, the arrow points toward this GPS coordinate
let arrowTarget = null  // { lat, lng, name }

// Flying birds for route
let routeGroup = null
let routeCurve = null
let birds = []

// Bird chirp audio
let audioCtx = null
let nextChirpTime = 0
let audioMuted = false

export function setMuted(val) { audioMuted = val }
export function isMuted() { return audioMuted }

export function initAudio() {
  if (audioCtx) return
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
}

function playChirp() {
  if (!audioCtx || audioMuted) return
  const now = audioCtx.currentTime

  // Random chirp characteristics
  const baseFreq = 2000 + Math.random() * 3000
  const duration = 0.05 + Math.random() * 0.1
  const numNotes = 1 + Math.floor(Math.random() * 4)

  for (let i = 0; i < numNotes; i++) {
    const t = now + i * (duration + 0.02)
    const freq = baseFreq + (Math.random() - 0.5) * 800

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(freq * (0.8 + Math.random() * 0.5), t + duration)

    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.04, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.start(t)
    osc.stop(t + duration + 0.01)
  }
}

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

/**
 * Draw a semi-transparent yellow path on the ground from GPS waypoints.
 * Call with [] or null to clear.
 */
/**
 * Create a simple bird mesh — two triangle wings that can flap.
 */
function createBird(color) {
  const group = new THREE.Group()

  // Body — small elongated shape
  const bodyGeo = new THREE.ConeGeometry(0.3, 2, 4)
  bodyGeo.rotateX(Math.PI / 2)
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide,
  })
  const body = new THREE.Mesh(bodyGeo, mat)
  group.add(body)

  // Left wing
  const wingGeo = new THREE.BufferGeometry()
  const wingVerts = new Float32Array([
    0, 0, 0,
    -3, 0.3, -0.5,
    -0.3, 0, -1.2,
  ])
  wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3))
  wingGeo.computeVertexNormals()
  const leftWing = new THREE.Mesh(wingGeo, mat)
  group.add(leftWing)

  // Right wing (mirrored)
  const wingGeo2 = new THREE.BufferGeometry()
  const wingVerts2 = new Float32Array([
    0, 0, 0,
    3, 0.3, -0.5,
    0.3, 0, -1.2,
  ])
  wingGeo2.setAttribute('position', new THREE.BufferAttribute(wingVerts2, 3))
  wingGeo2.computeVertexNormals()
  const rightWing = new THREE.Mesh(wingGeo2, mat)
  group.add(rightWing)

  return { group, leftWing, rightWing }
}

export function setRoutePath(waypoints) {
  // Remove old birds
  if (routeGroup) {
    scene.remove(routeGroup)
    routeGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
    routeGroup = null
    routeCurve = null
    birds = []
  }

  if (!waypoints || waypoints.length < 2 || originLat === null) return

  // Convert GPS waypoints to sky-level points
  const skyY = 60
  const points = waypoints.map(wp => {
    const { x, z } = gpsToLocal(wp.lat, wp.lng)
    return new THREE.Vector3(x, skyY, z)
  })

  // Smooth flight path
  routeCurve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)

  routeGroup = new THREE.Group()

  // Vivid bird colors
  const colors = [
    0xff3388, // pink
    0x2288ff, // blue
    0xff8800, // orange
    0x00dddd, // cyan
    0xcc22cc, // magenta
    0x44dd44, // green
    0xffdd00, // yellow
    0xff4444, // red
    0x8844ff, // purple
    0xff66aa, // light pink
    0x00aaff, // sky blue
    0xffaa22, // amber
  ]

  // Spawn 20 birds at staggered positions along the curve
  const numBirds = 20
  for (let i = 0; i < numBirds; i++) {
    const color = colors[i % colors.length]
    const { group, leftWing, rightWing } = createBird(color)

    // Scale birds up so they're visible from far away
    group.scale.set(2.5, 2.5, 2.5)

    routeGroup.add(group)

    birds.push({
      group,
      leftWing,
      rightWing,
      t: i / numBirds,                          // position along curve (0-1)
      speed: 0.015 + Math.random() * 0.01,      // slightly different speeds
      flapSpeed: 3 + Math.random() * 2,          // wing flap rate
      flapPhase: Math.random() * Math.PI * 2,    // offset so wings aren't in sync
      yOffset: (Math.random() - 0.5) * 15,       // spread vertically
      xOffset: (Math.random() - 0.5) * 15,       // spread sideways
    })
  }

  scene.add(routeGroup)
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

  // Create textures
  const texture = new THREE.CanvasTexture(cvs)
  texture.colorSpace = THREE.SRGBColorSpace

  // Grey canvas for unvisited state
  const greyCvs = document.createElement('canvas')
  greyCvs.width = texW
  greyCvs.height = texH
  const greyCtx = greyCvs.getContext('2d')
  const greyTex = new THREE.CanvasTexture(greyCvs)
  greyTex.colorSpace = THREE.SRGBColorSpace

  // Rebuild greyscale from the current color canvas
  function updateGreyTexture() {
    greyCtx.drawImage(cvs, 0, 0)
    const imgData = greyCtx.getImageData(0, 0, texW, texH)
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      const avg = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114
      d[i] = d[i+1] = d[i+2] = avg
    }
    greyCtx.putImageData(imgData, 0, 0)
    greyTex.needsUpdate = true
  }
  updateGreyTexture()

  // If a photo URL is provided, load it into the photo area
  if (photoUrl) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const scale = Math.min(photoW / img.width, photoH / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      const dx = 40 + (photoW - dw) / 2
      const dy = photoY + (photoH - dh) / 2

      ctx.fillStyle = '#ffffff'
      roundRect(ctx, 40, photoY, photoW, photoH, 16)
      ctx.fill()

      ctx.save()
      ctx.beginPath()
      roundRect(ctx, 40, photoY, photoW, photoH, 16)
      ctx.clip()
      ctx.drawImage(img, dx, dy, dw, dh)
      ctx.restore()

      texture.needsUpdate = true
      updateGreyTexture()
    }
    img.src = photoUrl
  }

  // ── 3D Box with same texture on all 4 side faces ──
  const bannerW = 2.5, bannerH = bannerW * (texH / texW), bannerD = 2.5
  const geometry = new THREE.BoxGeometry(bannerW, bannerH, bannerD)

  const greyMat = new THREE.MeshBasicMaterial({ map: greyTex })
  const colorMat = new THREE.MeshBasicMaterial({ map: texture })
  const greyTopBottom = new THREE.MeshBasicMaterial({ color: 0x999999 })
  const colorTopBottom = new THREE.MeshBasicMaterial({ color: 0xfafafa })

  const materials = [greyMat, greyMat, greyTopBottom, greyTopBottom, greyMat, greyMat]
  const colorMaterials = [colorMat, colorMat, colorTopBottom, colorTopBottom, colorMat, colorMat]

  const mesh = new THREE.Mesh(geometry, materials)
  mesh.position.set(x, 1.4, z)
  scene.add(mesh)

  // ── Yellow circle on the ground below the banner ──
  const circleRadius = 1.5
  const circleGeo = new THREE.RingGeometry(circleRadius - 0.15, circleRadius, 48)
  const circleMat = new THREE.MeshBasicMaterial({ color: 0xffdd00, side: THREE.DoubleSide })
  const circle = new THREE.Mesh(circleGeo, circleMat)
  circle.rotation.x = -Math.PI / 2
  circle.position.set(x, 0.01, z)
  scene.add(circle)

  banners.push({ mesh, name, lat, lng, circle, circleMat, circleRadius, visited: false, colorMaterials })
}

/**
 * Get the visited state of all banners.
 */
export function getVisitedMap() {
  const map = {}
  for (const b of banners) {
    map[b.name] = b.visited
  }
  return map
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

  // ── YELLOW 3D ARROW (polished) ──

  // Smooth arrow shape with curved edges
  const arrowShape = new THREE.Shape()
  arrowShape.moveTo(0, 0)
  arrowShape.lineTo(0.015, 0)
  arrowShape.lineTo(0.015, 0.1)
  arrowShape.lineTo(0.045, 0.1)
  arrowShape.lineTo(0, 0.2)         // tip
  arrowShape.lineTo(-0.045, 0.1)
  arrowShape.lineTo(-0.015, 0.1)
  arrowShape.lineTo(-0.015, 0)
  arrowShape.lineTo(0, 0)

  const extrudeSettings = {
    depth: 0.02,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    bevelSegments: 4,
  }
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, extrudeSettings)
  arrowGeo.center()

  // Arrow shader — white by default, colorful ink streaks when navigating
  arrowMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uNavigating: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uNavigating;
      varying vec3 vPos;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec3 col = vec3(1.0);

        if (uNavigating > 0.5) {
          // Scale up position so patches are visible on tiny geometry
          // Higher multiplier = smaller patches
          vec2 uv = vec2(vPos.x * 43.0, vPos.y * 25.0);

          // Slow drift upward
          float drift = uTime * -0.35;

          // Equal scale on both axes = proportional splashes
          // Widely spaced seeds so patches rarely overlap
          float n1 = noise(vec2(uv.x * 1.24, uv.y * 1.24) + vec2(0.0, drift));
          float n2 = noise(vec2(uv.x * 1.116, uv.y * 1.116) + vec2(50.0, drift * 0.9));
          float n3 = noise(vec2(uv.x * 1.364, uv.y * 1.364) + vec2(100.0, drift * 1.1));
          float n4 = noise(vec2(uv.x * 1.054, uv.y * 1.054) + vec2(150.0, drift * 0.8));
          float n5 = noise(vec2(uv.x * 1.302, uv.y * 1.302) + vec2(200.0, drift * 1.0));
          float n6 = noise(vec2(uv.x * 1.178, uv.y * 1.178) + vec2(250.0, drift * 0.95));
          float n7 = noise(vec2(uv.x * 1.24, uv.y * 1.24) + vec2(300.0, drift * 1.05));

          // Very high threshold = only the sharpest peaks = tiny splashes
          float threshold = 0.88;
          float edge = 0.03;

          // Only the strongest noise at each pixel gets to paint
          float maxN = max(n1, max(n2, max(n3, max(n4, max(n5, max(n6, n7))))));
          if (maxN > threshold) {
            float s = smoothstep(threshold, threshold + edge, maxN);
            if (n1 == maxN) {
              col = mix(col, vec3(1.0, 0.2, 0.55), s);     // pink
            } else if (n2 == maxN) {
              col = mix(col, vec3(0.15, 0.5, 1.0), s);     // blue
            } else if (n3 == maxN) {
              col = mix(col, vec3(1.0, 0.5, 0.0), s);      // orange
            } else if (n4 == maxN) {
              col = mix(col, vec3(0.0, 0.85, 0.9), s);     // cyan
            } else if (n5 == maxN) {
              col = mix(col, vec3(0.8, 0.1, 0.85), s);     // magenta
            } else if (n6 == maxN) {
              col = mix(col, vec3(1.0, 0.9, 0.0), s);      // yellow
            } else {
              col = mix(col, vec3(0.2, 0.9, 0.3), s);      // green
            }
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  })
  const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat)

  arrowGroup = new THREE.Group()
  arrowGroup.add(arrowMesh)
  arrowGroup.position.set(0, -0.16, -0.45)
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
    b.mesh.rotation.y -= 0.00233

    // Check circle proximity
    const dx = camera.position.x - b.mesh.position.x
    const dz = camera.position.z - b.mesh.position.z
    const distToCircle = Math.sqrt(dx * dx + dz * dz)
    if (distToCircle < b.circleRadius) {
      b.circleMat.color.setHex(0x44ff44)
      // Mark as visited and switch to color
      if (!b.visited) {
        b.visited = true
        b.mesh.material = b.colorMaterials
      }
    } else {
      b.circleMat.color.setHex(0xffdd00)
    }
  }

  // Animate birds along route
  if (routeCurve && birds.length) {
    const now = Date.now() / 1000

    // Random chirps every 0.5-2 seconds
    if (now > nextChirpTime) {
      playChirp()
      nextChirpTime = now + 0.5 + Math.random() * 1.5
    }

    for (const bird of birds) {
      // Move along curve, loop back to start
      bird.t = (bird.t + bird.speed * 0.016) % 1

      // Position on curve + spread offset
      const pos = routeCurve.getPointAt(bird.t)
      const tangent = routeCurve.getTangentAt(bird.t)
      // Perpendicular in XZ plane for sideways spread
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()

      bird.group.position.copy(pos)
      bird.group.position.addScaledVector(perp, bird.xOffset)
      bird.group.position.y += bird.yOffset

      // Face flight direction
      const lookAt = new THREE.Vector3().copy(pos).add(tangent)
      lookAt.y = bird.group.position.y
      bird.group.lookAt(lookAt)

      // Flap wings
      const flap = Math.sin(now * bird.flapSpeed + bird.flapPhase) * 0.6
      bird.leftWing.rotation.z = flap
      bird.rightWing.rotation.z = -flap
    }
  }

  // Rotate arrow toward target + gentle float animation
  if (arrowGroup) {
    const bob = Math.sin(Date.now() / 600) * 0.008
    arrowGroup.position.y = -0.16 + bob

    // Update arrow shader — colorful when navigating, white when idle
    if (arrowMat && arrowMat.uniforms) {
      arrowMat.uniforms.uTime.value = (Date.now() % 100000) / 1000
      arrowMat.uniforms.uNavigating.value = arrowTarget ? 1.0 : 0.0
    }

    if (arrowTarget && state.gpsReady && heading !== null) {
      const bearingToTarget = getBearing(state.lat, state.lng, arrowTarget.lat, arrowTarget.lng)
      const delta = getAngularDelta(heading, bearingToTarget)
      const deltaRad = delta * (Math.PI / 180)
      arrowGroup.rotation.set(-Math.PI / 2, 0, -deltaRad)
    } else {
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
