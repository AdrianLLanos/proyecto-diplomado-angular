import pg from 'pg';
import fs from 'node:fs';
import { config } from './config.js';
pg.types.setTypeParser(1082, value => value);
export let pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ...(process.env.DB_CA_FILE ? { ca: fs.readFileSync(process.env.DB_CA_FILE, 'utf8') } : {}),
  },
  max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 60000,
  statement_timeout: 20000, options: `-c search_path=${config.schema}`,
});
pool.on('error', () => console.error('Se perdió una conexión inactiva con la base de datos.'));
export function useTestPool(replacement) { if(process.env.NODE_ENV!=='test')throw new Error('Solo disponible en pruebas'); pool=replacement; }
export const quote = value => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Identificador SQL inválido');
  return `"${value}"`;
};
export async function transaction(fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
