import type { ObjectInfo } from '../engine/types'

interface Props {
  info: ObjectInfo
}

/** Contexto del objeto cercano: qué es, datos generales y la imagen de referencia de la que parte. */
export function InfoCard({ info }: Props) {
  return (
    <div className="ex-info">
      <p className="ex-info-title">{info.title}</p>
      <p className="ex-info-summary">{info.summary}</p>
      {info.facts.length > 0 && (
        <ul className="ex-info-facts">
          {info.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      {info.images.length > 0 && (
        <div className="ex-info-images" data-count={info.images.length}>
          {info.images.map((img) => (
            <figure key={img.caption} className="ex-info-figure">
              <img src={img.src} alt={img.caption} data-pixelated={img.pixelated || undefined} loading="lazy" draggable={false} />
              <figcaption>{img.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {info.credit && <p className="ex-info-credit">{info.credit}</p>}
    </div>
  )
}
