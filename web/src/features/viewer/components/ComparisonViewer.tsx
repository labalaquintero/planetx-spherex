import { useEffect, useState, type KeyboardEvent } from 'react';
import type { ComparisonResponse } from '../types.ts';
import { WISE_0855 } from '../preparedTarget.ts';
import { FrameImage } from './FrameImage.tsx';
import { ImageDivider } from './ImageDivider.tsx';
import { ProvenancePanel } from './ProvenancePanel.tsx';

interface ComparisonViewerProps {
  data: ComparisonResponse;
}

const PLAY_INTERVAL_MS = 1500;

const VIEWS = [
  ['parallel', 'Lado a lado'],
  ['alternate', 'Alternar'],
  ['slide', 'Deslizar'],
] as const;
type View = typeof VIEWS[number][0];

const dateFormat = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
});
const epochLetter = (index: number) => String.fromCharCode(65 + index);

export function ComparisonViewer({ data }: ComparisonViewerProps) {
  const [prevData, setPrevData] = useState(data);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [view, setView] = useState<View>(data.frames.length === 2 ? 'parallel' : 'alternate');

  if (prevData !== data) {
    setPrevData(data);
    setCurrentIndex(0);
    setIsPlaying(false);
    setView(data.frames.length === 2 ? 'parallel' : 'alternate');
  }

  const frames = data.frames;
  const canPlay = frames.length >= 2;
  const hasPair = frames.length === 2;

  useEffect(() => {
    if (!isPlaying || !canPlay) return;
    const timer = setInterval(() => {
      setCurrentIndex((previous) => (previous + 1) % frames.length);
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isPlaying, canPlay, frames.length]);

  function step(direction: number) {
    setIsPlaying(false);
    setCurrentIndex((previous) => (previous + direction + frames.length) % frames.length);
  }

  function togglePlay() {
    if (!isPlaying) setView('alternate');
    setIsPlaying(!isPlaying);
  }

  function goToFrame(index: number) {
    setIsPlaying(false);
    setCurrentIndex(index);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget || !canPlay) return;
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        step(-1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        step(1);
        break;
      case ' ':
        event.preventDefault();
        togglePlay();
        break;
    }
  }

  const currentFrame = frames[currentIndex];
  if (!currentFrame) return null;
  const isWise = data.query.ra_deg === Number(WISE_0855.ra) && data.query.dec_deg === Number(WISE_0855.dec);
  const currentLabel = `Época ${epochLetter(currentIndex)} — ${currentIndex + 1} de ${frames.length}`;

  return (
    <div
      className="comparison-viewer"
      role="region"
      aria-label="Comparador de épocas"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-testid="comparison-viewer"
    >
      <section className="viewer-board">
        <header className="viewer-heading">
          <div>
            <h2>{isWise ? 'Campo de WISE 0855' : 'Comparación de épocas'}</h2>
            <p>{canPlay ? `${frames.length} épocas de observación` : 'Una época de observación'}</p>
          </div>
          {hasPair && (
            <div className="viewer-modes" role="group" aria-label="Vista de comparación">
              {VIEWS.map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={mode === view}
                  onClick={() => {
                    setView(mode);
                    setIsPlaying(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="viewer-display">
          {hasPair && view === 'parallel' ? (
            <div className="viewer-pair">
              {frames.map((frame, index) => (
                <div key={frame.id} className="epoch-card" data-selected={index === currentIndex || undefined}>
                  <div className="epoch-caption">
                    <span>{epochLetter(index)}</span>
                    <time dateTime={frame.observed_at}>{dateFormat.format(new Date(frame.observed_at))}</time>
                  </div>
                  <FrameImage frame={frame} mode={data.mode} label={`Época ${epochLetter(index)}`} />
                </div>
              ))}
            </div>
          ) : hasPair && view === 'slide' ? (
            <div className="viewer-single">
              <ImageDivider
                label="Divisor entre las dos épocas"
                before={<FrameImage frame={frames[0]} mode={data.mode} label="Época A" />}
                after={<FrameImage frame={frames[1]} mode={data.mode} label="Época B" />}
              />
            </div>
          ) : (
            <div className="viewer-single">
              <FrameImage key={currentFrame.id} frame={currentFrame} mode={data.mode} label={currentLabel} />
            </div>
          )}
        </div>

        <div className="viewer-timeline">
          <div className="timeline-heading">
            <div>
              {canPlay && <h3>Línea de tiempo</h3>}
              <p className="viewer-frame-info" aria-live={isPlaying ? 'off' : 'polite'}>{currentLabel}</p>
            </div>
            {canPlay && (
              <div className="viewer-controls" role="group" aria-label="Controles de reproducción">
                <button type="button" onClick={() => step(-1)} aria-label="Época anterior" data-testid="btn-prev">←</button>
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pausar reproducción' : 'Reproducir secuencia'}
                  data-testid="btn-play"
                >
                  {isPlaying ? 'Pausa' : 'Reproducir'}
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Época siguiente" data-testid="btn-next">→</button>
              </div>
            )}
          </div>
          {canPlay && (
            <>
              <input
                type="range"
                className="epoch-range"
                aria-label="Posición en la línea de tiempo"
                aria-valuetext={currentLabel}
                min={0}
                max={frames.length - 1}
                value={currentIndex}
                onChange={(event) => goToFrame(event.currentTarget.valueAsNumber)}
              />
              <div className="viewer-epochs">
                {frames.map((frame, index) => (
                  <button
                    key={frame.id}
                    type="button"
                    aria-label={`Mostrar época ${epochLetter(index)}`}
                    aria-pressed={index === currentIndex}
                    data-testid={`btn-epoch-${epochLetter(index).toLowerCase()}`}
                    onClick={() => goToFrame(index)}
                  >
                    <span>{epochLetter(index)}</span>
                    <time dateTime={frame.observed_at}>{dateFormat.format(new Date(frame.observed_at))}</time>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
      <ProvenancePanel data={data} currentIndex={currentIndex} />
    </div>
  );
}
