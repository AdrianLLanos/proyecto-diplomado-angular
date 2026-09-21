import serverless from 'serverless-http';
import {createApp} from '../../../backend/src/app.js';

// Netlify conserva la ruta /api/* gracias a la configuración `path`.
// La aplicación Express sigue atendiendo exactamente los mismos endpoints.
const app=createApp();
export const handler=serverless(app);
export const config={path:'/api/*'};
