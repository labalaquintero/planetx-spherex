import { useState, type CSSProperties, type ReactNode } from 'react';

interface ImageDividerProps {
  before: ReactNode;
  after: ReactNode;
  label: string;
}

export function ImageDivider({ before, after, label }: ImageDividerProps) {
  const [position, setPosition] = useState(50);

  return (
    <div className="image-divider" style={{ '--division': `${position}%` } as CSSProperties}>
      <div className="image-divider-layer">{before}</div>
      <div className="image-divider-layer image-divider-after">{after}</div>
      <span className="image-divider-handle" aria-hidden="true"><span>↔</span></span>
      <input
        type="range"
        className="image-divider-input"
        aria-label={label}
        aria-valuetext={`${position}% de la primera época`}
        min={0}
        max={100}
        value={position}
        onChange={(event) => setPosition(event.currentTarget.valueAsNumber)}
      />
    </div>
  );
}
