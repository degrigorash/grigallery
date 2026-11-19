import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { ORIGINALS_DIR, THUMBS_DIR } from '#lib/server/config.ts';
import type { RequestHandler } from './$types';

const DIRS: Record<string, string> = { originals: ORIGINALS_DIR, thumbs: THUMBS_DIR };
const TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif'
};
// Stored files are always "<16 hex chars>.<ext>", so nothing else can be requested.
const FILE_RE = /^[0-9a-f]{16}\.(jpg|png|webp|gif|avif)$/;

export const GET: RequestHandler = async ({ params }) => {
	const dir = DIRS[params.kind];
	const match = FILE_RE.exec(params.file);
	if (!dir || !match) error(404, 'Not found');

	const filePath = path.join(dir, params.file);
	const info = await stat(filePath).catch(() => null);
	if (!info?.isFile()) error(404, 'Not found');

	const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
	return new Response(body, {
		headers: {
			'Content-Type': TYPES[match[1]],
			'Content-Length': String(info.size),
			// Names are random ids that are never reused, so the files never change.
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
