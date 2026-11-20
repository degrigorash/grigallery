import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/auth.ts';
import { deleteFolder, folderToClient, getFolder, getImage, updateFolder } from '#lib/server/db.ts';
import {
	assertFreeSlug,
	collisionsOnDelete,
	isInside,
	prepareName,
	resolveTarget
} from '#lib/server/folders.ts';
import type { RequestHandler } from './$types';

/**
 * Any of: { name, parentId, coverId }. parentId null = root;
 * coverId null = back to the newest picture inside.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	requireAdmin(locals);
	const folder = getFolder(params.id);
	if (!folder) error(404, 'Folder not found');
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Nothing to change');

	const { name, slug } = 'name' in body ? prepareName(body.name) : folder;
	let parentId = folder.parent_id;
	if ('parentId' in body) {
		const parent = resolveTarget(body.parentId);
		if (isInside(parent, folder.id)) error(400, "A folder can't go inside itself");
		parentId = parent?.id ?? null;
	}
	assertFreeSlug(parentId, slug, folder.id);

	let coverId = folder.cover_id;
	if ('coverId' in body) {
		if (body.coverId === null) {
			coverId = null;
		} else {
			const image = typeof body.coverId === 'string' ? getImage(body.coverId) : undefined;
			const imageFolder = image?.folder_id ? (getFolder(image.folder_id) ?? null) : null;
			if (!image || !isInside(imageFolder, folder.id)) {
				error(400, 'The cover has to be a picture from this folder');
			}
			coverId = image.id;
		}
	}

	const fields = { name, slug, parent_id: parentId, cover_id: coverId };
	updateFolder(folder.id, fields);
	return Response.json(folderToClient({ ...folder, ...fields }));
};

/** Deletes the folder; what was inside moves up to its parent. */
export const DELETE: RequestHandler = ({ params, locals }) => {
	requireAdmin(locals);
	const folder = getFolder(params.id);
	if (!folder) error(404, 'Folder not found');
	const clashes = collisionsOnDelete(folder);
	if (clashes.length) {
		error(409, `Can't move “${clashes[0]}” up: a folder with that name is already there`);
	}
	deleteFolder(folder);
	return new Response(null, { status: 204 });
};
