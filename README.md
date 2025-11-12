## Safe Guardian Autopilot

Plateforme Next.js autonome pour orchestrer les tickets du panneau Safe Guardian (`/adminpanel`). L'interface fournit une IA embarquée, gratuite et illimitée, capable d'analyser les demandes, de proposer des réponses prêtes à l'envoi et d'automatiser la résolution complète du flux support.

### Fonctionnalités clés
- Synchronisation des tickets via votre instance Safe Guardian (configurable).
- Génération d'analyses et de réponses en français adaptées au contexte du ticket.
- Mode Autopilot optionnel pour répondre et clôturer automatiquement.
- Journal d'activité temps-réel et tableau de bord des métriques critiques.
- Persistance locale de la configuration (aucun back-end externe requis).

### Pré-requis
- Node.js 18+ et npm.
- Accès HTTP au panel Safe Guardian si vous souhaitez connecter l'IA à votre production (sinon des tickets de démonstration sont fournis).

### Démarrage local
```bash
npm install
npm run dev
```
Rendez-vous ensuite sur http://localhost:3000.

### Variables d'environnement
La solution fonctionne sans configuration obligatoire. Pour la production, vous pouvez préparer un fichier `.env` avec les URLs et tokens de votre choix, puis les reporter dans l'interface.

### Build & tests
```bash
npm run lint
npm run build
```

### Déploiement Vercel
Le projet est prêt pour Vercel (`npm run build` doit réussir). Une fois le token configuré :
```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-5a623f7b
```

### Licence
MIT — utilisation, modification et déploiement autorisés sans restriction.

