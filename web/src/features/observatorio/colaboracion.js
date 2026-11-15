import { articles, featuredObservation } from './datos.js';
import { readWorkspace } from './workspace.js';

const endpoint = '/api/v1/workspace';
const sharedViews = new Set(['acceso', 'perfil', 'ajustes', 'publico', 'ficha', 'confirmacion', 'administracion', 'blog', 'articulo', 'imagen']);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const pendingMarks = new Map();

export let sharedPage = { enabled: false, account: null };

export function setSharedPage(page) {
  if (sharedPage.account?.id !== page.account?.id) pendingMarks.clear();
  sharedPage = page;
}

export function loadForView(view, id, params) {
  if (!sharedViews.has(view) || params.get('local') === '1') return false;
  if (view === 'imagen') {
    const reportId = params.get('ficha');
    return Boolean(reportId && reportId !== featuredObservation.id && !localReport(reportId));
  }
  if (view === 'confirmacion') return !localReport(id);
  if (view === 'articulo') return !localReport(id) && !articles.some((article) => article.id === id);
  return true;
}

export async function sharedRequest(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(endpoint + path, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? undefined : {
      'Content-Type': 'application/json',
      'X-PlanetX-Workspace': '1',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (response.status === 204) return undefined;
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.error?.message ?? 'No se pudo comunicar con el espacio compartido.');
    error.status = response.status;
    error.code = result?.error?.code;
    throw error;
  }
  if (result === null) throw new Error('El espacio compartido devolvió una respuesta inesperada.');
  return result;
}

export function canReview(account) {
  return account?.role === 'reviewer' || account?.role === 'admin';
}

function localReport(id) {
  return readWorkspace().reports.find((report) => report.id === id);
}

async function sharedReport(id, signal) {
  if (!uuid.test(id ?? '') || localReport(id)) return undefined;
  try {
    return await sharedRequest(`/reports/${id}`, { signal });
  } catch (error) {
    if (error.status === 404) return undefined;
    throw error;
  }
}

export async function readSharedPage(view, id, params, signal) {
  let session;
  try {
    session = await sharedRequest('/session', { signal });
  } catch (error) {
    if (error.status === 404) return { enabled: false, account: null };
    throw error;
  }
  const account = session.account;
  const page = { enabled: true, account };
  if (view === 'blog') {
    const offset = Math.min(1000000, Math.max(0, Number.parseInt(params.get('pagina'), 10) || 0)) * 30;
    page.publications = await sharedRequest(`/publications?offset=${offset}`, { signal });
  } else if (view === 'perfil' && account) {
    page.reports = await sharedRequest('/reports', { signal });
  } else if (view === 'publico' && uuid.test(id ?? '')) {
    try {
      page.publicProfile = await sharedRequest(`/profiles/${id}`, { signal });
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  } else if (view === 'administracion' && canReview(account)) {
    page.reports = await sharedRequest('/review', { signal });
    page.report = await sharedReport(id || page.reports[0]?.id, signal);
  } else if (['ficha', 'confirmacion', 'articulo', 'imagen'].includes(view)) {
    const reportId = view === 'ficha' ? params.get('borrador') : view === 'imagen' ? params.get('ficha') : id;
    page.report = await sharedReport(reportId, signal);
  }
  return page;
}

export function reportById(id) {
  if (!id) return undefined;
  const report = sharedPage.report;
  if (report?.id !== id) return localReport(id);
  const pending = pendingMarks.get(id);
  return report.mine && pending?.revision === report.revision
    ? { ...report, annotations: pending.annotations }
    : report;
}

export function stageSharedMarks(report, frameId, marks) {
  pendingMarks.set(report.id, {
    revision: report.revision,
    annotations: { ...reportById(report.id).annotations, [frameId]: marks },
  });
}

export function clearSharedMarks(id) {
  pendingMarks.delete(id);
}

export function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
