import { SvelteSet } from 'svelte/reactivity';
import { localDay } from './format.ts';
import {
	PREFS_COOKIE,
	type GalleryFolder,
	type GalleryImage,
	type Prefs,
	type Sort,
	type View
} from './types.ts';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const byFolderName = (a: GalleryFolder, b: GalleryFolder) => collator.compare(a.name, b.name);

export interface FolderOption {
	id: string | null;
	label: string;
	depth: number;
}

export class Gallery {
	items = $state<GalleryImage[]>([]);
	folders = $state<GalleryFolder[]>([]);
	/** Folder being looked at; null is the root. */
	folderId = $state<string | null>(null);
	user = $state<string | null>(null);
	view = $state<View>('grid');
	sort = $state<Sort>('date-desc');
	query = $state('');
	from = $state('');
	to = $state('');
	/** True once running in the browser; dates are formatted only then. */
	ready = $state(false);

	selecting = $state(false);
	selected = new SvelteSet<string>();

	byId = $derived(new Map(this.folders.map((f) => [f.id, f])));

	/** Folders from the root down to the current one. */
	trail = $derived.by(() => this.chainOf(this.folderId));

	current = $derived(this.folderId ? this.byId.get(this.folderId) : undefined);

	/** Searching or filtering looks through the whole subtree, not just this level. */
	searching = $derived(this.query.trim() !== '' || this.from !== '' || this.to !== '');

	/** The current folder and everything inside it (null = whole gallery). */
	subtree = $derived.by(() => (this.folderId ? this.descendants(this.folderId) : null));

	visibleFolders = $derived.by(() => {
		if (!this.searching) {
			return this.folders.filter((f) => f.parentId === this.folderId).sort(byFolderName);
		}
		const words = this.words();
		if (!words.length) return [];
		return this.folders
			.filter((f) => f.id !== this.folderId && (!this.subtree || this.subtree.has(f.id)))
			.filter((f) => words.every((w) => f.name.toLowerCase().includes(w)))
			.sort(byFolderName);
	});

	/** Pictures shown here, in order; the viewer walks this list. */
	visible = $derived.by(() => {
		const words = this.words();
		const list = this.items.filter((it) => {
			if (this.searching) {
				if (this.subtree && !(it.folderId && this.subtree.has(it.folderId))) return false;
			} else if (it.folderId !== this.folderId) {
				return false;
			}
			const name = it.name.toLowerCase();
			if (!words.every((w) => name.includes(w))) return false;
			if (this.from || this.to) {
				const day = localDay(it.uploadedAt);
				if (this.from && day < this.from) return false;
				if (this.to && day > this.to) return false;
			}
			return true;
		});
		const [key, dir] = this.sort.split('-');
		const sign = dir === 'asc' ? 1 : -1;
		const byName = (a: GalleryImage, b: GalleryImage) => collator.compare(a.name, b.name);
		const byDate = (a: GalleryImage, b: GalleryImage) => a.uploadedAt.localeCompare(b.uploadedAt);
		return list.sort(
			(a, b) => sign * (key === 'name' ? byName(a, b) || byDate(a, b) : byDate(a, b) || byName(a, b))
		);
	});

	/** Pictures directly at this level, before search and filters. */
	levelCount = $derived(this.items.filter((it) => it.folderId === this.folderId).length);

	/** Number of pictures in each folder, subfolders included. */
	counts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const it of this.items) {
			let id = it.folderId;
			while (id) {
				counts.set(id, (counts.get(id) ?? 0) + 1);
				id = this.byId.get(id)?.parentId ?? null;
			}
		}
		return counts;
	});

	/** Every folder as a flat, indented list for pickers, root first. */
	options = $derived.by(() => {
		const out: FolderOption[] = [{ id: null, label: 'Gallery', depth: 0 }];
		const walk = (parentId: string | null, depth: number) => {
			for (const f of this.folders.filter((f) => f.parentId === parentId).sort(byFolderName)) {
				out.push({ id: f.id, label: f.name, depth });
				walk(f.id, depth + 1);
			}
		};
		walk(null, 1);
		return out;
	});

	filtersActive = $derived(this.from !== '' || this.to !== '' || this.sort !== 'date-desc');

	constructor(init: {
		images: GalleryImage[];
		folders: GalleryFolder[];
		folderId: string | null;
		user: string | null;
		prefs: Prefs;
	}) {
		this.items = init.images;
		this.folders = init.folders;
		this.folderId = init.folderId;
		this.user = init.user;
		this.view = init.prefs.view;
		this.sort = init.prefs.sort;
	}

	private words() {
		return this.query.toLowerCase().split(/\s+/).filter(Boolean);
	}

	chainOf(id: string | null): GalleryFolder[] {
		const out: GalleryFolder[] = [];
		let f = id ? this.byId.get(id) : undefined;
		while (f) {
			out.unshift(f);
			f = f.parentId ? this.byId.get(f.parentId) : undefined;
		}
		return out;
	}

	/** id and all folders below it. */
	descendants(id: string): Set<string> {
		const out = new Set([id]);
		let grew = true;
		while (grew) {
			grew = false;
			for (const f of this.folders) {
				if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
					out.add(f.id);
					grew = true;
				}
			}
		}
		return out;
	}

	/** Address of a folder, e.g. "/anime/frieren"; "/" for the root. */
	url(id: string | null): string {
		return '/' + this.chainOf(id).map((f) => encodeURIComponent(f.slug)).join('/');
	}

	/** "anime / frieren", or "Gallery" for the root. */
	pathLabel(id: string | null): string {
		const chain = this.chainOf(id);
		return chain.length ? chain.map((f) => f.name).join(' / ') : 'Gallery';
	}

	/** View and sort live in a cookie so the server renders the page the way it was left. */
	savePrefs() {
		const value = encodeURIComponent(JSON.stringify({ view: this.view, sort: this.sort }));
		document.cookie = `${PREFS_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
	}

	resetFilters() {
		this.query = '';
		this.from = '';
		this.to = '';
		this.sort = 'date-desc';
		this.savePrefs();
	}

	add(item: GalleryImage) {
		this.items.push(item);
	}

	update(item: GalleryImage) {
		const i = this.items.findIndex((it) => it.id === item.id);
		if (i >= 0) this.items[i] = item;
	}

	remove(ids: string | string[]) {
		const gone = new Set(Array.isArray(ids) ? ids : [ids]);
		this.items = this.items.filter((it) => !gone.has(it.id));
		for (const id of gone) this.selected.delete(id);
	}

	moveItems(ids: string[], folderId: string | null) {
		const moving = new Set(ids);
		for (const it of this.items) if (moving.has(it.id)) it.folderId = folderId;
	}

	upsertFolder(folder: GalleryFolder) {
		const i = this.folders.findIndex((f) => f.id === folder.id);
		if (i >= 0) this.folders[i] = folder;
		else this.folders.push(folder);
	}

	/** Mirrors the server: contents of a deleted folder move up to its parent. */
	removeFolder(id: string) {
		const folder = this.byId.get(id);
		if (!folder) return;
		for (const it of this.items) if (it.folderId === id) it.folderId = folder.parentId;
		for (const f of this.folders) if (f.parentId === id) f.parentId = folder.parentId;
		this.folders = this.folders.filter((f) => f.id !== id);
	}

	toggleSelected(id: string) {
		if (this.selected.has(id)) this.selected.delete(id);
		else this.selected.add(id);
	}

	stopSelecting() {
		this.selecting = false;
		this.selected.clear();
	}
}
