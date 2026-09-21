# Publicar la aplicación

Netlify publica el frontend Angular. El servidor Node debe publicarse aparte en Render.

1. En [Render](https://render.com), inicia sesión con GitHub y pulsa **New + > Blueprint**.
2. Selecciona el repositorio `AdrianLLanos/proyecto-diplomado-angular`. Render detectará `render.yaml`.
3. En las variables del servicio, pega `DATABASE_URL` de Supabase. No la subas al repositorio.
4. Pulsa **Apply** y espera el estado **Live**. Copia la URL, por ejemplo `https://clinica-angular-api.onrender.com`.
5. En Netlify abre **Site configuration > Redirects > Add redirect** y crea esta regla:

   | Campo | Valor |
   | --- | --- |
   | From | `/api/*` |
   | To | `https://TU-URL-DE-RENDER/api/:splat` |
   | Status | `200` (Rewrite) |

6. Guarda y pulsa **Deploys > Trigger deploy > Deploy site**.
7. Abre `https://proyecto-diplomado-angular.netlify.app/api/health`. Debe devolver `{\"ok\":true}`. Después abre el sitio y prueba iniciar sesión.

Para actualizar el sistema: haz `git push`; Render y Netlify redeplegarán desde GitHub.
