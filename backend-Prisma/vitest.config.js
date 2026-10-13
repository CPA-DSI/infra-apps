import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.js'],
        setupFiles: ['./tests/setup.js'],
        // Les fichiers partagent la même base de test (tables vidées entre les tests) :
        // ils doivent s'exécuter l'un après l'autre.
        fileParallelism: false,
        testTimeout: 20000,
        hookTimeout: 30000,
    },
});
