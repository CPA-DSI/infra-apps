import 'dotenv/config';
import prisma from './prismaClient.js';
import { reloadCronTasks } from './cron-worker.js';
import { assertPassMailEncryptionKeyConfigured } from './services/passMailCrypto.js';

// Échoue immédiatement au démarrage si PASS_MAIL_ENCRYPTION_KEY est absente/invalide,
// plutôt que de laisser le serveur démarrer et planter plus tard (login, gestion des
// utilisateurs/emails, création de matériel en dépendent tous).
try {
    assertPassMailEncryptionKeyConfigured();
} catch (error) {
    console.error(`❌ Configuration invalide : ${error.message}`);
    process.exit(1);
}

// Import dynamique : les routes ne sont chargées qu'après la vérification ci-dessus.
const { default: app } = await import('./app.js');

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
    try {
        await prisma.$connect();
        // Planifier les robots d'envoi selon les configs en base
        await reloadCronTasks(prisma);
        console.log('✅ Base de données connectée.');
        console.log(`🚀 Serveur actif sur http://localhost:${PORT}`);
    } catch (error) {
        console.error('❌ Erreur de démarrage:', error);
        process.exit(1);
    }
});
