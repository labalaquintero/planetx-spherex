import { prepared, validCoordinates, validDate } from './datos.js';
import { toast } from './ui.js';

const workspaceKey = 'planet-x-prototipo-v1';
const recentLimit = 12;
const initialProfile = { alias: 'Explorador', active: false, public: false, paused: false, avatar: '' };
let workspace = { profile: initialProfile, recent: [], reports: [], annotations: {} };
let memoryOnly = false;

export function isEditableReport(report) {
  return report?.status === 'draft' || report?.status === 'rejected';
}

function recentEntries(recent) {
  if (typeof recent === 'string' && validDate(recent)) {
    return [{ viewedAt: recent, query: prepared.query, mode: 'prepared' }];
  }
  const list = Array.isArray(recent) ? recent : recent ? [recent] : [];
  return list.filter((entry) => validDate(entry?.viewedAt)
    && validCoordinates(entry.query?.ra_deg, entry.query?.dec_deg)).slice(0, recentLimit);
}

export function readWorkspace() {
  if (!memoryOnly) {
    try {
      const saved = JSON.parse(localStorage.getItem(workspaceKey));
      if (saved?.profile && Array.isArray(saved.reports) && saved.annotations) {
        workspace = {
          profile: { ...initialProfile, ...saved.profile },
          reports: saved.reports.filter((report) => report && !report.example),
          annotations: saved.annotations,
          recent: recentEntries(saved.recent),
        };
      }
    } catch {
      // A failed read preserves the copy already available in memory.
    }
  }
  return structuredClone(workspace);
}

export function writeWorkspace(state) {
  workspace = state;
  try {
    localStorage.setItem(workspaceKey, JSON.stringify(state));
    memoryOnly = false;
  } catch {
    if (!memoryOnly) toast('El navegador no pudo guardar los cambios. Puedes seguir usándolos durante esta visita.');
    memoryOnly = true;
  }
}

export function rememberComparison(data) {
  const state = readWorkspace();
  const old = state.recent.filter(({ query }) => query.ra_deg !== data.query.ra_deg || query.dec_deg !== data.query.dec_deg);
  state.recent = [{ viewedAt: new Date().toISOString(), query: data.query, mode: data.mode, comparison: data },
    ...old].slice(0, recentLimit);
  writeWorkspace(state);
}

function evidenceStore(name, mode, operation) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('planet-x-report-files', 2);
    request.onupgradeneeded = () => {
      for (const store of ['pdf', 'images']) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      try {
        const transaction = database.transaction(name, mode);
        const result = operation(transaction.objectStore(name));
        transaction.oncomplete = () => {
          database.close();
          resolve(result?.result);
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error('Archivo no disponible.'));
        };
      } catch (error) {
        database.close();
        reject(error);
      }
    };
  });
}

export function reportFile(mode, operation) {
  return evidenceStore('pdf', mode, operation);
}

export async function cacheImages(frames) {
  const files = await Promise.all(frames.map(async (frame) => {
    if (!frame.image_url) return null;
    try {
      const existing = await evidenceStore('images', 'readonly', (store) => store.get(frame.id));
      if (existing instanceof Blob) return null;
      const response = await fetch(frame.image_url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'image/png') return null;
      return { id: frame.id, blob: await response.blob() };
    } catch {
      return null;
    }
  }));
  const state = readWorkspace();
  const kept = new Set([...state.recent, ...state.reports]
    .flatMap(({ comparison }) => comparison?.frames.map(({ id }) => id) ?? []));
  try {
    await evidenceStore('images', 'readwrite', (store) => {
      for (const entry of files) {
        if (entry?.blob.size && kept.has(entry.id)) store.put(entry.blob, entry.id);
      }
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        for (const id of keys.result) {
          if (!kept.has(id)) store.delete(id);
        }
      };
    });
  } catch {
    // The original image URLs and provenance stay available if local storage cannot be used.
  }
}

const restoredImages = new Map();

export function bindEvidenceImages(scope) {
  for (const [image, url] of restoredImages) {
    if (!image.isConnected) {
      URL.revokeObjectURL(url);
      restoredImages.delete(image);
    }
  }
  scope.querySelectorAll('img[data-frame-id]:not([data-frame-bound])').forEach((image) => {
    image.dataset.frameBound = 'true';
    function showError() {
      const place = image.closest('.frame-image-link, .wipe-surface, .zoom-layer, figure');
      const notice = place?.querySelector('.image-error');
      if (notice) notice.hidden = false;
      image.style.visibility = 'hidden';
    }
    async function restore() {
      const file = await evidenceStore('images', 'readonly', (store) => store.get(image.dataset.frameId)).catch(() => null);
      if (!image.isConnected) return;
      if (!(file instanceof Blob)) {
        showError();
        return;
      }
      const url = URL.createObjectURL(file);
      restoredImages.set(image, url);
      image.addEventListener('error', showError, { once: true });
      image.src = url;
    }
    image.addEventListener('error', restore, { once: true });
    if (image.complete && !image.naturalWidth) {
      image.removeEventListener('error', restore);
      void restore();
    }
  });
}
