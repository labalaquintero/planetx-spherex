import { useMemo } from 'react'
import { ExtrudeGeometry, Shape } from 'three'

const HULL = '#c3d0e6'
const WING = '#7388bd'
const ACCENT = '#3d5bff'

/** Ala derecha barrida hacia atrás, plana y fina. En el plano XZ: el frente es -Z. */
function useWingGeometry() {
  return useMemo(() => {
    const s = new Shape()
    // (x, y) del dibujo; al acostarla, y → -Z (adelante).
    s.moveTo(0.22, 0.75)
    s.lineTo(2.0, -0.95)
    s.lineTo(2.0, -1.3)
    s.lineTo(0.22, -1.15)
    s.closePath()
    const g = new ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
}

/**
 * Nave genérica con primitivas (pocos polígonos), vista desde atrás: nariz puntiaguda,
 * alas barridas y bloque de motor. Mira hacia -Z.
 */
export function Ship() {
  const wing = useWingGeometry()
  return (
    <group>
      {/* Fuselaje: cilindro hexagonal que se afina hacia delante */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1]}>
        <cylinderGeometry args={[0.3, 0.42, 2.4, 6]} />
        <meshStandardMaterial color={HULL} flatShading metalness={0.1} roughness={0.55} />
      </mesh>
      {/* Nariz */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.7]}>
        <coneGeometry args={[0.3, 1.2, 6]} />
        <meshStandardMaterial color={ACCENT} flatShading metalness={0.1} roughness={0.5} />
      </mesh>
      {/* Alas */}
      <mesh geometry={wing} position={[0, -0.04, 0]}>
        <meshStandardMaterial color={WING} flatShading side={2} metalness={0.05} roughness={0.6} />
      </mesh>
      <mesh geometry={wing} position={[0, -0.04, 0]} scale={[-1, 1, 1]}>
        <meshStandardMaterial color={WING} flatShading side={2} metalness={0.05} roughness={0.6} />
      </mesh>
      {/* Bloque de motor */}
      <mesh position={[0, -0.02, 1.5]}>
        <boxGeometry args={[0.85, 0.6, 0.7]} />
        <meshStandardMaterial color="#5d6c8c" flatShading metalness={0.1} roughness={0.5} />
      </mesh>
      {/* Brillo de la tobera */}
      <mesh position={[0, -0.02, 1.87]}>
        <boxGeometry args={[0.62, 0.4, 0.06]} />
        <meshBasicMaterial color="#7fb2ff" toneMapped={false} />
      </mesh>
      {/* Franjas azules de las puntas de ala (como en el dibujo) */}
      <mesh position={[2.0, -0.02, 1.12]}>
        <boxGeometry args={[0.06, 0.1, 0.4]} />
        <meshBasicMaterial color={ACCENT} />
      </mesh>
      <mesh position={[-2.0, -0.02, 1.12]}>
        <boxGeometry args={[0.06, 0.1, 0.4]} />
        <meshBasicMaterial color={ACCENT} />
      </mesh>
    </group>
  )
}
