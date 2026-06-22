/**
 * renderer2d.js
 * Canvas 2D overlay for HUD elements: crosshair, sensor warnings.
 * Sits on top of the Three.js WebGL canvas.
 */

import { state } from './sensors.js'

let canvas2d, ctx
let W, H
let rafId = null

export function initHUD(canvas) {
  canvas2d = canvas
  ctx = canvas.getContext('2d')
  resize()
  window.addEventListener('resize', resize)
}

function resize() {
  canvas2d.width  = window.innerWidth
  canvas2d.height = window.innerHeight
  W = canvas2d.width
  H = canvas2d.height
}

export function startHUDLoop() {
  if (rafId) return
  loop()
}

export function stopHUDLoop() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
}

function loop() {
  rafId = requestAnimationFrame(loop)
  ctx.clearRect(0, 0, W, H)

  drawCrosshair()

  if (!state.compassReady) drawWarning('Move your phone to calibrate compass', H * 0.7)
  if (!state.gpsReady)     drawWarning('Waiting for GPS fix...', H * 0.75)
}

function drawCrosshair() {
  const cx = W / 2, cy = H / 2
  const size = 18
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - size, cy); ctx.lineTo(cx + size, cy)
  ctx.moveTo(cx, cy - size); ctx.lineTo(cx, cy + size)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, 5, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.stroke()
  ctx.restore()
}

function drawWarning(msg, y) {
  ctx.save()
  ctx.font = '12px -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,200,0,0.8)'
  ctx.textAlign = 'center'
  ctx.fillText(msg, W / 2, y)
  ctx.restore()
}
