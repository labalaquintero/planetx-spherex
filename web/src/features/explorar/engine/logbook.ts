/**
 * Bitácora de exploración (lógica pura y probada): qué planetas se descubrieron (acercándose), cuáles se
 * escanearon, cuáles se atravesaron, y los logros. La pantalla la guarda en el navegador por sector.
 */
export interface Logbook {
  readonly discovered: readonly string[]
  readonly scanned: readonly string[]
  readonly crossed: readonly string[]
  readonly achievements: readonly string[]
}

export const EMPTY_LOG: Logbook = { discovered: [], scanned: [], crossed: [], achievements: [] }

export type LogKind = 'discovered' | 'scanned' | 'crossed'

/** Totales del sector para los logros: cuerpos con nombre y planetas atravesables. */
export interface LogTotals {
  readonly bodies: number
  readonly crossable: number
}

export interface Achievement {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly reached: (log: Logbook, totals: LogTotals) => boolean
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'primer-hallazgo', title: 'Primer hallazgo', description: 'Descubre tu primer planeta.', reached: (l) => l.discovered.length >= 1 },
  { id: 'explorador', title: 'Explorador', description: 'Descubre 10 planetas.', reached: (l) => l.discovered.length >= 10 },
  { id: 'veterano', title: 'Veterano del sector', description: 'Descubre 20 planetas.', reached: (l) => l.discovered.length >= 20 },
  { id: 'cartografo', title: 'Cartógrafo', description: 'Descubre todos los planetas del sector.', reached: (l, t) => t.bodies > 0 && l.discovered.length >= t.bodies },
  { id: 'primer-escaneo', title: 'Primer escaneo', description: 'Escanea un planeta con R.', reached: (l) => l.scanned.length >= 1 },
  { id: 'cientifico', title: 'Científico', description: 'Escanea 10 planetas.', reached: (l) => l.scanned.length >= 10 },
  { id: 'atravesar', title: 'A través de las nubes', description: 'Atraviesa un gigante gaseoso con turbo.', reached: (l) => l.crossed.length >= 1 },
  { id: 'dos-gigantes', title: 'Los dos gigantes', description: 'Atraviesa todos los gigantes gaseosos del sector.', reached: (l, t) => t.crossable > 0 && l.crossed.length >= t.crossable },
]

/**
 * Anota un hecho. Devuelve la bitácora nueva, si el hecho era nuevo y los logros que se acaban de
 * conseguir (en orden). Repetir un hecho no cambia nada.
 */
export function record(log: Logbook, kind: LogKind, id: string, totals: LogTotals): { log: Logbook; isNew: boolean; unlocked: Achievement[] } {
  if (log[kind].includes(id)) return { log, isNew: false, unlocked: [] }
  let next: Logbook = { ...log, [kind]: [...log[kind], id] }
  // Escanear o atravesar un planeta también lo descubre.
  if (kind !== 'discovered' && !next.discovered.includes(id)) next = { ...next, discovered: [...next.discovered, id] }
  const unlocked = ACHIEVEMENTS.filter((a) => !next.achievements.includes(a.id) && a.reached(next, totals))
  if (unlocked.length) next = { ...next, achievements: [...next.achievements, ...unlocked.map((a) => a.id)] }
  return { log: next, isNew: true, unlocked }
}

/** Lee una bitácora guardada; cualquier cosa rara vuelve a la vacía (y solo con ids conocidos). */
export function parseLog(raw: string | null, knownIds: readonly string[]): Logbook {
  if (!raw) return EMPTY_LOG
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof Logbook, unknown>>
    const known = new Set(knownIds)
    const ach = new Set(ACHIEVEMENTS.map((a) => a.id))
    const list = (x: unknown, ok: Set<string>) => (Array.isArray(x) ? [...new Set(x.filter((s): s is string => typeof s === 'string' && ok.has(s)))] : [])
    return {
      discovered: list(v.discovered, known),
      scanned: list(v.scanned, known),
      crossed: list(v.crossed, known),
      achievements: list(v.achievements, ach),
    }
  } catch {
    return EMPTY_LOG
  }
}

/** Clave de guardado por sector. */
export const logKey = (sectorId: string) => `planetx-explorar-bitacora-v1-${sectorId}`
