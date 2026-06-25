# Osuny Manager

Interface web locale pour gérer vos sites Osuny.

## Installation

```bash
cd osuny-manager
npm install
```

## Démarrage

```bash
npm start
# ou en mode dev (rechargement auto) :
npm run dev
```

Ouvrez ensuite **http://localhost:3000**

## Configuration

Au premier lancement, allez dans **Paramètres** et configurez :

- **Chemin racine** : le dossier qui contient tous vos sites Osuny  
  Ex : `/home/user/sites` ou `/var/www`

- **Clé API PageSpeed** (optionnel) : sans clé, les requêtes sont limitées à ~25/jour.  
  Créez une clé sur https://developers.google.com/speed/docs/insights/v5/get-started

## Fonctionnalités

### Sites
- Découverte automatique de tous les sites Osuny dans le répertoire racine
- Affichage du statut des submodules (ok / modifié / non initialisé)
- Sélection multiple pour les opérations en lot

### Submodules
- **Mise à jour** (`git submodule update --remote --merge`) sur les sites sélectionnés
- **Initialisation** (`git submodule update --init --recursive`)
- Sortie en temps réel via WebSocket
- Ciblage d'un submodule spécifique (thème ou sous-thème)

### Tests
Tous les tests supportent un **échantillonnage automatique** depuis les sites sélectionnés.

- **W3C** : validation HTML via validator.w3.org/nu
- **Schema.org** : validation des données structurées via validator.schema.org
- **PageSpeed** : scores Lighthouse (Performance, Accessibilité, SEO, Bonnes pratiques) + Core Web Vitals

## Structure

```
osuny-manager/
├── src/
│   └── server.js        # Serveur Express + WebSocket
├── public/
│   └── index.html       # Interface utilisateur
├── data/
│   └── config.json      # Configuration persistante (auto-créé)
└── package.json
```

## Variables d'environnement

```bash
PORT=3000          # Port du serveur (défaut: 3000)
SITES_ROOT=/sites  # Chemin par défaut des sites
```
