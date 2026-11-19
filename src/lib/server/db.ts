import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { GalleryImage } from '../types.ts';
import { DB_PATH, ORIGINALS_DIR, THUMBS_DIR } from './config.ts';

export interface ImageRow {
	id: string;
	name: string;
	original_filename: string;
	file: string;
	mime: string;
	width: number;
	height: number;
	size: number;
	animated: number;
	color: string;
	sha256: string;
	uploaded_at: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS images (
	id                TEXT PRIMARY KEY,
	name              TEXT NOT NULL,
	original_filename TEXT NOT NULL,
	file              TEXT NOT NULL,
	mime              TEXT NOT NULL,
	width             INTEGER NOT NULL,
	height            INTEGER NOT NULL,
	size              INTEGER NOT NULL,
	animated          INTEGER NOT NULL DEFAULT 0,
	color             TEXT NOT NULL DEFAULT '#1f1f26',
	sha256            TEXT NOT NULL UNIQUE,
	uploaded_at       TEXT NOT NULL
);
`;

let db: DatabaseSync | undefined;

/** Opened lazily so that building the app doesn't touch the data folder. */
function getDb() {
	if (!db) {
		for (const dir of [ORIGINALS_DIR, THUMBS_DIR]) mkdirSync(dir, { recursive: true });
		db = new DatabaseSync(DB_PATH);
		db.exec('PRAGMA journal_mode = WAL;');
		db.exec(SCHEMA);
	}
	return db;
}

export function toClient(row: ImageRow): GalleryImage {
	return {
		id: row.id,
		name: row.name,
		width: row.width,
		height: row.height,
		size: row.size,
		mime: row.mime,
		animated: Boolean(row.animated),
		uploadedAt: row.uploaded_at,
		color: row.color,
		url: `/files/originals/${row.file}`,
		thumb: `/files/thumbs/${row.id}.webp`
	};
}

export function listImages(): GalleryImage[] {
	const rows = getDb().prepare('SELECT * FROM images ORDER BY uploaded_at DESC').all();
	return (rows as unknown as ImageRow[]).map(toClient);
}

export function getImage(id: string): ImageRow | undefined {
	return getDb().prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow | undefined;
}

export function findBySha(sha256: string): ImageRow | undefined {
	return getDb().prepare('SELECT * FROM images WHERE sha256 = ?').get(sha256) as
		| ImageRow
		| undefined;
}

export function insertImage(row: ImageRow) {
	getDb()
		.prepare(
			`INSERT INTO images (id, name, original_filename, file, mime, width, height, size,
				animated, color, sha256, uploaded_at)
			VALUES (:id, :name, :original_filename, :file, :mime, :width, :height, :size,
				:animated, :color, :sha256, :uploaded_at)`
		)
		.run({ ...row });
}

export function renameImage(id: string, name: string): boolean {
	const result = getDb().prepare('UPDATE images SET name = ? WHERE id = ?').run(name, id);
	return Number(result.changes) > 0;
}

export function deleteImage(id: string): boolean {
	const result = getDb().prepare('DELETE FROM images WHERE id = ?').run(id);
	return Number(result.changes) > 0;
}
