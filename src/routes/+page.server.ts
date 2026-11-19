import { listImages } from '#lib/server/db.ts';
import { parsePrefs, PREFS_COOKIE } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies }) => ({
	images: listImages(),
	user: locals.user,
	prefs: parsePrefs(cookies.get(PREFS_COOKIE))
});
