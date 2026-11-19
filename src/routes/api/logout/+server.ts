import { endSession } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
	endSession(cookies);
	return Response.json({ user: null });
};
