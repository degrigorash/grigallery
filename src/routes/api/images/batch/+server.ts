import { rm } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/auth.ts';
import { ORIGINALS_DIR, THUMBS_DIR } from '#lib/server/config.ts';
import { deleteImage, getImage, moveImages, transaction } from '#lib/server/db.ts';
import { resolveTarget } from '#lib/server/folders.ts';
import type { RequestHandler } from './$types';

const MAX_BATCH = 1000;

function readIds(body: unknown): string[] {
	const ids = (body as { ids?: unknown } | null)?.ids;
	if (!Array.isArray(ids) || !ids.length || ids.length > MAX_BATCH) error(400, 'Bad list of images');
	if (!ids.every((id) => typeof id === 'string')) error(400, 'Bad list of images');
	return [...new Set(ids as string[])];
}

/**
 * Several pictures at once:
 *   { action: 'move', ids, folderId }   folderId null = root
 *   { action: 'delete', ids }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	const body = await request.json().catch(() => null);
	const ids = readIds(body);

	if (body.action === 'move') {
		const target = resolveTarget(body.folderId);
		const moved = moveImages(ids, target?.id ?? null);
		return Response.json({ moved });
	}

	if (body.action === 'delete') {
		const rows = transaction(() =>
			ids.flatMap((id) => {
				const row = getImage(id);
				return row && deleteImage(id) ? [row] : [];
			})
		);
		await Promise.all(
			rows.flatMap((row) => [
				rm(path.join(ORIGINALS_DIR, row.file), { force: true }),
				rm(path.join(THUMBS_DIR, `${row.id}.webp`), { force: true })
			])
		);
		return Response.json({ deleted: rows.length });
	}

	error(400, 'Unknown action');
};
