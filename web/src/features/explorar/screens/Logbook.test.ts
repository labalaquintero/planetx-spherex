import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import beta from '../sectors/beta'
import { canScan } from '../engine/scan'
import { EMPTY_LOG, record } from '../engine/logbook'
import { Logbook } from './Logbook'

const bodies = beta.scene!.objects.filter((o) => canScan(o))
const totals = { bodies: bodies.length, crossable: 2 }

describe('ventana de la bitácora', () => {
  it('cuenta lo descubierto, marca lo escaneado y no revela los nombres sin descubrir', () => {
    let log = record(EMPTY_LOG, 'discovered', 'cobalto', totals).log
    log = record(log, 'scanned', 'cobalto', totals).log
    log = record(log, 'crossed', 'calder', totals).log
    const html = renderToStaticMarkup(createElement(Logbook, { log, bodies, onReset: () => {} }))
    expect(html).toContain(`2/${bodies.length}`)
    expect(html).toContain('Cobalto')
    expect(html).toContain('escaneado')
    expect(html).toContain('atravesado')
    expect(html).toContain(`${bodies.length - 2} planetas sin descubrir`)
    // Un planeta no descubierto no aparece por su nombre.
    expect(html).not.toContain('Pangea')
    expect(html).toContain('Primer hallazgo')
    expect(html).toContain('A través de las nubes')
  })
})
