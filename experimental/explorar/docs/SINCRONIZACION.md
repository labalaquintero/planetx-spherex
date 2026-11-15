# Sincronización: `experimental/explorar` ↔ `web/src/features/explorar`

Explorar existe en dos sitios del repositorio. Este documento separa lo **comprobado** (con su fuente) de lo
**pendiente de que Isaac lo confirme**.

## Lo comprobado

1. **Hay dos copias.**
   - `experimental/explorar/` es el laboratorio: app independiente (`pnpm dev`), herramientas de medición
     (`tools/`), bocetos y referencias (`docs/`).
   - `web/src/features/explorar/` es lo que ve el usuario en el visor, desde el menú ☰ → «Explorar»
     (`web/src/app/Shell.tsx`).
2. **La copia del visor se creó una vez, a mano**, en el commit `9c8bf95` («feat(web): incorpora Explorar al
   visor en web/src/features/explorar»):
   - Se copió `experimental/explorar/src/` sin `App.tsx`, `main.tsx`, `app.css` ni `styles.test.ts`, que es
     la app independiente y la prueba de CSS que necesita `test.css: true` en Vitest.
   - `docs/referencias/layout.json` pasó a `web/src/features/explorar/data/layout.ts`, para no tocar el
     tsconfig del visor.
   - Se añadió `ATTRIBUTIONS.md` a la carpeta.
   - Así lo dice también `web/src/features/explorar/README.md` («Origen: es una copia de
     `experimental/explorar/src`…»).
3. **No hay script ni CI que sincronice las copias.** No existe en `tools/` ni en `experimental/explorar/tools/`,
   y `.github/workflows/ci.yml` prueba cada copia por separado: el job `web` y el job `explorar`.
4. **Hoy las copias ya difieren.** El commit `176bd0e` (RobertoRiojas, «objetos del boceto de β en su
   carpeta de sector y README por sector») cambió solo `experimental/`:
   - `src/boceto.ts` reducido, con `src/sectors/beta/boceto.ts` nuevo.
   - `beta/objects.ts` y `beta/composicion.test.ts`.
   - Los `README.md` por sector.

   Ese cambio no se aplicó en `web/`. Compruébalo con
   `diff -rq experimental/explorar/src web/src/features/explorar`.
5. **Registro automático en las dos copias.** `src/sectors/index.ts` usa
   `import.meta.glob('./*/index.ts')`: una carpeta de sector nueva aparece sola, sin registrarla.
6. **Recomendación escrita, no regla adoptada.** El README de `experimental/explorar` (sección «Integración en
   `web/`») recomienda: «conviene hacer los cambios de producto en `web/` y retirar
   `experimental/explorar/src` en un PR posterior».

## Pendiente de que Isaac lo confirme

- **Cuál es la copia canónica.** Ahora mismo, en la práctica, se trabaja en `experimental/explorar` (β y
  α). La recomendación del punto 6 dice lo contrario. Hay que decidir una y escribirla aquí.
- **Si se porta `176bd0e` a `web/`** para que las copias vuelvan a coincidir.
- **El procedimiento oficial para pasar un sector al visor.** Propuesta, basada en lo que se hizo en
  `9c8bf95`:
  1. Copiar `experimental/explorar/src/sectors/<id>/` a `web/src/features/explorar/sectors/<id>/`.
  2. Revisar las importaciones que apunten fuera de `src/`. En `web/` las medidas de los bocetos están en
     `data/layout.ts`, no en `docs/referencias/layout.json`.
  3. Si el sector usa texturas nuevas: copiarlas a `scene/assets/` en las dos copias y añadirlas a
     `scene/assets.ts`, `credits.ts` y `ATTRIBUTIONS.md`.
  4. Si cambió algo compartido (motor, `boceto.ts`, pruebas comunes), aplicar el mismo cambio en las dos
     copias en el mismo PR.
  5. En `web/`: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test` y `pnpm build`. En
     `experimental/explorar`: `pnpm typecheck`, `pnpm test` y `pnpm build`.
  6. El PR toca `web/`, así que Santiago revisa (CODEOWNERS).
- **Si conviene un script de sincronización** (por ejemplo, uno que copie con `rsync` y compruebe con
  `diff -rq` en CI) o retirar una de las dos copias.
