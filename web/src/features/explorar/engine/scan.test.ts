import { describe, expect, it } from 'vitest'
import beta from '../sectors/beta'
import { canScan, dragTurn, relaxTurn, SCAN_MS, scanProgress, scanReadout, scanStage, STILL, TURN } from './scan'

const objects = beta.scene!.objects

describe('escaneo de planetas', () => {
  it('todos los planetas, planetas con anillo y lunas con nombre de β se pueden escanear', () => {
    const named = objects.filter((o) => o.label && o.kind !== 'smallBody')
    expect(named.length).toBeGreaterThan(20)
    for (const o of named) expect(canScan(o), o.id).toBe(true)
  })

  it('las rocas sin nombre y la ausencia de objeto no se escanean', () => {
    for (const o of objects.filter((x) => x.kind === 'smallBody')) expect(canScan(o), o.id).toBe(false)
    expect(canScan(undefined)).toBe(false)
  })

  it('el barrido avanza sin saltos y termina en SCAN_MS', () => {
    expect(scanProgress(0)).toBe(0)
    expect(scanProgress(SCAN_MS)).toBe(1)
    let prev = 0
    for (let ms = 50; ms <= SCAN_MS; ms += 50) {
      const p = scanProgress(ms)
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
    expect(scanStage(0.1)).not.toBe(scanStage(0.5))
    expect(scanStage(1)).toBe('Escaneo completo')
  })

  it('la lectura tiene tipo, diámetro, distancia, superficie, atmósfera, anillo y mapa de origen', () => {
    for (const o of objects.filter((x) => canScan(x))) {
      const rows = scanReadout(o, 87.4)
      expect(rows.map((r) => r.label)).toEqual(['Tipo', 'Diámetro', 'Distancia', 'Superficie', 'Atmósfera', 'Anillo', 'Mapa de origen'])
      expect(rows.find((r) => r.label === 'Distancia')!.value).toBe('87 u')
      expect(rows.find((r) => r.label === 'Diámetro')!.value).toBe(`${Math.round(o.radius * 2)} u`)
      if (o.ring) expect(rows.find((r) => r.label === 'Anillo')!.value).toBe('Sí')
    }
  })

  it('la lectura no habla de vida ni de seres: solo de forma, superficie y atmósfera', () => {
    for (const o of objects.filter((x) => canScan(x))) {
      const text = scanReadout(o, 50).map((r) => `${r.label} ${r.value}`).join(' ')
      expect(text, o.id).not.toMatch(/alien|extraterrest|criatur|habitant|vida|inventad/i)
    }
  })
})

describe('giro del modelo escaneado', () => {
  it('arrastrar gira con el puntero y deja inercia', () => {
    const r = dragTurn(100, -50, 1 / 60)
    expect(r.yaw).toBeCloseTo(100 * TURN.sensitivity)
    expect(r.pitch).toBeCloseTo(-50 * TURN.sensitivity)
    expect(r.turn.idle).toBe(0)
    expect(Math.abs(r.turn.vy)).toBeGreaterThan(0)
    // Un arrastre muy rápido no lo deja girando como un trompo.
    expect(Math.abs(dragTurn(2000, 0, 1 / 60).turn.vy)).toBeLessThanOrEqual(TURN.maxSpin)
  })

  it('al soltar, la inercia se apaga y después vuelve el giro automático lento', () => {
    let t = dragTurn(200, 0, 1 / 60).turn
    let last = Infinity
    for (let i = 0; i < 60; i++) {
      const r = relaxTurn(t, 1 / 60)
      t = r.turn
      expect(Math.abs(t.vy)).toBeLessThan(last)
      last = Math.abs(t.vy)
    }
    expect(relaxTurn(t, 1 / 60).yaw).toBeLessThan(0.01)
    // Quieto más de autoAfter: gira solo, despacio.
    const idle = relaxTurn({ ...STILL, vy: 0 }, 1 / 60)
    expect(idle.yaw).toBeCloseTo(TURN.auto / 60)
  })
})
