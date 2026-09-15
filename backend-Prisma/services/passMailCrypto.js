import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const VERSION_PREFIX = 'v1';

function getKey() {
    const keyHex = process.env.PASS_MAIL_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error('PASS_MAIL_ENCRYPTION_KEY doit être défini dans .env avec une clé hexadécimale de 64 caractères (32 octets).');
    }
    return Buffer.from(keyHex, 'hex');
}

export function encryptPassMail(plainText) {
    if (!plainText) return plainText;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [VERSION_PREFIX, iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptPassMail(storedValue) {
    if (!storedValue) return storedValue;
    const parts = storedValue.split(':');
    if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
        // Ancienne valeur enregistrée en clair avant la mise en place du chiffrement.
        return storedValue;
    }
    const [, ivHex, authTagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
}

// Alias génériques : même algorithme AES-256-GCM, réutilisés pour chiffrer/déchiffrer
// le mot de passe de connexion (UserEmail.password_enc) afin de pouvoir le communiquer
// à l'utilisateur, en plus du hash bcrypt (UserEmail.password) qui sert à l'authentification.
export const encryptSecret = encryptPassMail;
export const decryptSecret = decryptPassMail;
