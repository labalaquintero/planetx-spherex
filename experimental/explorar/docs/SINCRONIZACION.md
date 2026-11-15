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
