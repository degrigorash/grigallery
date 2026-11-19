const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Local date and time. Call only in the browser: the server's locale and zone differ. */
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

/** "YYYY-MM-DD" in the viewer's time zone, to compare with <input type="date">. */
export function localDay(iso: string) {
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function stem(filename: string) {
	const dot = filename.lastIndexOf('.');
	return dot > 0 ? filename.slice(0, dot) : filename;
}

/** Aspect ratio for layout, clamped so a panorama or a long strip can't break a row. */
export const ratio = (w: number, h: number) => Math.min(Math.max(w / h, 0.3), 4);
