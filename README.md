# TrackFlow

Systeme de suivi de colis avec QR codes et notifications SMS.

## Fonctionnalites

- Gestion des colis (CRUD) avec codes de suivi uniques
- Generation de QR codes pour chaque colis
- Scan des colis aux points de transit
- Notifications SMS (Twilio ou mode console)
- Interface d'administration web
- Suivi public par code de tracking
- Authentification JWT avec roles (admin, operator, readonly)

## Stack technique

- **Backend** : Node.js, Express 5
- **Base de donnees** : SQLite (better-sqlite3)
- **Frontend** : HTML/CSS/JS (vanilla)
- **QR Codes** : qrcode
- **Auth** : JWT + bcryptjs

## Installation locale

```bash
npm install
cp .env.example .env
# Modifier .env selon vos besoins
npm start
```

L'application demarre sur `http://localhost:3000`.

### Identifiants par defaut

- **Utilisateur** : `admin`
- **Mot de passe** : `admin`

> Changez le mot de passe admin en production.

## Variables d'environnement

| Variable | Description | Defaut |
|---|---|---|
| `PORT` | Port du serveur | `3000` |
| `TRACKFLOW_DB_PATH` | Chemin vers la base SQLite | `data/trackflow.db` |
| `JWT_SECRET` | Secret pour les tokens JWT | (requis) |
| `JWT_EXPIRES_IN` | Duree de validite des tokens | `24h` |
| `SMS_PROVIDER` | Provider SMS (`console` ou `twilio`) | `console` |
| `TWILIO_ACCOUNT_SID` | SID du compte Twilio | - |
| `TWILIO_AUTH_TOKEN` | Token Twilio | - |
| `TWILIO_FROM_NUMBER` | Numero d'envoi Twilio | - |

## Deploiement

### Docker

```bash
docker-compose up -d
```

### Vercel

Le projet est configure pour Vercel via `vercel.json`. La base SQLite utilise `/tmp` en mode serverless (donnees ephemeres entre les invocations).

Pour un deploiement persistant, configurez `TRACKFLOW_DB_PATH` vers une base externe ou utilisez Docker/un VPS.

## Tests

```bash
npm test
```

## API

- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription (admin requis)
- `GET /api/parcels` - Liste des colis
- `POST /api/parcels` - Creer un colis
- `GET /api/parcels/:id` - Detail d'un colis
- `PATCH /api/parcels/:id/status` - Mettre a jour le statut
- `GET /api/parcels/track/:code` - Suivi public
- `POST /api/scan` - Scanner un colis (operator+)
- `GET /health` - Health check
