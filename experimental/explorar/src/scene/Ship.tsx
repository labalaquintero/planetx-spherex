import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, ExtrudeGeometry, LatheGeometry, Shape, Vector2, type MeshBasicMaterial } from 'three'
import { SHIP } from '../engine/shipSpec'

const HULL = '#cbd5e1'
const WING = '#64748b'
const DARK = '#334155'
/** Acento sky del visor; se pinta sin tone mapping para que el bloom lo recoja. */
const ACCENT = '#38bdf8'
const GLOW = '#38bdf8'

/** Posición de la tobera en coordenadas de la nave (la usa la estela). */
export const NOZZLE: readonly [number, number, number] = [0, -0.02, SHIP.tailZ + 0.15]

const R_BODY = SHIP.bodyWidth / 2
const NOSE = SHIP.noseZ - SHIP.shoulderZ // < 0
/** Borde de ataque del ala: de la raíz (junto al hombro) a la punta. */
const LE = { x0: R_BODY * 0.7, z0: SHIP.shoulderZ + 0.15, x1: SHIP.tipX - 0.07, z1: SHIP.tipZ - 0.33 }
const LE_LEN = Math.hypot(LE.x1 - LE.x0, LE.z1 - LE.z0)
const LE_ANGLE = Math.atan2(LE.z1 - LE.z0, LE.x1 - LE.x0)

function useGeometries() {
  const g = useMemo(() => {
    // Fuselaje torneado (perfil en r, y = -z), con las cotas ajustadas al boceto (shipSpec).
    const profile: [number, number][] = [
      [0.0, SHIP.tailZ - 0.05],
      [R_BODY * 0.8, SHIP.tailZ - 0.05],
      [R_BODY, SHIP.engineZ],
      [R_BODY * 0.97, (SHIP.engineZ + SHIP.shoulderZ) / 2],
      [R_BODY * 0.85, SHIP.shoulderZ],
      [R_BODY * 0.5, SHIP.shoulderZ + NOSE * 0.5],
      [R_BODY * 0.18, SHIP.shoulderZ + NOSE * 0.88],
      [0.0, SHIP.noseZ],
    ]
    const fuselage = new LatheGeometry(
      profile.map(([r, z]) => new Vector2(r, -z)),
      18,
    )
    fuselage.rotateX(-Math.PI / 2)
    fuselage.scale(1, 0.72, 1)

    // Ala derecha barrida: (x, y) del dibujo con y = -z; al acostarla, y → -Z.
    const s = new Shape()
    s.moveTo(LE.x0, -LE.z0)
    s.lineTo(LE.x1, -LE.z1)
    s.lineTo(SHIP.tipX, -SHIP.tipZ)
    s.lineTo(LE.x0, -(SHIP.engineZ - 0.05))
    s.closePath()
    const wing = new ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.02, bevelSegments: 1 })
    wing.rotateX(-Math.PI / 2)
    return { fuselage, wing }
  }, [])
  useEffect(
    () => () => {
      g.fuselage.dispose()
      g.wing.dispose()
    },
    [g],
  )
  return g
}

/**
 * Nave genérica procedural, vista desde atrás (cámara de persecución): fuselaje torneado con nariz puntiaguda,
 * cabina, alas barridas con franja luminosa y bloque de motor con tobera. Las cotas (nariz, hombro,
 * envergadura, punta de ala, motor) salen del ajuste a la silueta del boceto. Unos mil triángulos.
 */
export function Ship({ thrust }: { thrust?: MutableRefObject<{ thrust: number }> }) {
  const { fuselage, wing } = useGeometries()
  const engineLen = SHIP.tailZ - SHIP.engineZ
  const glow = useRef<MeshBasicMaterial>(null)
  const strobe = useRef<MeshBasicMaterial>(null)
  const glowBase = useMemo(() => new Color(GLOW), [])
  useFrame((state) => {
    // Brillo de la tobera según el empuje (el bloom lo recoge) y luz estroboscópica de cola.
    const k = thrust?.current.thrust ?? 0.3
    glow.current?.color.copy(glowBase).multiplyScalar(0.35 + 1.3 * k)
    if (strobe.current) strobe.current.opacity = state.clock.elapsedTime % 1.4 < 0.07 ? 1 : 0
  })
  return (
    <group>
      <mesh geometry={fuselage}>
        <meshStandardMaterial color={HULL} metalness={0.45} roughness={0.45} envMapIntensity={1} />
      </mesh>
      {/* Cabina, justo detrás del hombro */}
      <mesh position={[0, R_BODY * 0.5, SHIP.shoulderZ + 0.55]} scale={[R_BODY * 0.42, R_BODY * 0.28, 0.55]}>
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial color="#0c4a6e" emissive={ACCENT} emissiveIntensity={0.35} metalness={0.7} roughness={0.12} />
      </mesh>
      {[1, -1].map((side) => (
        <group key={side} scale={[side, 1, 1]} position={[0, -0.06, 0]}>
          <mesh geometry={wing}>
            <meshStandardMaterial color={WING} metalness={0.6} roughness={0.38} envMapIntensity={1.1} />
          </mesh>
          <mesh position={[(LE.x0 + LE.x1) / 2, 0.06, (LE.z0 + LE.z1) / 2]} rotation={[0, -LE_ANGLE, 0]}>
            <boxGeometry args={[LE_LEN, 0.02, 0.05]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} />
          </mesh>
          {/* Luces de navegación: roja a babor (izquierda), verde a estribor (derecha). */}
          <mesh position={[SHIP.tipX, 0.03, SHIP.tipZ - 0.16]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshBasicMaterial color={side > 0 ? '#4ade80' : '#f87171'} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* Bloque de motor: caja del ancho del cuerpo, como en el boceto */}
      <mesh position={[0, -0.02, SHIP.engineZ + engineLen / 2]}>
        <boxGeometry args={[SHIP.bodyWidth * 0.95, 0.62, engineLen]} />
        <meshStandardMaterial color={DARK} metalness={0.7} roughness={0.35} envMapIntensity={1.1} />
      </mesh>
      <mesh position={[0, 0.36, SHIP.tailZ - 0.1]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial ref={strobe} color="#ffffff" transparent opacity={0} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.02, SHIP.tailZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.26, 0.2, 20, 1, true]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.35} side={2} />
      </mesh>
      <mesh position={[0, -0.02, NOZZLE[2] - 0.02]}>
        <circleGeometry args={[0.24, 24]} />
        <meshBasicMaterial ref={glow} color={GLOW} toneMapped={false} />
      </mesh>
    </group>
  )
}
