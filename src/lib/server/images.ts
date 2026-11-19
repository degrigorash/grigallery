import sharp, { type Metadata } from 'sharp';

// The server is small: process one image at a time and don't keep a cache.
sharp.concurrency(1);
sharp.cache(false);

const LIMIT_PIXELS = 120_000_000;
const THUMB_SIDE = 800;
const ANIMATED_THUMB_SIDE = 400;
const MAX_ANIMATED_FRAMES = 600;

const FORMATS: Record<string, { ext: string; mime: string }> = {
	jpeg: { ext: 'jpg', mime: 'image/jpeg' },
	png: { ext: 'png', mime: 'image/png' },
	webp: { ext: 'webp', mime: 'image/webp' },
	gif: { ext: 'gif', mime: 'image/gif' },
	avif: { ext: 'avif', mime: 'image/avif' }
};

export class UnsupportedImage extends Error {}

export interface ProcessedImage {
	ext: string;
	mime: string;
	width: number;
	height: number;
	animated: boolean;
	color: string;
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** Validates the image, writes a WebP thumbnail and returns what we store about it. */
export async function processImage(input: Buffer, thumbPath: string): Promise<ProcessedImage> {
	let meta: Metadata;
	try {
		meta = await sharp(input, { animated: true, limitInputPixels: LIMIT_PIXELS }).metadata();
	} catch {
		throw new UnsupportedImage("Can't read this image");
	}

	let key: string = meta.format ?? '';
	if (key === 'heif') {
		if (meta.compression !== 'av1') throw new UnsupportedImage('HEIC images are not supported');
		key = 'avif';
	}
	const format = FORMATS[key];
	if (!format || !meta.width || !meta.height) {
		throw new UnsupportedImage(`Unsupported format: ${meta.format ?? 'unknown'}`);
	}

	const pages = meta.pages ?? 1;
	const animated = pages > 1 && (key === 'gif' || key === 'webp');
	let width = meta.width;
	let height = animated ? (meta.pageHeight ?? meta.height) : meta.height;
	// EXIF orientations 5-8 rotate the picture by 90 degrees.
	if (!animated && (meta.orientation ?? 1) >= 5) [width, height] = [height, width];

	try {
		if (animated && pages <= MAX_ANIMATED_FRAMES) {
			await sharp(input, { animated: true, limitInputPixels: LIMIT_PIXELS })
				.resize({
					width: ANIMATED_THUMB_SIDE,
					height: ANIMATED_THUMB_SIDE,
					fit: 'inside',
					withoutEnlargement: true
				})
				.webp({ quality: 75, effort: 4 })
				.toFile(thumbPath);
		} else {
			await sharp(input, { limitInputPixels: LIMIT_PIXELS })
				.rotate()
				.resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: 'inside', withoutEnlargement: true })
				.webp({ quality: 82, effort: 4 })
				.toFile(thumbPath);
		}
	} catch {
		throw new UnsupportedImage("Can't read this image");
	}

	const { dominant } = await sharp(thumbPath).stats();
	const color = `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`;

	return { ext: format.ext, mime: format.mime, width, height, animated, color };
}
