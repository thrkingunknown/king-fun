import { useEffect, useRef } from 'react'

type AmbientBackgroundProps = {
  paused: boolean
}

type Point3D = { x: number; y: number; z: number }
type ProjectedPoint = { x: number; y: number; z: number; scale: number }

const LATITUDE_COUNT = 12
const LONGITUDE_COUNT = 42
const ORBIT_COUNT = 20
const FOCAL_LENGTH = 780
const FRAME_INTERVAL = 1000 / 30

const spherePoint = (latitude: number, longitude: number, radius: number): Point3D => ({
  x: Math.cos(latitude) * Math.cos(longitude) * radius,
  y: Math.sin(latitude) * radius,
  z: Math.cos(latitude) * Math.sin(longitude) * radius,
})

function rotatePoint(point: Point3D, yaw: number, pitch: number, roll: number): Point3D {
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const cosPitch = Math.cos(pitch)
  const sinPitch = Math.sin(pitch)
  const cosRoll = Math.cos(roll)
  const sinRoll = Math.sin(roll)

  const x1 = point.x * cosYaw - point.z * sinYaw
  const z1 = point.x * sinYaw + point.z * cosYaw
  const y2 = point.y * cosPitch - z1 * sinPitch
  const z2 = point.y * sinPitch + z1 * cosPitch

  return {
    x: x1 * cosRoll - y2 * sinRoll,
    y: x1 * sinRoll + y2 * cosRoll,
    z: z2,
  }
}

function projectPoint(point: Point3D, centerX: number, centerY: number, radius: number): ProjectedPoint {
  const scale = FOCAL_LENGTH / (FOCAL_LENGTH + point.z)
  return {
    x: centerX + point.x * scale,
    y: centerY + point.y * scale,
    z: point.z / radius,
    scale,
  }
}

/**
 * Owns the mutable animation state outside React's render lifecycle. Keeping
 * the renderer in this imperative boundary avoids mutating render-owned values
 * and makes the canvas context's lifetime explicit for TypeScript.
 */
