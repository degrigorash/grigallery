import { error } from '@sveltejs/kit';
import { childFolders, findFolderBySlug, getFolder, type FolderRow } from './db.ts';
import { cleanName } from './names.ts';

export const FOLDER_NAME_MAX = 100;

// URL segments the app itself uses, so no folder may take them.
const RESERVED = new Set(['api', 'files', '_app', 'favicon.ico', 'favicon.svg', 'robots.txt']);

/** "Anime / Frieren" -> "anime-frieren". Letters of any script are kept. */
export function slugify(name: string): string {
	return name
		.normalize('NFKC')
		.toLowerCase()
		.replace(/[/\\?#%"'<>|:*^`{}[\]]+/g, '')
		.replace(/[\s_.]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

/** Validates a folder name and returns it with its slug. */
export function prepareName(raw: unknown): { name: string; slug: string } {
	const name = cleanName(raw).slice(0, FOLDER_NAME_MAX);
	if (!name) error(400, "Folder name can't be empty");
	const slug = slugify(name);
	if (!slug) error(400, 'Folder name needs at least one letter or digit');
	if (RESERVED.has(slug)) error(400, `“${name}” is reserved, pick another name`);
	return { name, slug };
}

/** Checks that no other sibling under parentId uses the slug. */
export function assertFreeSlug(parentId: string | null, slug: string, exceptId?: string) {
	const taken = findFolderBySlug(parentId, slug);
	if (taken && taken.id !== exceptId) {
		error(409, `There is already a folder “${taken.name}” here`);
	}
}

/** Returns the folder for an id from the client; null means the root. */
export function resolveTarget(raw: unknown): FolderRow | null {
	if (raw === null || raw === undefined || raw === '') return null;
	if (typeof raw !== 'string') error(400, 'Bad folder id');
	const folder = getFolder(raw);
	if (!folder) error(404, 'Folder not found');
	return folder;
}

/** True if candidate is folderId itself or lies somewhere inside it. */
export function isInside(candidate: FolderRow | null, folderId: string): boolean {
	let current = candidate;
	while (current) {
		if (current.id === folderId) return true;
		current = current.parent_id ? (getFolder(current.parent_id) ?? null) : null;
	}
	return false;
}

/** Walks "anime/frieren" from the root. Undefined if any part doesn't exist. */
export function folderByPath(path: string): FolderRow | null | undefined {
	const parts = path.split('/').filter(Boolean);
	let current: FolderRow | null = null;
	for (const part of parts) {
		const next = findFolderBySlug(current?.id ?? null, part);
		if (!next) return undefined;
		current = next;
	}
	return current;
}

/** Slugs that would collide if folder's children moved up into its parent. */
export function collisionsOnDelete(folder: FolderRow): string[] {
	const siblings = new Map(
		childFolders(folder.parent_id)
			.filter((f) => f.id !== folder.id)
			.map((f) => [f.slug, f.name])
	);
	return childFolders(folder.id)
		.filter((child) => siblings.has(child.slug))
		.map((child) => child.name);
}
