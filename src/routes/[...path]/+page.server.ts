import { error } from '@sveltejs/kit';
import { folderByPath } from '#lib/server/folders.ts';
import type { PageServerLoad } from './$types';

// "/anime/frieren" -> that folder; "/" -> the root (null).
export const load: PageServerLoad = ({ params }) => {
	const folder = folderByPath(params.path);
	if (folder === undefined) error(404, 'Folder not found');
	return { folderId: folder?.id ?? null };
};
