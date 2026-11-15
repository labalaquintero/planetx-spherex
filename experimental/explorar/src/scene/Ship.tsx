import { useEffect, useMemo } from 'react'
import { ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from 'three'

const HULL = '#cbd5e1'
const WING = '#64748b'
const DARK = '#334155'
/** Acento sky del visor; se pinta sin tone mapping para que el bloom lo recoja. */
const ACCENT = '#38bdf8'
const GLOW = '#38bdf8'

/** Posición de la tobera en coordenadas de la nave (la usa la estela). */
export const NOZZLE: readonly [number, number, number] = [0, -0.02, 2.1]

function useGeometries() {
  const g = useMemo(() => {
    // Fuselaje torneado: de la cola a la punta de la nariz, a lo largo de +Y; luego hacia -Z.
    const profile = [
      [0.0, -1.62],
      [0.34, -1.6],
      [0.43, -1.05],
      [0.42, -0.2],
      [0.33, 0.6],
      [0.2, 1.3],
      [0.08, 1.85],
      [0.0, 2.15],
    ].map(([r, y]) => new Vector2(r, y))
    const fuselage = new LatheGeometry(profile, 18)
    fuselage.rotateX(-Math.PI / 2)
    fuselage.scale(1, 0.72, 1)

    // Ala derecha barrida: (x, y) del dibujo; al acostarla, y → -Z (adelante).
    const s = new Shape()
    s.moveTo(0.28, 0.45)
    s.lineTo(2.05, -1.05)
    s.lineTo(2.12, -1.38)
    s.lineTo(0.28, -1.32)
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

/** Ángulo y longitud del borde de ataque del ala (para la franja de acento). */
const LE = { x0: 0.28, z0: -0.45, x1: 2.05, z1: 1.05 }
const LE_LEN = Math.hypot(LE.x1 - LE.x0, LE.z1 - LE.z0)
const LE_ANGLE = Math.atan2(LE.z1 - LE.z0, LE.x1 - LE.x0)

/**
 * Nave genérica procedural, vista desde atrás: fuselaje torneado con nariz puntiaguda, cabina,
 * alas barridas con franja luminosa en el borde de ataque, bloque de motor con tobera brillante.
 * Mira hacia -Z. Unos mil triángulos.
 */
export function Ship() {
  const { fuselage, wing } = useGeometries()
  return (
    <group>
      <mesh geometry={fuselage}>
        <meshStandardMaterial color={HULL} metalness={0.2} roughness={0.6} />
      </mesh>
      {/* Cabina */}
      <mesh position={[0, 0.2, -0.45]} scale={[0.2, 0.13, 0.5]}>
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial color="#0c4a6e" emissive={ACCENT} emissiveIntensity={0.35} metalness={0.7} roughness={0.12} />
      </mesh>
      {/* Lomo */}
      <mesh position={[0, 0.27, 0.55]}>
        <boxGeometry args={[0.1, 0.06, 1.5]} />
        <meshStandardMaterial color={DARK} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Alas */}
      {[1, -1].map((side) => (
        <group key={side} scale={[side, 1, 1]} position={[0, -0.06, 0]}>
          <mesh geometry={wing}>
            <meshStandardMaterial color={WING} metalness={0.3} roughness={0.5} />
          </mesh>
          <mesh position={[(LE.x0 + LE.x1) / 2, 0.06, (LE.z0 + LE.z1) / 2]} rotation={[0, -LE_ANGLE, 0]}>
            <boxGeometry args={[LE_LEN, 0.02, 0.05]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} />
          </mesh>
          {/* Luz de punta de ala */}
          <mesh position={[2.1, 0.03, 1.2]}>
            <boxGeometry args={[0.06, 0.08, 0.32]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* Bloque de motor */}
      <mesh position={[0, -0.02, 1.55]}>
        <boxGeometry args={[0.92, 0.62, 0.8]} />
        <meshStandardMaterial color={DARK} metalness={0.45} roughness={0.45} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={`v${side}`} position={[side * 0.47, -0.02, 1.5]}>
          <boxGeometry args={[0.04, 0.4, 0.55]} />
          <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      {/* Tobera y su brillo */}
      <mesh position={[0, -0.02, 2.0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.26, 0.24, 20, 1, true]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.35} side={2} />
      </mesh>
      <mesh position={[0, -0.02, NOZZLE[2] - 0.02]}>
        <circleGeometry args={[0.24, 24]} />
        <meshBasicMaterial color={GLOW} toneMapped={false} />
      </mesh>
    </group>
  )
}
