import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Keep in sync with scripts/hash-password.mjs.
// ":" separates fields because "$" would be eaten by docker compose interpolation.
const N = 16384;
const R = 8;
const P = 1;
const MAXMEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, length: number, options: ScryptOptions) {
	return new Promise<Buffer>((resolve, reject) =>
		scrypt(password, salt, length, options, (err, key) => (err ? reject(err) : resolve(key)))
	);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await derive(password, salt, 32, { N, r: R, p: P, maxmem: MAXMEM });
	return `scrypt:${N}:${R}:${P}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split(':');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
	const [, n, r, p, salt, key] = parts;
	const expected = Buffer.from(key, 'base64url');
	if (expected.length === 0) return false;
	try {
		const actual = await derive(password, Buffer.from(salt, 'base64url'), expected.length, {
			N: Number(n),
			r: Number(r),
			p: Number(p),
			maxmem: MAXMEM
		});
		return timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}
