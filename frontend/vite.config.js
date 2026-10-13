import { defineConfig, transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';

// Les composants du projet sont ecrits en JSX dans des fichiers .js (heritage CRA).
const SRC_JS_RE = /[\\/]src[\\/].*\.jsx?$/;

// Build de production : le transformeur natif de Rolldown deduit la syntaxe de
// l'extension (.js => pas de JSX) et ignore `oxc.lang`. On compile donc le JSX
// des fichiers .js de src/ avant lui. En dev et sous Vitest, `oxc.lang` suffit
// (et conserve le Fast Refresh).
function jsxInJsForBuild() {
  return {
    name: 'jsx-in-js-build',
    apply: 'build',
    enforce: 'pre',
    async transform(code, id) {
      const file = id.split('?')[0];
      if (!SRC_JS_RE.test(file) || !file.endsWith('.js')) return null;
      const result = await transformWithOxc(code, file, {
        lang: 'jsx',
        jsx: { runtime: 'automatic' },
        sourcemap: false,
      });
      return { code: result.code, map: null };
    },
  };
}

export default defineConfig({
  plugins: [jsxInJsForBuild(), react()],
  oxc: {
    include: SRC_JS_RE,
    exclude: [],
    lang: 'jsx',
    jsx: { runtime: 'automatic' },
    jsxRefreshInclude: SRC_JS_RE,
  },
  optimizeDeps: {
    rolldownOptions: {
      moduleTypes: { '.js': 'jsx' },
    },
  },
  // Vite 8 applique l'interop CommonJS de Node : `import X from 'pkg'` renvoie
  // module.exports entier, y compris pour les paquets CJS compilés depuis l'ESM
  // (exports.default, ex. react-apexcharts), ce qui casse les composants.
  // On conserve l'ancien comportement (celui de CRA/webpack et de Vite 7).
  legacy: {
    inconsistentCjsInterop: true,
  },
  // REACT_APP_ conserve pour que la variable Vercel REACT_APP_API_URL reste valide.
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
  build: {
    outDir: 'build',
    // Ne jamais publier les source maps en production.
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    css: false,
  },
});
