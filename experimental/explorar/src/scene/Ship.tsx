import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  MeshPhysicalMaterial,
  Shape,
  Vector2,
  type MeshBasicMaterial,
} from 'three'
import { SHIP } from '../engine/shipSpec'
import { makeHullMaps } from './hullTextures'

/** Acento sky del visor (sin tone mapping, para que el bloom lo recoja). */
const ACCENT = '#38bdf8'
const GLOW = '#7dd3fc'

/** Cuerpo del fuselaje: ancho medido en el boceto (fracción de la envergadura). */
const R_BODY = (SHIP.bodyWidth / 2) * 0.82
const NOSE = SHIP.noseZ - SHIP.shoulderZ // < 0
/** Motores: dos góndolas a los lados del cuerpo, terminan en la cola. */
const NACELLE_X = R_BODY * 0.95
const NACELLE_R = R_BODY * 0.42
const NACELLE_FRONT = SHIP.engineZ - 0.9
/** Toberas (coordenadas de la nave): las usan las estelas. */
export const NOZZLES: readonly (readonly [number, number, number])[] = [
  [-NACELLE_X, -0.06, SHIP.tailZ + 0.12],
  [NACELLE_X, -0.06, SHIP.tailZ + 0.12],
]
/** Compatibilidad: punto medio de las toberas. */
export const NOZZLE: readonly [number, number, number] = [0, -0.06, SHIP.tailZ + 0.12]

const LE = { x0: R_BODY * 0.7, z0: SHIP.shoulderZ + 0.35, x1: SHIP.tipX - 0.08, z1: SHIP.tipZ - 0.38 }
const LE_LEN = Math.hypot(LE.x1 - LE.x0, LE.z1 - LE.z0)
const LE_ANGLE = Math.atan2(LE.z1 - LE.z0, LE.x1 - LE.x0)
const DIHEDRAL = (5 * Math.PI) / 180

function useShipAssets() {
  const a = useMemo(() => {
    // Fuselaje torneado, perfil suave (r, z), aplanado en vertical.
    const profile: [number, number][] = [
      [0.0, SHIP.tailZ - 0.1],
      [R_BODY * 0.55, SHIP.tailZ - 0.1],
      [R_BODY * 0.92, SHIP.engineZ],
      [R_BODY, (SHIP.engineZ + SHIP.shoulderZ) * 0.5],
      [R_BODY * 0.93, SHIP.shoulderZ + 0.2],
      [R_BODY * 0.78, SHIP.shoulderZ],
      [R_BODY * 0.55, SHIP.shoulderZ + NOSE * 0.4],
      [R_BODY * 0.3, SHIP.shoulderZ + NOSE * 0.72],
      [R_BODY * 0.1, SHIP.shoulderZ + NOSE * 0.93],
      [0.0, SHIP.noseZ],
    ]
    const fuselage = new LatheGeometry(
      profile.map(([r, z]) => new Vector2(r, -z)),
      32,
    )
    fuselage.rotateX(-Math.PI / 2)
    fuselage.scale(1, 0.62, 1)

    // Ala derecha: delta barrida con espesor y bisel (y del dibujo = -z).
    const s = new Shape()
    s.moveTo(LE.x0, -LE.z0)
    s.lineTo(LE.x1, -LE.z1)
    s.lineTo(SHIP.tipX, -SHIP.tipZ)
    s.lineTo(SHIP.tipX - 0.35, -(SHIP.tipZ + 0.05))
    s.lineTo(LE.x0, -(SHIP.engineZ + 0.1))
    s.closePath()
    const wing = new ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.025, bevelSegments: 2 })
    wing.rotateX(-Math.PI / 2)
    wing.translate(0, -0.035, 0)

    // Aleta de punta de ala (hacia arriba y afuera).
    const f = new Shape()
    f.moveTo(0, 0)
    f.lineTo(0.42, 0)
    f.lineTo(0.2, 0.42)
    f.lineTo(0.06, 0.42)
    f.closePath()
    const fin = new ExtrudeGeometry(f, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 })

    const nacelle = new CylinderGeometry(NACELLE_R, NACELLE_R * 0.92, SHIP.tailZ - NACELLE_FRONT, 24, 1)
    nacelle.rotateX(Math.PI / 2)

    const maps = makeHullMaps(7)
    maps.map.repeat.set(3, 2)
    maps.roughness.repeat.set(3, 2)
    maps.normal.repeat.set(3, 2)
    const hull = new MeshPhysicalMaterial({
      color: '#e2e8f0',
      map: maps.map,
      roughnessMap: maps.roughness,
      normalMap: maps.normal,
      metalness: 0.72,
      roughness: 0.55,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.25,
    })
    const wingMat = hull.clone()
    wingMat.color = new Color('#94a3b8')
    const dark = new MeshPhysicalMaterial({ color: '#273244', metalness: 0.85, roughness: 0.38, clearcoat: 0.3, envMapIntensity: 1.1 })
    const glass = new MeshPhysicalMaterial({
      color: '#0b2236',
      metalness: 0.1,
      roughness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.4,
      emissive: new Color('#0ea5e9'),
      emissiveIntensity: 0.08,
    })
    return { fuselage, wing, fin, nacelle, maps, hull, wingMat, dark, glass }
  }, [])
  useEffect(
    () => () => {
      for (const g of [a.fuselage, a.wing, a.fin, a.nacelle]) g.dispose()
      for (const t of [a.maps.map, a.maps.roughness, a.maps.normal]) t.dispose()
      for (const m of [a.hull, a.wingMat, a.dark, a.glass]) m.dispose()
    },
    [a],
  )
  return a
}

