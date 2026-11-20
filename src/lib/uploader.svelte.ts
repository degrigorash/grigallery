import { ApiError, uploadImage } from './api.ts';
import { stem } from './format.ts';
import type { Gallery } from './gallery.svelte.ts';
import { showToast } from './toast.svelte.ts';
import type { GalleryImage } from './types.ts';

export type EntryStatus = 'ready' | 'uploading' | 'done' | 'error' | 'duplicate';

export interface QueueEntry {
	key: number;
	file: File;
	name: string;
	preview: string;
	status: EntryStatus;
	progress: number;
	message: string;
	/** Pasted screenshots have no meaningful file name; ask for one. */
	pasted: boolean;
}

let nextKey = 1;

export class Uploader {
	queue = $state<QueueEntry[]>([]);
	open = $state(false);
	busy = $state(false);
	/** Folder the queue uploads into; null is the root. */
	destination = $state<string | null>(null);

	pending = $derived(this.queue.some((e) => e.status === 'ready' || e.status === 'error'));

	private gallery: Gallery;

	constructor(gallery: Gallery) {
		this.gallery = gallery;
	}

	/** Opens the dialog aimed at the folder being looked at. */
	show() {
		if (!this.open) this.destination = this.gallery.folderId;
		this.open = true;
	}

	enqueue(files: Iterable<File>, { pasted = false } = {}) {
		const images = [...files].filter((f) => f.type.startsWith('image/'));
		if (!images.length) {
			showToast('No images there');
			return;
		}
		for (const file of images) {
			this.queue.push({
				key: nextKey++,
				file,
				name: pasted ? '' : stem(file.name),
				preview: URL.createObjectURL(file),
				status: 'ready',
				progress: 0,
				message: '',
				pasted
			});
		}
		this.show();
	}

	remove(entry: QueueEntry) {
		if (entry.status === 'uploading') return;
		URL.revokeObjectURL(entry.preview);
		this.queue = this.queue.filter((e) => e.key !== entry.key);
	}

	/** Drops finished entries (or everything not uploading, with all). */
	clear(all = false) {
		for (const entry of [...this.queue]) {
			if (entry.status === 'uploading') continue;
			if (all || entry.status === 'done' || entry.status === 'duplicate') this.remove(entry);
		}
	}

	async start() {
		if (this.busy) return;
		this.busy = true;
		let added = 0;
		for (const entry of this.queue) {
			if (entry.status !== 'ready' && entry.status !== 'error') continue;
			entry.status = 'uploading';
			entry.message = 'Uploading…';
			entry.progress = 0;
			try {
				const item = await uploadImage(
					entry.file,
					entry.name.trim(),
					this.destination,
					(p) => (entry.progress = p)
				);
				this.gallery.add(item);
				added++;
				entry.status = 'done';
				entry.progress = 1;
				entry.message = 'Uploaded';
			} catch (err) {
				const e = err instanceof ApiError ? err : new ApiError(String(err), 0, null);
				if (e.status === 409) {
					const existing = (e.data as { existing?: GalleryImage } | null)?.existing;
					entry.status = 'duplicate';
					entry.message = `Already in the gallery as “${existing?.name ?? '?'}”`;
				} else {
					entry.status = 'error';
					entry.message = e.message;
					if (e.status === 401) this.gallery.user = null;
				}
			}
		}
		this.busy = false;
		if (added) showToast(added === 1 ? '1 image uploaded' : `${added} images uploaded`);
		if (this.queue.length && this.queue.every((e) => e.status === 'done')) {
			setTimeout(() => {
				if (!this.busy && this.queue.every((e) => e.status === 'done')) {
					this.open = false;
					this.clear();
				}
			}, 700);
		}
	}
}
