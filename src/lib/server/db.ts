import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { GalleryFolder, GalleryImage } from '../types.ts';
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
	folder_id: string | null;
}

export interface FolderRow {
	id: string;
	name: string;
	slug: string;
	parent_id: string | null;
	created_at: string;
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

CREATE TABLE IF NOT EXISTS folders (
	id         TEXT PRIMARY KEY,
	name       TEXT NOT NULL,
	slug       TEXT NOT NULL,
	parent_id  TEXT,
	created_at TEXT NOT NULL
);

-- Sibling folders can't share a URL segment; NULL (the root) counts as one parent.
CREATE UNIQUE INDEX IF NOT EXISTS folders_parent_slug ON folders (COALESCE(parent_id, ''), slug);
`;

let db: DatabaseSync | undefined;

/** Opened lazily so that building the app doesn't touch the data folder. */
function getDb() {
	if (!db) {
		for (const dir of [ORIGINALS_DIR, THUMBS_DIR]) mkdirSync(dir, { recursive: true });
		db = new DatabaseSync(DB_PATH);
		db.exec('PRAGMA journal_mode = WAL;');
		db.exec(SCHEMA);
		migrate(db);
	}
	return db;
}

/** Brings databases from older versions up to date. */
function migrate(conn: DatabaseSync) {
	const columns = (conn.prepare('PRAGMA table_info(images)').all() as { name: string }[]).map(
		(c) => c.name
	);
	// Folders arrived after the first release: existing pictures stay in the root.
	if (!columns.includes('folder_id')) conn.exec('ALTER TABLE images ADD COLUMN folder_id TEXT');
	conn.exec('CREATE INDEX IF NOT EXISTS images_folder ON images (folder_id)');
}

/** Runs fn in a transaction, rolling back if it throws. */
export function transaction<T>(fn: () => T): T {
	const conn = getDb();
	conn.exec('BEGIN');
	try {
		const result = fn();
		conn.exec('COMMIT');
		return result;
	} catch (e) {
		conn.exec('ROLLBACK');
		throw e;
	}
}

// --- images -------------------------------------------------------------------

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
		folderId: row.folder_id ?? null,
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
				animated, color, sha256, uploaded_at, folder_id)
			VALUES (:id, :name, :original_filename, :file, :mime, :width, :height, :size,
				:animated, :color, :sha256, :uploaded_at, :folder_id)`
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

/** Moves the given pictures into a folder (null = root). Returns how many moved. */
export function moveImages(ids: string[], folderId: string | null): number {
	const stmt = getDb().prepare('UPDATE images SET folder_id = ? WHERE id = ?');
	return transaction(() => ids.reduce((n, id) => n + Number(stmt.run(folderId, id).changes), 0));
}

// --- folders ------------------------------------------------------------------

export function folderToClient(row: FolderRow): GalleryFolder {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		parentId: row.parent_id ?? null,
		createdAt: row.created_at
	};
}

export function listFolders(): GalleryFolder[] {
	const rows = getDb().prepare('SELECT * FROM folders ORDER BY name').all();
	return (rows as unknown as FolderRow[]).map(folderToClient);
}

export function getFolder(id: string): FolderRow | undefined {
	return getDb().prepare('SELECT * FROM folders WHERE id = ?').get(id) as FolderRow | undefined;
}

export function findFolderBySlug(parentId: string | null, slug: string): FolderRow | undefined {
	return getDb()
		.prepare("SELECT * FROM folders WHERE COALESCE(parent_id, '') = ? AND slug = ?")
		.get(parentId ?? '', slug) as FolderRow | undefined;
}

export function childFolders(parentId: string | null): FolderRow[] {
	return getDb()
		.prepare("SELECT * FROM folders WHERE COALESCE(parent_id, '') = ?")
		.all(parentId ?? '') as unknown as FolderRow[];
}

export function insertFolder(row: FolderRow) {
	getDb()
		.prepare(
			`INSERT INTO folders (id, name, slug, parent_id, created_at)
			VALUES (:id, :name, :slug, :parent_id, :created_at)`
		)
		.run({ ...row });
}

export function updateFolder(id: string, fields: Pick<FolderRow, 'name' | 'slug' | 'parent_id'>) {
	getDb()
		.prepare('UPDATE folders SET name = :name, slug = :slug, parent_id = :parent_id WHERE id = :id')
		.run({ ...fields, id });
}

/** Deletes a folder; its pictures and subfolders move up to its parent. */
export function deleteFolder(folder: FolderRow) {
	const conn = getDb();
	transaction(() => {
		conn.prepare('UPDATE images SET folder_id = ? WHERE folder_id = ?').run(folder.parent_id, folder.id);
		conn.prepare('UPDATE folders SET parent_id = ? WHERE parent_id = ?').run(folder.parent_id, folder.id);
		conn.prepare('DELETE FROM folders WHERE id = ?').run(folder.id);
	});
}
