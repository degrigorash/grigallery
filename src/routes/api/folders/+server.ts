import { randomBytes } from 'node:crypto';
import { requireAdmin } from '#lib/server/auth.ts';
import { folderToClient, insertFolder, listFolders, type FolderRow } from '#lib/server/db.ts';
import { assertFreeSlug, prepareName, resolveTarget } from '#lib/server/folders.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => Response.json(listFolders());

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	const body = await request.json().catch(() => null);
	const { name, slug } = prepareName(body?.name);
	const parent = resolveTarget(body?.parentId);
	assertFreeSlug(parent?.id ?? null, slug);

	const row: FolderRow = {
		id: randomBytes(8).toString('hex'),
		name,
		slug,
		parent_id: parent?.id ?? null,
		created_at: new Date().toISOString()
	};
	insertFolder(row);
	return Response.json(folderToClient(row), { status: 201 });
};
