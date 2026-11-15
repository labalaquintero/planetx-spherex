import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, EMPTY_LOG, logKey, parseLog, record, type Logbook } from './logbook'

const TOTALS = { bodies: 30, crossable: 2 }
const ids = Array.from({ length: 30 }, (_, i) => `p${i}`)

describe('bitácora de exploración', () => {
  it('descubrir un planeta lo anota una vez y da el primer logro', () => {
    const r = record(EMPTY_LOG, 'discovered', 'p0', TOTALS)
    expect(r.isNew).toBe(true)
    expect(r.log.discovered).toEqual(['p0'])
    expect(r.unlocked.map((a) => a.id)).toEqual(['primer-hallazgo'])
    const again = record(r.log, 'discovered', 'p0', TOTALS)
    expect(again.isNew).toBe(false)
    expect(again.log).toBe(r.log)
    expect(again.unlocked).toEqual([])
  })

  it('escanear o atravesar también descubre', () => {
    const r = record(EMPTY_LOG, 'scanned', 'p3', TOTALS)
    expect(r.log.discovered).toContain('p3')
    expect(r.unlocked.map((a) => a.id)).toEqual(['primer-hallazgo', 'primer-escaneo'])
    const c = record(EMPTY_LOG, 'crossed', 'p4', TOTALS)
    expect(c.log.discovered).toContain('p4')
    expect(c.unlocked.map((a) => a.id)).toContain('atravesar')
  })

  it('los logros de cantidad llegan en su momento y una sola vez', () => {
    let log: Logbook = EMPTY_LOG
    const got: string[] = []
    for (const id of ids) {
      const r = record(log, 'discovered', id, TOTALS)
      log = r.log
      got.push(...r.unlocked.map((a) => a.id))
    }
    expect(got).toEqual(['primer-hallazgo', 'explorador', 'veterano', 'cartografo'])
    expect(new Set(log.achievements).size).toBe(log.achievements.length)
  })

  it('«Los dos gigantes» pide atravesar todos los atravesables', () => {
    let log = record(EMPTY_LOG, 'crossed', 'cobalto', TOTALS).log
    expect(log.achievements).not.toContain('dos-gigantes')
    log = record(log, 'crossed', 'calder', TOTALS).log
    expect(log.achievements).toContain('dos-gigantes')
  })

  it('cada logro tiene título y descripción', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(3)
      expect(a.description.length).toBeGreaterThan(8)
    }
  })

  it('lee lo guardado con cuidado: ids desconocidos, duplicados o JSON roto no rompen nada', () => {
    const saved = JSON.stringify({ discovered: ['p1', 'p1', 'raro', 5], scanned: ['p2'], crossed: 'no', achievements: ['primer-hallazgo', 'inventado'] })
    expect(parseLog(saved, ids)).toEqual({ discovered: ['p1'], scanned: ['p2'], crossed: [], achievements: ['primer-hallazgo'] })
    expect(parseLog('{roto', ids)).toEqual(EMPTY_LOG)
    expect(parseLog(null, ids)).toEqual(EMPTY_LOG)
    expect(logKey('beta')).toBe('planetx-explorar-bitacora-v1-beta')
  })
})
