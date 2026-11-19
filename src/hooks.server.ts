import type { Handle } from '@sveltejs/kit/hooks';
import { readSession } from '#lib/server/auth.ts';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = readSession(event.cookies);
	const response = await resolve(event);
	try {
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('Referrer-Policy', 'same-origin');
	} catch {
		// Some responses have immutable headers; they don't need these.
	}
	return response;
};
