import { rm } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/auth.ts';
import { ORIGINALS_DIR, THUMBS_DIR } from '#lib/server/config.ts';
import { deleteImage, getImage, renameImage, toClient } from '#lib/server/db.ts';
import { cleanName } from '#lib/server/names.ts';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	requireAdmin(locals);
	const body = await request.json().catch(() => null);
	const name = cleanName(body?.name);
	if (!name) error(400, "Name can't be empty");
	if (!renameImage(params.id, name)) error(404, 'Image not found');
	return Response.json(toClient(getImage(params.id)!));
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireAdmin(locals);
	const row = getImage(params.id);
	if (!row || !deleteImage(params.id)) error(404, 'Image not found');
	await Promise.all([
		rm(path.join(ORIGINALS_DIR, row.file), { force: true }),
		rm(path.join(THUMBS_DIR, `${row.id}.webp`), { force: true })
	]);
	return new Response(null, { status: 204 });
};
