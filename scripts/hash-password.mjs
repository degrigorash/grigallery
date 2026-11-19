// Prints a hash for ADMIN_PASSWORD_HASH.
//   node scripts/hash-password.mjs              (asks for the password, hidden)
//   printf '%s' "$PASSWORD" | node scripts/hash-password.mjs
// Keep the format in sync with src/lib/server/password.ts.
import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';

const N = 16384;
const R = 8;
const P = 1;

function hash(password) {
	const salt = randomBytes(16);
	const key = scryptSync(password, salt, 32, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
	return `scrypt:${N}:${R}:${P}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

async function readStdin() {
	let data = '';
	for await (const chunk of process.stdin) data += chunk;
	return data.replace(/\r?\n$/, '');
}

function ask(question) {
	return new Promise((resolve) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		process.stdout.write(question);
		// Hide what's typed.
		rl._writeToOutput = () => {};
		rl.question('', (answer) => {
			rl.close();
			process.stdout.write('\n');
			resolve(answer);
		});
	});
}

let password;
if (process.stdin.isTTY) {
	password = await ask('Password: ');
	if ((await ask('Repeat: ')) !== password) {
		console.error("Passwords don't match");
		process.exit(1);
	}
} else {
	password = await readStdin();
}
if (!password) {
	console.error('Empty password');
	process.exit(1);
}
console.log(hash(password));
