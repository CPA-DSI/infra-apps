// hash-passwords.js
// Usage : node scripts/hash-passwords.js "MotDePasse1" "MotDePasse2" ...
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

const hashPassword = async (password) => {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  console.log(`Hash: ${hash}\n`);
};

const run = async () => {
  const passwords = process.argv.slice(2);
  if (passwords.length === 0) {
    console.error('Usage : node scripts/hash-passwords.js "MotDePasse1" "MotDePasse2" ...');
    process.exit(1);
  }
  for (const password of passwords) {
    await hashPassword(password);
  }
};

run();
