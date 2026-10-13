// Prépare la base de test locale :
//   1. crée .env.test (ignoré par Git) s'il n'existe pas, à partir du DATABASE_URL
//      de .env en remplaçant le nom de la base par "<nom>_test", avec des secrets
//      aléatoires propres aux tests ;
//   2. crée la base de test sur le même serveur si elle n'existe pas ;
//   3. applique les migrations (prisma migrate deploy) sur la base de test UNIQUEMENT.
// Usage : npm run test:db:setup
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { ENV_TEST_PATH, loadTestEnv, assertTestDatabaseUrl, databaseNameFromUrl } from '../tests/helpers/testEnv.js';

const backendDir = path.dirname(ENV_TEST_PATH);

if (!fs.existsSync(ENV_TEST_PATH)) {
    const devEnv = dotenv.parse(fs.readFileSync(path.join(backendDir, '.env')));
    if (!devEnv.DATABASE_URL) {
        throw new Error('DATABASE_URL absent de .env : impossible de dériver l\'URL de la base de test.');
    }
    const url = new URL(devEnv.DATABASE_URL);
    const devName = databaseNameFromUrl(devEnv.DATABASE_URL);
    const testName = devName.endsWith('_test') ? devName : `${devName.replace(/_bdd$/, '')}_test`;
    url.pathname = `/${testName}`;

    fs.writeFileSync(ENV_TEST_PATH, [
        '# Environnement des tests automatisés (npm test). Fichier local, ignoré par Git.',
        '# La base doit avoir un nom finissant par _test : les tests vident ses tables.',
        `DATABASE_URL="${url.toString()}"`,
        `JWT_SECRET="${crypto.randomBytes(32).toString('hex')}"`,
        `PASS_MAIL_ENCRYPTION_KEY="${crypto.randomBytes(32).toString('hex')}"`,
        '',
    ].join('\n'));
    console.log(`.env.test créé (base : ${testName}).`);
}

loadTestEnv();
const testDbName = assertTestDatabaseUrl();

// Connexion à la base d'administration "postgres" du même serveur pour créer la base de test
const adminUrl = new URL(process.env.DATABASE_URL);
adminUrl.pathname = '/postgres';
adminUrl.search = '';
const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
try {
    const rows = await admin.$queryRaw`SELECT 1 FROM pg_database WHERE datname = ${testDbName}`;
    if (rows.length === 0) {
        if (!/^[A-Za-z0-9_]+$/.test(testDbName)) {
            throw new Error(`Nom de base de test invalide : ${testDbName}`);
        }
        await admin.$executeRawUnsafe(`CREATE DATABASE "${testDbName}"`);
        console.log(`Base ${testDbName} créée.`);
    } else {
        console.log(`Base ${testDbName} déjà présente.`);
    }
} finally {
    await admin.$disconnect();
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'inherit',
    shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
