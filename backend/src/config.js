import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
export const config = {
  production: process.env.NODE_ENV === 'production',
  host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 3001),
  schema: process.env.DB_SCHEMA || 'public', companyId: Number(process.env.COMPANY_ID || 1),
  localAccess: process.env.LOCAL_ACCESS === 'true' && process.env.NODE_ENV !== 'production',
  localUserId: process.env.LOCAL_ACCESS_USER_ID,
  enforceRoles: process.env.ENFORCE_ROLES === 'true' || process.env.NODE_ENV === 'production',
  appUrl: process.env.APP_URL || 'http://localhost:4200',
  publicCompanyId: Number(process.env.PUBLIC_COMPANY_ID || 1),
  jwtSecret: process.env.JWT_SECRET,
};
if (!/^[a-z_][a-z0-9_]*$/.test(config.schema)) throw new Error('DB_SCHEMA inválido');
