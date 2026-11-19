import path from 'node:path';

const env = process.env;

export const DATA_DIR = path.resolve(env.DATA_DIR ?? 'data');
export const ORIGINALS_DIR = path.join(DATA_DIR, 'originals');
export const THUMBS_DIR = path.join(DATA_DIR, 'thumbs');
export const DB_PATH = path.join(DATA_DIR, 'gallery.db');

export const ADMIN_USER = env.ADMIN_USER ?? 'grig';
export const ADMIN_PASSWORD_HASH = env.ADMIN_PASSWORD_HASH ?? '';
export const SECRET_KEY = env.SECRET_KEY ?? '';
export const MAX_UPLOAD_BYTES = Number(env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024;
export const SESSION_DAYS = 30;
