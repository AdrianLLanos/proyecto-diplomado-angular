# API dentro de Netlify

La API Express se ejecuta como una Netlify Function en `/api/*`; ya no requiere Render.

En Netlify abre **Site configuration > Environment variables** y crea estas variables de producción:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión de Supabase. |
| `JWT_SECRET` | Secreto privado y largo para firmar sesiones. |
| `NODE_ENV` | `production` |
| `APP_URL` | `https://proyecto-diplomado-angular.netlify.app` |
| `ALLOWED_ORIGINS` | `https://proyecto-diplomado-angular.netlify.app` |

En **Build settings** usa los valores del archivo `netlify.toml`: base directory vacío, build command `npm run build`, publish directory `frontend/dist/clinica/browser` y functions directory `frontend/netlify/functions`. Después ejecuta **Deploys > Trigger deploy > Clear cache and deploy site**.

La comprobación final es abrir `/api/health`; debe devolver `{ "ok": true }`.
