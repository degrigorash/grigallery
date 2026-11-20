import { listFolders, listImages } from '#lib/server/db.ts';
import { parsePrefs, PREFS_COOKIE } from '#lib/types.ts';
import type { LayoutServerLoad } from './$types';

// Loaded once per visit; moving between folders happens in the browser.
export const load: LayoutServerLoad = ({ locals, cookies }) => ({
	images: listImages(),
	folders: listFolders(),
	user: locals.user,
	prefs: parsePrefs(cookies.get(PREFS_COOKIE))
});
