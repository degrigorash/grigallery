export const NAME_MAX = 300;

/** Normalizes a user-given name: NFC, no control characters, trimmed, capped. */
export function cleanName(raw: unknown): string {
	if (typeof raw !== 'string') return '';
	return raw
		.normalize('NFC')
		.replace(/[\u0000-\u001f\u007f]/g, ' ')
		.trim()
		.slice(0, NAME_MAX);
}

/** "Frieren ep12.png" -> "Frieren ep12". The name carries the picture's context. */
export function nameFromFilename(filename: string): string {
	const base = filename.split(/[\\/]/).pop() ?? '';
	const dot = base.lastIndexOf('.');
	return cleanName(dot > 0 ? base.slice(0, dot) : base) || 'untitled';
}
