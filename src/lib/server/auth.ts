import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { error, type Cookies } from '@sveltejs/kit';
import { ADMIN_PASSWORD_HASH, ADMIN_USER, SECRET_KEY, SESSION_DAYS } from './config.ts';
import { verifyPassword } from './password.ts';

export const SESSION_COOKIE = 'gg_session';

const secret = SECRET_KEY ? Buffer.from(SECRET_KEY) : randomBytes(32);
if (!SECRET_KEY) console.warn('[grigallery] SECRET_KEY is not set: sessions reset on every restart');
if (!ADMIN_PASSWORD_HASH) console.warn('[grigallery] ADMIN_PASSWORD_HASH is not set: login is disabled');

const sign = (payload: string) => createHmac('sha256', secret).update(payload).digest('base64url');

function safeEqual(a: string, b: string) {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function readSession(cookies: Cookies): string | null {
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return null;
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [user, expires, sig] = parts;
	if (!safeEqual(sig, sign(`${user}.${expires}`))) return null;
	if (!/^\d+$/.test(expires) || Number(expires) < Date.now() / 1000) return null;
	const name = Buffer.from(user, 'base64url').toString();
	return name === ADMIN_USER ? name : null;
}

export function startSession(cookies: Cookies, user: string) {
	const maxAge = SESSION_DAYS * 86400;
	const expires = Math.floor(Date.now() / 1000) + maxAge;
	const encoded = Buffer.from(user).toString('base64url');
	const payload = `${encoded}.${expires}`;
	cookies.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge
	});
}

export function endSession(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function checkCredentials(username: string, password: string): Promise<boolean> {
	if (!ADMIN_PASSWORD_HASH) return false;
	const passwordOk = await verifyPassword(password, ADMIN_PASSWORD_HASH);
	return safeEqual(username, ADMIN_USER) && passwordOk;
}

export function requireAdmin(locals: App.Locals) {
	if (!locals.user) error(401, 'Log in first');
}

// --- login rate limit: 5 failures per 15 minutes per address ---

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, number[]>();

function recent(ip: string) {
	const cutoff = Date.now() - WINDOW_MS;
	const list = (failures.get(ip) ?? []).filter((t) => t > cutoff);
	if (list.length) failures.set(ip, list);
	else failures.delete(ip);
	return list;
}

export function checkRate(ip: string) {
	if (recent(ip).length >= MAX_FAILURES) error(429, 'Too many attempts, try again in 15 minutes');
}

export function recordFailure(ip: string) {
	failures.set(ip, [...recent(ip), Date.now()]);
}
