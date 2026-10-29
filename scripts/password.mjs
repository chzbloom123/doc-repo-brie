import { hashPassword } from '../server/auth.mjs';
// Read stdin so a password never appears in process arguments or shell history.
let password = '';
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/\r?\n$/, '');
if (password.length < 16) throw new Error('Use a unique password of at least 16 characters.');
console.log(await hashPassword(password));