function mountAmbientScene(canvas: HTMLCanvasElement, paused: boolean): () => void {
  const maybeContext = canvas.getContext('2d', { alpha: true })
  if (maybeContext === null) return () => undefined
  const context: CanvasRenderingContext2D = maybeContext

  // All mutable values below belong exclusively to this renderer instance.
  let width = 0
  let height = 0
  let pixelRatio = 1
  let frame = 0
  let lastFrameAt = 0
  let visible = !document.hidden
  let yaw = 0
  let pitch = 0
  let targetYaw = 0
  let targetPitch = 0
  let pointerX = -10_000
  let pointerY = -10_000
  let rippleX = 0
  let rippleY = 0
  let rippleStartedAt = -10_000
  let pulse = 0
  let interactionCount = 0

  const noteInteraction = () => {
    interactionCount += 1
    canvas.dataset.interactionCount = String(interactionCount)
  }

  const rings = Array.from({ length: LATITUDE_COUNT - 1 }, (_, ringIndex) => {
    const latitude = -Math.PI / 2 + ((ringIndex + 1) * Math.PI) / LATITUDE_COUNT
    return Array.from({ length: LONGITUDE_COUNT }, (_, pointIndex) =>
      spherePoint(latitude, (pointIndex / LONGITUDE_COUNT) * Math.PI * 2, 1),
    )
  })
  const meridians = Array.from({ length: ORBIT_COUNT }, (_, orbitIndex) => {
    const longitude = (orbitIndex / ORBIT_COUNT) * Math.PI * 2
    return Array.from({ length: LATITUDE_COUNT + 1 }, (_, pointIndex) =>
      spherePoint(-Math.PI / 2 + (pointIndex / LATITUDE_COUNT) * Math.PI, longitude, 1),
    )
  })
  const vertices = rings.flatMap(ring => ring.filter((_, index) => index % 3 === 0))

  const resize = () => {
    width = Math.max(1, window.innerWidth)
    height = Math.max(1, window.innerHeight)
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35)
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    render(performance.now(), true)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (paused) return
    pointerX = event.clientX
    pointerY = event.clientY
    noteInteraction()
    targetYaw = ((event.clientX / Math.max(1, width)) - 0.5) * 0.72
    targetPitch = ((event.clientY / Math.max(1, height)) - 0.5) * 0.42
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (paused || (event.pointerType === 'mouse' && event.button !== 0)) return
    const target = event.target
    if (target instanceof Element && target.closest('button,a,input,select,textarea,[role="button"],[role="switch"]')) return
    rippleX = event.clientX
    rippleY = event.clientY
    noteInteraction()
    rippleStartedAt = performance.now()
    pulse = 1
  }

  const handlePointerLeave = () => {
    targetYaw = 0
    targetPitch = 0
    pointerX = -10_000
    pointerY = -10_000
  }

  const handleVisibility = () => {
    visible = !document.hidden
    if (!visible && frame) {
      window.cancelAnimationFrame(frame)
      frame = 0
    } else if (visible && !paused && !frame) {
      frame = window.requestAnimationFrame(tick)
    }
  }

  const drawLine = (points: readonly Point3D[], centerX: number, centerY: number, radius: number, alpha: number, tint: 'lime' | 'cyan' | 'violet', closed: boolean) => {
    if (points.length < 2) return
    const projected = points.map(point => projectPoint(rotatePoint({ x: point.x * radius, y: point.y * radius, z: point.z * radius }, yaw, pitch, yaw * 0.12), centerX, centerY, radius))
    const averageDepth = projected.reduce((sum, point) => sum + point.z, 0) / projected.length
    const hue = tint === 'lime' ? '190,236,128' : tint === 'cyan' ? '119,210,229' : '176,155,255'
    context.beginPath()
    context.moveTo(projected[0]!.x, projected[0]!.y)
    for (let index = 1; index < projected.length; index += 1) context.lineTo(projected[index]!.x, projected[index]!.y)
    if (closed) context.closePath()
    context.strokeStyle = `rgba(${hue},${alpha * (0.35 + (averageDepth + 1) * 0.32)})`
    context.lineWidth = 0.8 + Math.max(0, averageDepth) * 0.45
    context.stroke()
  }

  function render(now: number, staticFrame = false) {
    context.clearRect(0, 0, width, height)

    const compact = width < 700
    const radius = Math.min(width * (compact ? 0.39 : 0.255), height * (compact ? 0.24 : 0.34), compact ? 190 : 330)
    const centerX = width * (compact ? 0.78 : 0.79)
    const centerY = height * (compact ? 0.24 : 0.34)
    const time = staticFrame ? 0.35 : now * 0.00012
    const motionYaw = time * 0.7
    yaw += (targetYaw + motionYaw - yaw) * (staticFrame ? 1 : 0.035)
    pitch += (targetPitch + Math.sin(time * 0.58) * 0.08 - pitch) * (staticFrame ? 1 : 0.035)
    pulse *= staticFrame ? 0 : 0.94

    const glow = context.createRadialGradient(centerX, centerY, radius * 0.08, centerX, centerY, radius * 1.55)
    glow.addColorStop(0, 'rgba(167,220,124,0.085)')
    glow.addColorStop(0.48, 'rgba(112,178,194,0.035)')
    glow.addColorStop(1, 'rgba(112,178,194,0)')
    context.fillStyle = glow
    context.fillRect(centerX - radius * 1.6, centerY - radius * 1.6, radius * 3.2, radius * 3.2)

    for (let index = 0; index < rings.length; index += 1) {
      const tint = index % 4 === 0 ? 'violet' : index % 3 === 0 ? 'cyan' : 'lime'
      drawLine(rings[index]!, centerX, centerY, radius * (1 + pulse * 0.025), compact ? 0.10 : 0.145, tint, true)
    }
    for (let index = 0; index < meridians.length; index += 1) {
      const tint = index % 5 === 0 ? 'violet' : index % 3 === 0 ? 'cyan' : 'lime'
      drawLine(meridians[index]!, centerX, centerY, radius * (1 + pulse * 0.025), compact ? 0.085 : 0.12, tint, false)
    }

    for (let index = 0; index < vertices.length; index += 1) {
      const point = rotatePoint({
        x: vertices[index]!.x * radius,
        y: vertices[index]!.y * radius,
        z: vertices[index]!.z * radius,
      }, yaw, pitch, yaw * 0.12)
      const projected = projectPoint(point, centerX, centerY, radius)
      const distance = Math.hypot(projected.x - pointerX, projected.y - pointerY)
      const focus = Math.max(0, 1 - distance / (radius * 0.42))
      const opacity = 0.16 + Math.max(0, projected.z) * 0.2 + focus * 0.55
      context.beginPath()
      context.arc(projected.x, projected.y, (1.05 + focus * 1.6) * projected.scale, 0, Math.PI * 2)
      context.fillStyle = `rgba(205,244,153,${opacity})`
      context.fill()
    }

    // Three orbital satellites provide depth cues and a second pointer-reactive layer.
    for (let index = 0; index < 3; index += 1) {
      const orbitAngle = time * (index % 2 === 0 ? 0.8 : -0.57) + (index * Math.PI * 2) / 3
      const orbitPoint = rotatePoint({
        x: Math.cos(orbitAngle) * radius * 1.23,
        y: Math.sin(orbitAngle * 0.74) * radius * 0.53,
        z: Math.sin(orbitAngle) * radius * 0.85,
      }, yaw * 0.7, pitch * 0.55, 0)
      const satellite = projectPoint(orbitPoint, centerX, centerY, radius)
      const satelliteRadius = (3.2 + (satellite.z + 1) * 1.6) * satellite.scale
      const satelliteGlow = context.createRadialGradient(satellite.x, satellite.y, 0, satellite.x, satellite.y, satelliteRadius * 6)
      satelliteGlow.addColorStop(0, index === 1 ? 'rgba(182,157,255,0.8)' : 'rgba(201,241,147,0.8)')
      satelliteGlow.addColorStop(1, 'rgba(160,210,175,0)')
      context.fillStyle = satelliteGlow
      context.beginPath()
      context.arc(satellite.x, satellite.y, satelliteRadius * 6, 0, Math.PI * 2)
      context.fill()
      context.beginPath()
      context.arc(satellite.x, satellite.y, satelliteRadius, 0, Math.PI * 2)
      context.fillStyle = index === 1 ? 'rgba(208,192,255,0.9)' : 'rgba(219,251,168,0.95)'
      context.fill()
    }

    const rippleAge = (now - rippleStartedAt) / 1000
    if (!staticFrame && rippleAge >= 0 && rippleAge < 1.25) {
      const progress = rippleAge / 1.25
      context.beginPath()
      context.arc(rippleX, rippleY, 12 + progress * 145, 0, Math.PI * 2)
      context.strokeStyle = `rgba(198,242,145,${(1 - progress) * 0.32})`
      context.lineWidth = 1.1
      context.stroke()
      context.beginPath()
      context.arc(rippleX, rippleY, 5 + progress * 54, 0, Math.PI * 2)
      context.strokeStyle = `rgba(144,216,223,${(1 - progress) * 0.18})`
      context.lineWidth = 0.7
      context.stroke()
    }

    if (staticFrame) {
      targetYaw = 0
      targetPitch = 0
    }
  }

  function tick(now: number) {
    if (paused || !visible) {
      frame = 0
      return
    }
    if (now - lastFrameAt >= FRAME_INTERVAL) {
      render(now)
      lastFrameAt = now
    }
    frame = window.requestAnimationFrame(tick)
  }

  resize()
  window.addEventListener('resize', resize, { passive: true })
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('pointerdown', handlePointerDown, { passive: true })
  window.addEventListener('pointerleave', handlePointerLeave, { passive: true })
  document.addEventListener('visibilitychange', handleVisibility)

  if (!paused && visible) frame = window.requestAnimationFrame(tick)

  return () => {
    if (frame) window.cancelAnimationFrame(frame)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerdown', handlePointerDown)
    window.removeEventListener('pointerleave', handlePointerLeave)
    document.removeEventListener('visibilitychange', handleVisibility)
  }
}

/**
 * A decorative, pointer-reactive 3D wire sculpture. It uses a capped-DPR
 * Canvas 2D renderer so the shell does not need a WebGL or animation runtime.
 * Pointer movement steers the sculpture; taps on empty space create ripples.
 */
export function AmbientBackground({ paused }: AmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return mountAmbientScene(canvas, paused)
  }, [paused])

  return <canvas ref={canvasRef} className="ambient-scene" aria-hidden="true" data-ambient-scene data-paused={paused ? 'true' : 'false'} data-interaction-count="0" />
}
