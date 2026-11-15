export function frameMarks(annotations, frameId) {
  const marks = annotations?.[frameId];
  if (!Array.isArray(marks)) return [];
  return marks.filter((mark) => (
    (mark?.type === 'draw' || mark?.type === 'crop')
    && Array.isArray(mark.points) && mark.points.length >= 2
    && mark.points.every((point) => Array.isArray(point) && point.length === 2
      && point.every((axis) => Number.isFinite(axis) && axis >= 0 && axis <= 1))
  ));
}

function boundsOf(points) {
  const [x1, y1] = points[0];
  const [x2, y2] = points.at(-1);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x1 - x2), height: Math.abs(y1 - y2) };
}

export function lastMarkedArea(marks) {
  const mark = marks.findLast(({ type }) => type === 'crop');
  if (!mark) return null;
  const area = boundsOf(mark.points);
  return area.width > 0 && area.height > 0 ? area : null;
}

export function paintMarks(context, marks, size = context.canvas.width) {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const { type, points } of marks) {
    context.beginPath();
    if (type === 'crop') {
      const area = boundsOf(points);
      context.rect(area.x * size, area.y * size, area.width * size, area.height * size);
    } else {
      const [[x, y], ...rest] = points;
      context.moveTo(x * size, y * size);
      for (const [nextX, nextY] of rest) context.lineTo(nextX * size, nextY * size);
    }
    context.setLineDash(type === 'crop' ? [10, 6] : []);
    context.lineWidth = 9;
    context.strokeStyle = '#080c15';
    context.stroke();
    context.lineWidth = 5;
    context.strokeStyle = type === 'crop' ? '#b8d4f2' : '#ffd392';
    context.stroke();
  }
  context.restore();
}

function paintArea(canvas, image, marks, area) {
  const context = canvas.getContext('2d');
  if (!context) return false;
  const scale = canvas.width / Math.max(area.width, area.height);
  const width = area.width * scale;
  const height = area.height * scale;
  const left = (canvas.width - width) / 2;
  const top = (canvas.height - height) / 2;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, area.x * image.naturalWidth, area.y * image.naturalHeight,
    area.width * image.naturalWidth, area.height * image.naturalHeight, left, top, width, height);
  context.save();
  context.beginPath();
  context.rect(left, top, width, height);
  context.clip();
  context.translate(left - area.x * scale, top - area.y * scale);
  paintMarks(context, marks, scale);
  context.restore();
  return true;
}

export function bindReportAnnotations(section) {
  for (const frame of section.querySelectorAll('[data-report-marks]')) {
    const marks = JSON.parse(frame.dataset.reportMarks);
    const image = frame.querySelector('img');
    const overlay = frame.querySelector('.report-overlay');
    const detail = frame.querySelector('.report-crop');
    const area = lastMarkedArea(marks);
    function render() {
      const context = overlay.getContext('2d');
      if (context) {
        context.clearRect(0, 0, overlay.width, overlay.height);
        paintMarks(context, marks);
        overlay.hidden = false;
      }
      if (detail && area && paintArea(detail.querySelector('canvas'), image, marks, area)) detail.hidden = false;
    }
    image.addEventListener('load', render);
    if (image.complete && image.naturalWidth) render();
  }
}
