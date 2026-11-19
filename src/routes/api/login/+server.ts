import { error } from '@sveltejs/kit';
import { ADMIN_USER } from '#lib/server/config.ts';
import { checkCredentials, checkRate, recordFailure, startSession } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();
	checkRate(ip);
	const body = await request.json().catch(() => null);
	const username = typeof body?.username === 'string' ? body.username.trim() : '';
	const password = typeof body?.password === 'string' ? body.password : '';
	if (!(await checkCredentials(username, password))) {
		recordFailure(ip);
		await new Promise((r) => setTimeout(r, 1000));
		error(401, 'Wrong username or password');
	}
	startSession(cookies, ADMIN_USER);
	return Response.json({ user: ADMIN_USER });
};
