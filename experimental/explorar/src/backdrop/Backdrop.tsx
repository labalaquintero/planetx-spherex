import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { approach, jumpFrame } from '../engine/motion'
import { AdaptiveQuality, type QualityLevel } from '../engine/quality'
import { mulberry32 } from '../engine/random'
import { areaRadius, areaScale, areaUv, GALAXY, galaxyLayout } from './galaxy'
import { FRAGMENT, VERTEX } from './shader'

/** Región de un sector en la galaxia (posición y tamaño del boceto, color 0..1). */
export interface BackdropArea {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly color: readonly [number, number, number]
  readonly soon: boolean
}

const MAX_AREAS = 3

/** Estado que el padre escribe sin provocar renders: cursor y salto. */
export interface BackdropInput {
  /** Cursor normalizado [-1, 1] (objetivo; el fondo lo suaviza). */
  pointerX: number
  pointerY: number
  /** performance.now() del inicio del salto, o null. */
  jumpStart: number | null
  /** Centro del salto en [0, 1] del contenedor (x a la derecha, y hacia abajo). */
  jumpX: number
  jumpY: number
  /** Índice de la región señalada (cursor o foco), o −1. */
  hover: number
}

interface Props {
  input: MutableRefObject<BackdropInput>
  /** Regiones de los sectores (como mucho tres). */
  areas: readonly BackdropArea[]
  /** Elemento al que se le escriben --ex-px, --ex-py (paralaje de las esferas) y --ex-jump. */
  layer: MutableRefObject<HTMLElement | null>
  animate: boolean
  quality: QualityLevel
  forced: boolean
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null
}

/** Campo estelar de respaldo (SVG) si no hay WebGL. */
function SvgStars() {
  const stars = useMemo(() => {
    const rnd = mulberry32(7)
    return Array.from({ length: 180 }, (_, i) => ({ id: i, x: rnd() * 100, y: rnd() * 100, r: 0.4 + rnd() * 1.1, o: 0.25 + rnd() * 0.65 }))
  }, [])
  return (
    <svg className="ex-backdrop-svg" aria-hidden="true" focusable="false">
      {stars.map((s) => (
        <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#e2e8f0" opacity={s.o} />
      ))}
    </svg>
  )
}

/**
 * Fondo de la selección en WebGL puro (sin three: no pesa en el chunk principal). Un único
 * triángulo a pantalla completa; la resolución baja sola si los FPS caen.
 */
export function Backdrop({ input, areas, layer, animate, quality, forced }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const areasRef = useRef(areas)
  areasRef.current = areas

  // Sin WebGL las regiones no se dibujan: el CSS las muestra con un borde (data-flat).
  useEffect(() => {
    const el = layer.current
    if (!el) return
    if (failed) el.dataset.flat = ''
    else delete el.dataset.flat
  }, [failed, layer])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    const vs = gl && compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fs = gl && compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const prog = gl && vs && fs ? gl.createProgram() : null
    if (!gl || !vs || !fs || !prog) {
      setFailed(true)
      return
    }
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFailed(true)
      return
    }
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u = (n: string) => gl.getUniformLocation(prog, n)
    const uRes = u('uRes'), uTime = u('uTime'), uPar = u('uPar'), uStreak = u('uStreak')
    const uZoom = u('uZoom'), uCenter = u('uCenter'), uOct = u('uOct')
    const uGal = u('uGal'), uGalAng = u('uGalAng'), uGalPar = u('uGalPar'), uAreaN = u('uAreaN'), uAreaRatio = u('uAreaRatio')
    const uArea = u('uArea'), uAreaCol = u('uAreaCol'), uHover = u('uHover')
    const hover = new Float32Array(MAX_AREAS)
    const areaBuf = new Float32Array(MAX_AREAS * 4)
    const colBuf = new Float32Array(MAX_AREAS * 3)

    const aq = new AdaptiveQuality(quality, forced)
    let settings = aq.settings
    let raf = 0
    let last = performance.now()
    const t0 = last
    let px = 0
    let py = 0
    let dirty = true

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * settings.backdropScale
      const w = Math.max(1, Math.round(r.width * scale))
      const h = Math.max(1, Math.round(r.height * scale))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      dirty = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const frame = (now: number) => {
      const dt = now - last
      last = now
      const inp = input.current
      const jumping = inp.jumpStart !== null
      if (animate || jumping) {
        if (aq.sample(dt)) {
          settings = aq.settings
          resize()
        }
        px = animate ? approach(px, inp.pointerX, dt, 180) : 0
        py = animate ? approach(py, inp.pointerY, dt, 180) : 0
      }
      // Brillo de cada región: sube al señalarla y baja al salir (instantáneo con movimiento reducido).
      for (let i = 0; i < MAX_AREAS; i++) {
        const target = i === inp.hover ? 1 : 0
        const next = animate ? approach(hover[i]!, target, dt, 140) : target
        if (Math.abs(next - hover[i]!) > 1e-4) dirty = true
        hover[i] = next
      }
      const jf = jumping ? jumpFrame(now - (inp.jumpStart as number)) : { streak: 0, zoom: 1, flash: 0 }
      const el = layer.current
      if (el) {
        el.style.setProperty('--ex-px', px.toFixed(4))
        el.style.setProperty('--ex-py', py.toFixed(4))
        el.style.setProperty('--ex-jump', jf.flash.toFixed(3))
      }
      if (animate || jumping || dirty) {
        const aspect = canvas.width / canvas.height
        gl.uniform2f(uRes, canvas.width, canvas.height)
        gl.uniform1f(uTime, animate ? (now - t0) / 1000 : 0)
        gl.uniform2f(uPar, px, -py)
        gl.uniform1f(uStreak, jf.streak)
        gl.uniform1f(uZoom, jf.zoom)
        gl.uniform2f(uCenter, (inp.jumpX - 0.5) * aspect, 0.5 - inp.jumpY)
        gl.uniform1f(uOct, settings.nebulaOctaves)
        const g = galaxyLayout(aspect)
        gl.uniform4f(uGal, g.cx, g.cy, g.major, g.minor)
        gl.uniform1f(uGalAng, g.angleRad)
        gl.uniform1f(uGalPar, GALAXY.parallax)
        gl.uniform1f(uAreaRatio, GALAXY.areaRatio)
        const list = areasRef.current.slice(0, MAX_AREAS)
        list.forEach((a, i) => {
          const [x, y] = areaUv(a.x, a.y, aspect)
          areaBuf.set([x, y, areaRadius(a.size) * areaScale(aspect), a.soon ? 1 : 0], i * 4)
          colBuf.set(a.color, i * 3)
        })
        gl.uniform1f(uAreaN, list.length)
        gl.uniform4fv(uArea, areaBuf)
        gl.uniform3fv(uAreaCol, colBuf)
        gl.uniform1fv(uHover, hover)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        dirty = false
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const onLost = (e: Event) => {
      e.preventDefault()
      setFailed(true)
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
    }
  }, [input, layer, animate, quality, forced])

  return failed ? <SvgStars /> : <canvas ref={canvasRef} className="ex-backdrop" aria-hidden="true" />
}

