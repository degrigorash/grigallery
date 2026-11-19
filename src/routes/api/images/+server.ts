import { createHash, randomBytes } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/auth.ts';
import { MAX_UPLOAD_BYTES, ORIGINALS_DIR, THUMBS_DIR } from '#lib/server/config.ts';
import { findBySha, insertImage, listImages, toClient, type ImageRow } from '#lib/server/db.ts';
import { processImage, UnsupportedImage } from '#lib/server/images.ts';
import { cleanName, nameFromFilename } from '#lib/server/names.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => Response.json(listImages());

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) error(400, 'No file in the request');
	if (file.size === 0) error(400, 'Empty file');
	if (file.size > MAX_UPLOAD_BYTES) {
		error(413, `File is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`);
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const sha256 = createHash('sha256').update(buffer).digest('hex');
	const existing = findBySha(sha256);
	if (existing) {
		return Response.json(
			{ message: 'This image is already in the gallery', existing: toClient(existing) },
			{ status: 409 }
		);
	}

	const id = randomBytes(8).toString('hex');
	const thumbPath = path.join(THUMBS_DIR, `${id}.webp`);
	let info;
	try {
		info = await processImage(buffer, thumbPath);
	} catch (e) {
		await rm(thumbPath, { force: true });
		if (e instanceof UnsupportedImage) error(415, e.message);
		throw e;
	}

	const stored = `${id}.${info.ext}`;
	const originalPath = path.join(ORIGINALS_DIR, stored);
	await writeFile(originalPath, buffer);

	const row: ImageRow = {
		id,
		name: cleanName(form.get('name')) || nameFromFilename(file.name),
		original_filename: cleanName(file.name) || 'untitled',
		file: stored,
		mime: info.mime,
		width: info.width,
		height: info.height,
		size: file.size,
		animated: info.animated ? 1 : 0,
		color: info.color,
		sha256,
		uploaded_at: new Date().toISOString()
	};
	try {
		insertImage(row);
	} catch (e) {
		await Promise.all([rm(originalPath, { force: true }), rm(thumbPath, { force: true })]);
		throw e;
	}
	return Response.json(toClient(row), { status: 201 });
};
