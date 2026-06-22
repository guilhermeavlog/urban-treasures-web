/**
 * camera.js
 * Attaches a camera stream to the <video> element.
 * Always uses rear camera. Handles stream lifecycle.
 */

let activeStream = null

export function attachCamera(videoEl, stream) {
  activeStream = stream
  videoEl.srcObject = stream
}

export function stopCamera() {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop())
    activeStream = null
  }
}

export function resizeCanvas(canvas) {
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
}
