# Sincronización: `experimental/explorar` ↔ `web/src/features/explorar`

## Decisión

- **`experimental/explorar/` es la copia canónica.** Los colaboradores trabajan **solo ahí**: sectores,
  herramientas y referencias.
- **Nadie edita `web/src/features/explorar/` mientras tanto.** Esa carpeta queda congelada en la versión que
  ya está en el visor.
- **Isaac hace una única sincronización al final**, cuando todos los sectores estén listos, y después el
  redeploy a AWS.

## Contexto comprobado

1. **Hay dos copias.**
   - `experimental/explorar/` es el laboratorio: app independiente (`pnpm dev`), herramientas de medición
     (`tools/`), bocetos y referencias (`docs/`).
   - `web/src/features/explorar/` es lo que ve el usuario en el visor, desde el menú ☰ → «Explorar»
     (`web/src/app/Shell.tsx`).
2. **La copia del visor se creó una vez, a mano**, en el commit `9c8bf95` («feat(web): incorpora Explorar al
   visor en web/src/features/explorar»):
   - Se copió `experimental/explorar/src/` sin `App.tsx`, `main.tsx`, `app.css` ni `styles.test.ts`.
   - `docs/referencias/layout.json` pasó a `web/src/features/explorar/data/layout.ts`.
   - Se añadió `ATTRIBUTIONS.md` a la carpeta.
3. **No hay script ni CI que sincronice.** `.github/workflows/ci.yml` prueba cada copia por separado: el job
   `web` y el job `explorar`.
4. **Registro automático en las dos copias.** `src/sectors/index.ts` usa
   `import.meta.glob('./*/index.ts')`: una carpeta de sector nueva aparece sola.

## Sincronizaciones hechas

- **15-11-2026, rama `isaac/explorar-sync`** (a petición de Isaac, para ver la versión nueva dentro de la app
  completa): se copió `experimental/explorar/src/` a `web/src/features/explorar/` con las mismas
  exclusiones que en `9c8bf95`. Solo se adaptaron tres importaciones (`boceto.ts`, `sectors/beta/boceto.ts`
  → `data/layout`; `credits.test.ts` → `./ATTRIBUTIONS.md`). Se retiró `bandas-jupiter.webp` y se copió
  `ATTRIBUTIONS.md`. Incluye `176bd0e`, `59ee9cb` y la etapa de calidad visual de β.
- **15-11-2026, misma rama** (resincronizaciones con el mismo procedimiento; `rsync` sin `--delete` para no
  borrar el `README.md` propio de la copia del visor): dirigir con clic derecho, HUD reordenado y fichas de
  contexto, acercamiento suave e impactos, Tessa, Calder y Sora, y cometas y meteoritos (hasta `f2c2293`).
- **15-11-2026, rama `isaac/explorar-galaxia`**: selección como galaxia con regiones, β más amplio con cuatro
  planetas y estelas animadas (hasta `3367068`). `sectors/alpha/` queda fuera del `rsync`: su copia en el visor
  adapta la importación de `campo-wise0855.json` a `data/`.
- **15-11-2026, misma rama, tras fusionar #25** (copia archivo por archivo de lo que cambió, comprobando
  antes que la copia del visor era idéntica): visitantes al azar (cometas, estrellas fugaces y asteroides),
  cielo y nebulosa horneados en cubemaps, tope de píxeles y HUD que no se encima con el zoom. Además, en
  `web/src/features/observatorio/observatorio.css`, la cabecera del sitio deja de ser fija en la vista del mapa.
  Después, con el mismo procedimiento: protección contra NaN antes del bloom, anillos que se desvanecen de canto,
  HUD sin saltos de texto, β sin estación y planetas «Cielo infrarrojo» y «Vela» con imágenes de SPHEREx.
  `credits.test.ts` y `ATTRIBUTIONS.md` del visor se editaron a mano (tienen rutas propias). Luego: ficha del
  HUD estable (hueco de barra reservado y objeto cercano con histéresis), visitantes con brillo procedural y colas
  animadas, área más grande y planetas «Plano galáctico», «Burbuja» y «Polvo de Vela». Después, perfil de
  rendimiento propio de Windows (`?perfil=`), colas con movimiento y planetas «Lazos galácticos», «Nebulosa de
  Vela» y «Filamentos» con un área algo mayor.
- **15-11-2026, rama `quintero/alpha-planetas`:** primera copia del sector α al visor (hasta ahora salía como
  «Próximamente» en `web/`): `sectors/alpha/` completo, sus vistas previas y las texturas de NASA/JPL. El JSON de
  la medición va en `data/campo-wise0855.json` y `campo.ts` lo importa desde ahí (única adaptación).

## Qué habrá que portar en la sincronización final

Todo lo que cambie en `experimental/explorar/src/` desde `9c8bf95`. A hoy:

| Commit | Qué cambió en `experimental/explorar` |
| --- | --- |
| `176bd0e` (RobertoRiojas) | Objetos del boceto de β en su carpeta: `src/sectors/beta/boceto.ts` nuevo y `src/boceto.ts` reducido. También `beta/objects.ts`, `beta/composicion.test.ts` y un `README.md` por sector |
| `59ee9cb` (Isaac) | `src/sectors/sectors.test.ts`: valida todo sector con escena y marca como «Próximamente» los demás, sin ids fijos |
| (lo que venga) | Sector α, mejoras de β, sector ε… |

Para ver la lista completa en ese momento:

```bash
git log --oneline 9c8bf95..HEAD -- experimental/explorar/src experimental/explorar/docs/referencias
diff -rq experimental/explorar/src web/src/features/explorar
```

## Procedimiento de sincronización

**Pendiente de escribir** cuando llegue el momento de la sincronización final (lo escribe Isaac). Puntos
que ya se sabe que tendrá que cubrir, por lo hecho en `9c8bf95`:

- Qué no se copia (la app independiente y la prueba de CSS).
- Cómo se regenera `data/layout.ts` a partir de `layout.json`, y cualquier medición nueva de α o ε.
- Texturas nuevas: `scene/assets/`, `scene/assets.ts`, `credits.ts` y `ATTRIBUTIONS.md`.
- Comprobaciones en `web/`: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test` y `pnpm build`.
  Revisión de Santiago (CODEOWNERS).
- Redeploy a AWS.
