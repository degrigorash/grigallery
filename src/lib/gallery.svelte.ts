import { localDay } from './format.ts';
import { PREFS_COOKIE, type GalleryImage, type Prefs, type Sort, type View } from './types.ts';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export class Gallery {
	items = $state<GalleryImage[]>([]);
	user = $state<string | null>(null);
	view = $state<View>('grid');
	sort = $state<Sort>('date-desc');
	query = $state('');
	from = $state('');
	to = $state('');
	/** True once running in the browser; dates are formatted only then. */
	ready = $state(false);

	visible = $derived.by(() => {
		const words = this.query.toLowerCase().split(/\s+/).filter(Boolean);
		const list = this.items.filter((it) => {
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

	filtersActive = $derived(this.from !== '' || this.to !== '' || this.sort !== 'date-desc');

	constructor(init: { images: GalleryImage[]; user: string | null; prefs: Prefs }) {
		this.items = init.images;
		this.user = init.user;
		this.view = init.prefs.view;
		this.sort = init.prefs.sort;
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

	remove(id: string) {
		this.items = this.items.filter((it) => it.id !== id);
	}
}
