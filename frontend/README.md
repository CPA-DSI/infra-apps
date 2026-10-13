# InvTech IT - Frontend

Application React 19 construite avec [Vite](https://vite.dev/) (migree depuis Create React App).
Node.js 22.12+ requis (Vitest 5 / jsdom 30).

## Commandes

| Commande | Role |
| --- | --- |
| `npm run dev` (ou `npm start`) | Serveur de developpement sur http://localhost:3000 |
| `npm run build` | Build de production dans `build/` (sans source maps) |
| `npm run preview` | Sert le build localement sur http://localhost:3000 |
| `npm test` | Vitest en mode watch |
| `npm run test:ci` | Vitest en une passe (CI) |
| `npm run lint` | ESLint (`eslint.config.js`) sur `src/` |

## Variables d'environnement

Les fichiers `.env*` sont lus par Vite. Les prefixes `VITE_` et `REACT_APP_` sont exposes au code
via `import.meta.env` (ex. `import.meta.env.REACT_APP_API_URL`, URL de l'API, par defaut
`http://localhost:4000`). Ne jamais y mettre de secret : ces valeurs sont incluses dans le bundle.

## Notes

- Le JSX est autorise dans les fichiers `.js` de `src/` (voir `vite.config.js`).
- Deploiement Vercel : `vercel.json` (framework Vite, sortie `build/`, reecriture SPA vers `index.html`).
