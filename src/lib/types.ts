export interface GalleryImage {
	id: string;
	name: string;
	width: number;
	height: number;
	size: number;
	mime: string;
	animated: boolean;
	/** ISO timestamp, UTC. */
	uploadedAt: string;
	/** Dominant colour, shown while the picture loads. */
	color: string;
	/** Folder it lives in; null means the root. */
	folderId: string | null;
	url: string;
	thumb: string;
}

export interface GalleryFolder {
	id: string;
	name: string;
	/** URL segment, unique among siblings. */
	slug: string;
	/** null means the folder is in the root. */
	parentId: string | null;
	/** Picture chosen as the cover; null means the newest picture inside. */
	coverId: string | null;
	createdAt: string;
}

export const VIEWS = ['grid', 'rows', 'list'] as const;
export type View = (typeof VIEWS)[number];

export const SORTS = ['date-desc', 'date-asc', 'name-asc', 'name-desc'] as const;
export type Sort = (typeof SORTS)[number];

export interface Prefs {
	view: View;
	sort: Sort;
}

export const DEFAULT_PREFS: Prefs = { view: 'grid', sort: 'date-desc' };
export const PREFS_COOKIE = 'gg_prefs';

export function parsePrefs(raw: string | undefined): Prefs {
	try {
		const data = JSON.parse(raw ?? '{}');
		return {
			view: VIEWS.includes(data.view) ? data.view : DEFAULT_PREFS.view,
			sort: SORTS.includes(data.sort) ? data.sort : DEFAULT_PREFS.sort
		};
	} catch {
		return { ...DEFAULT_PREFS };
	}
}
