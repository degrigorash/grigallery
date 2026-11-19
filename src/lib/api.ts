import type { GalleryImage } from './types.ts';

export class ApiError extends Error {
	status: number;
	data: unknown;

	constructor(message: string, status: number, data: unknown) {
		super(message);
		this.status = status;
		this.data = data;
	}
}

function errorText(data: unknown, status: number) {
	const message = (data as { message?: unknown } | null)?.message;
	if (typeof message === 'string') return message;
	if (status === 413) return 'File is too large';
	if (status === 401) return 'Please log in again';
	if (status === 0) return 'Network error';
	return `Something went wrong (${status})`;
}

export async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
	const res = await fetch(url, {
		method,
		headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = res.status === 204 ? null : await res.json().catch(() => null);
	if (!res.ok) throw new ApiError(errorText(data, res.status), res.status, data);
	return data as T;
}

/** Uploads one file. XHR rather than fetch, because fetch can't report upload progress. */
export function uploadImage(
	file: File,
	name: string,
	onProgress: (fraction: number) => void
): Promise<GalleryImage> {
	return new Promise((resolve, reject) => {
		const form = new FormData();
		form.append('file', file, file.name);
		if (name) form.append('name', name);

		const xhr = new XMLHttpRequest();
		xhr.open('POST', '/api/images');
		xhr.responseType = 'json';
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress(e.loaded / e.total);
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
			else reject(new ApiError(errorText(xhr.response, xhr.status), xhr.status, xhr.response));
		};
		xhr.onerror = () => reject(new ApiError('Network error', 0, null));
		xhr.send(form);
	});
}