/**
 * Nave procedural, vista desde atrás: fuselaje torneado con paneles (mapas de albedo, rugosidad y
 * relieve generados), cabina de vidrio con reflejo del cielo, alas delta con diedro y aletas, dos
 * motores con toberas brillantes y luces de navegación. Cabe en la envolvente medida del boceto
 * (nariz, envergadura y cola de `shipSpec`). Mira hacia -Z.
 */
export function Ship({ thrust }: { thrust?: MutableRefObject<{ thrust: number }> }) {
  const { fuselage, wing, fin, nacelle, hull, wingMat, dark, glass } = useShipAssets()
  const glows = useRef<(MeshBasicMaterial | null)[]>([])
  const strobe = useRef<MeshBasicMaterial | null>(null)
  const glowBase = useMemo(() => new Color(GLOW), [])

  useFrame((state) => {
    const k = thrust?.current.thrust ?? 0.3
    for (const g of glows.current) g?.color.copy(glowBase).multiplyScalar(0.45 + 1.6 * k)
    if (strobe.current) strobe.current.opacity = state.clock.elapsedTime % 1.3 < 0.06 ? 1 : 0
  })

  const engineLen = SHIP.tailZ - SHIP.engineZ
  return (
    <group>
      <mesh geometry={fuselage} material={hull} />
      {/* Lomo: una costilla baja del mismo casco, detrás de la cabina */}
      <mesh position={[0, R_BODY * 0.5, (SHIP.engineZ + SHIP.shoulderZ) * 0.5 + 0.55]} scale={[R_BODY * 0.22, 0.09, (SHIP.engineZ - SHIP.shoulderZ) * 0.34]} material={hull}>
        <sphereGeometry args={[1, 16, 10]} />
      </mesh>
      {/* Cabina: vidrio oscuro con reflejo y marco */}
      <mesh position={[0, R_BODY * 0.48, SHIP.shoulderZ + 0.15]} scale={[R_BODY * 0.5, R_BODY * 0.34, 0.85]} material={glass}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, R_BODY * 0.48, SHIP.shoulderZ + 0.15]} scale={[R_BODY * 0.52, R_BODY * 0.52, 0.87]} rotation={[Math.PI / 2, 0, 0]} material={dark}>
        <torusGeometry args={[1, 0.035, 6, 32, Math.PI]} />
      </mesh>

      {[1, -1].map((side) => (
        <group key={side} scale={[side, 1, 1]}>
          <group rotation={[0, 0, DIHEDRAL]}>
            <mesh geometry={wing} material={wingMat} />
            {/* Borde de ataque luminoso */}
            <mesh position={[(LE.x0 + LE.x1) / 2, 0.02, (LE.z0 + LE.z1) / 2]} rotation={[0, -LE_ANGLE, 0]}>
              <boxGeometry args={[LE_LEN, 0.018, 0.035]} />
              <meshBasicMaterial color={ACCENT} toneMapped={false} />
            </mesh>
            {/* Aleta de punta, inclinada hacia afuera */}
            <mesh geometry={fin} material={hull} position={[SHIP.tipX - 0.05, 0.02, SHIP.tipZ + 0.04]} rotation={[0, Math.PI / 2, -0.35]} />
            {/* Luz de navegación: roja a babor (izquierda), verde a estribor (derecha) */}
            <mesh position={[SHIP.tipX + 0.06, 0.36, SHIP.tipZ - 0.06]}>
              <sphereGeometry args={[0.055, 10, 8]} />
              <meshBasicMaterial color={side > 0 ? '#4ade80' : '#f87171'} toneMapped={false} />
            </mesh>
          </group>
          {/* Góndola del motor */}
          <mesh geometry={nacelle} material={hull} position={[NACELLE_X, -0.06, (NACELLE_FRONT + SHIP.tailZ) / 2]} />
          <mesh position={[NACELLE_X, -0.06, NACELLE_FRONT]} rotation={[Math.PI / 2, 0, 0]} material={dark}>
            <torusGeometry args={[NACELLE_R * 0.92, 0.04, 8, 24]} />
          </mesh>
          {/* Tobera y núcleo brillante */}
          <mesh position={[NACELLE_X, -0.06, SHIP.tailZ + 0.06]} rotation={[Math.PI / 2, 0, 0]} material={dark}>
            <cylinderGeometry args={[NACELLE_R * 1.02, NACELLE_R * 0.86, 0.16, 24, 1, true]} />
          </mesh>
          <mesh position={[NACELLE_X, -0.06, SHIP.tailZ + 0.11]}>
            <circleGeometry args={[NACELLE_R * 0.8, 24]} />
            <meshBasicMaterial
              ref={(m) => {
                glows.current[side > 0 ? 1 : 0] = m
              }}
              color={GLOW}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Bloque de motor central (el del boceto), entre las góndolas */}
      <mesh position={[0, -0.08, SHIP.engineZ + engineLen / 2]} material={wingMat}>
        <boxGeometry args={[NACELLE_X * 1.2, 0.3, engineLen + 0.2]} />
      </mesh>
      {/* Luz estroboscópica blanca de cola */}
      <mesh position={[0, 0.3, SHIP.tailZ - 0.05]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshBasicMaterial ref={(m) => void (strobe.current = m)} color="#ffffff" transparent opacity={0} toneMapped={false} />
      </mesh>
    </group>
  )
}
