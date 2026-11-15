import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { approach, jumpFrame } from '../engine/motion'
import { AdaptiveQuality, type QualityLevel } from '../engine/quality'
import { mulberry32 } from '../engine/random'
import { FRAGMENT, VERTEX } from './shader'

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
}

interface Props {
  input: MutableRefObject<BackdropInput>
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
export function Backdrop({ input, layer, animate, quality, forced }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

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

