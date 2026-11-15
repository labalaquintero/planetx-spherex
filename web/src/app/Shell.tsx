import { lazy, Suspense, useState } from 'react';
import App from '../App.tsx';
import { SiteMenu, type Section } from './SiteMenu.tsx';
import './shell.css';

// Explorar (y three) se cargan solo al abrir la sección: el visor no pesa más por esto.
const Explorar = lazy(() => import('../features/explorar/index.ts').then((m) => ({ default: m.Explorar })));

/**
 * Envoltorio de la aplicación: añade el menú de secciones sin cambiar el visor. «Inicio» muestra
 * el visor tal cual (App); «Explorar» muestra la pantalla de selección de sector.
 */
export function Shell() {
  const [section, setSection] = useState<Section>('inicio');

  if (section === 'inicio') {
    return (
      <>
        <div className="px-shell-float">
          <SiteMenu current={section} onNavigate={setSection} />
        </div>
        <App />
      </>
    );
  }

  return (
    <div className="px-shell">
      <header className="px-shell-bar">
        <span className="px-shell-badge">Planet X / SPHEREx</span>
        <h1 className="px-shell-title">Explorar</h1>
        <SiteMenu current={section} onNavigate={setSection} />
      </header>
      <main className="px-shell-main">
        <Suspense fallback={<p className="px-shell-loading">Cargando Explorar…</p>}>
          <Explorar />
        </Suspense>
      </main>
    </div>
  );
}
