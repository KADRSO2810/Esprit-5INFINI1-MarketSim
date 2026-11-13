# Simulateur de Salle de Marché — Étape 7 : Trading Automatique, Strategy Lab & XAI

Monorepo complet du Simulateur de Salle de Marché avec **Spring Boot (backend)** + **React TypeScript (frontend)** + **Service AI FastAPI (Python)** + **MariaDB/MySQL (XAMPP)**.

Cette **Étape 5** ajoute un module complet de **Stress Testing Bancaire par Intelligence Artificielle** avec **Explainable AI (XAI)** basé sur les valeurs SHAP (TreeExplainer).
Le système repose sur des **données réelles importées par l'utilisateur (CSV)** (zéro donnée inventée comme résultat) et permet d'évaluer la résilience des institutions financières sous des chocs macroéconomiques adverses, tout en comparant les banques conventionnelles et non-conventionnelles.

---

## Architecture Globale du Monorepo

```
market_simulator/
├── backend/                              # Orchestration, Sécurité JWT, Persistance & API REST (Port 8081)
│   ├── mvnw & mvnw.cmd                   # Maven Wrapper
│   ├── pom.xml                           # Spring Boot 3.3.4, Java 21/22, SpringDoc, Flyway
│   └── src/
│       ├── main/
│       │   ├── java/com/marketsimulator/
│       │   │   ├── domain/               # Bank, BankObservation, StressModel, StressScenario, StressRun, StressResult, XaiExplanation
│       │   │   ├── repository/           # BankRepository, StressModelRepository, StressRunRepository, ...
│       │   │   ├── service/              # StressTestingService, BankDataImportService, AiServiceClient, ...
│       │   │   ├── controller/           # StressController, AdminStressController, BacktestController, ...
│       │   │   └── dto/                  # BankImportStats, TrainModelRequest, StressRunDetailDto, XaiExplanationDto...
│       │   └── resources/
│       │       ├── application.yml       # Configuration applicative, DB, finnhub, ai-service
│       │       ├── templates/            # bank_stress_template.csv (Template d'import sans fausses données)
│       │       └── db/migration/
│       │           ├── V1__create_users_table.sql
│       │           ├── V2__market_data_tables.sql
│       │           ├── V3__paper_trading_tables.sql
│       │           ├── V4__candles_and_backtesting.sql
│       │           └── V5__stress_testing_tables.sql
│       └── test/                         # 20 tests automatisés JUnit / MockMvc (100% BUILD SUCCESS)
├── ai-service/                           # Microservice Python d'entraînement ML & XAI SHAP (Port 8090)
│   ├── requirements.txt                  # fastapi, uvicorn, scikit-learn, shap, pandas, numpy, joblib
│   ├── main.py                           # Endpoints /train, /predict, /explain, /health
│   ├── explainer.py                      # Moteur SHAP TreeExplainer & calculs XAI global/local
│   └── model_store.py                    # Gestion et persistance mémoire/cache des modèles entraînés
├── frontend/                             # Single Page Application React 18 / TypeScript / Tailwind (Port 5173)
│   ├── src/
│   │   ├── api/                          # stress.ts, backtest.ts, trading.ts, market.ts, auth.ts
│   │   ├── components/                   # XaiWaterfallModal.tsx, EquityChart.tsx, PortfolioPanel.tsx, RiskMeter.tsx
│   │   ├── pages/                        # StressTesting.tsx (/app/stress-testing), Backtesting.tsx, Dashboard.tsx
│   │   └── App.tsx                       # React Router avec routes protégées
│   └── package.json
└── README.md
```

---

## Fonctionnalités Clés — Étape 5 (AI Stress Testing & XAI)

1. **Importation & Validation de Données Financières (CSV)** :
   - Template CSV fourni dans `/backend/src/main/resources/templates/bank_stress_template.csv` et téléchargeable en un clic via l'interface.
   - Validation stricte des colonnes obligatoires (`bank_name`, `country`, `bank_type`, `period_date`), typage des banques (`CONVENTIONAL` vs `NON_CONVENTIONAL`), extraction automatique de toutes les features numériques et variables cibles candidates (`expected_loss`, `cet1_ratio`, `npl_ratio`, etc.).
   - Protection du endpoint d'import par rôle **ADMIN**.

2. **Entraînement de Modèles Supervisés par le Service IA (FastAPI)** :
   - Support de plusieurs algorithmes ML : **Random Forest Regressor**, **Gradient Boosting**, **Ridge Regression**.
   - Calcul des métriques de précision hors-échantillon : **MAE**, **RMSE**, **R²**.
   - Sérialisation et mise en cache des modèles entraînés via `joblib`.

3. **Générateur de Scénarios Macroéconomiques de Stress** :
   - Définition de chocs adverses par variable (deltas $\Delta$ sur taux d'intérêt, croissance PIB, chômage, inflation, dépréciation FX...).
   - Préréglages en un clic :
     - *Crise Stagflationniste 2026* : Taux `+300 bps`, Inflation `+4.0%`, PIB `-3.0%`, Chômage `+2.5%`.
     - *Choc Taux BCE* : Taux `+350 bps`, Dépôts `-4.0%`, Crédits `-2.0%`.
     - *Crise Immobilière & Défauts* : NPL `+4.0%`, PIB `-3.5%`, Chômage `+3.0%`, FX `+5.0%`.

4. **Simulation & Agrégations "WOW"** :
   - Exécution asynchrone (`@Async`) : calcul de la Baseline (sans choc) et de la prédiction sous stress pour chaque banque.
   - **Comparaison Conventionnelles vs Non-Conventionnelles** :
     - Impact moyen ($\Delta$), déviation, et ratio de résilience comparative entre les deux modèles bancaires.
   - Classement des banques les plus vulnérables par ordre de risque.

5. **Explainable AI (XAI avec SHAP)** :
   - **Explication Globale** : Importance relative de chaque variable macroéconomique sur l'échantillon complet via valeurs SHAP moyennes (TreeExplainer).
   - **Explication Locale par Banque (Waterfall Modal)** : Décomposition précise des contributions positives (aggravation du risque) et négatives (effet amortisseur) pour chaque observation bancaire.

---

## Configuration & Variables d'Environnement

| Variable | Description | Port / Valeur par défaut |
| :--- | :--- | :--- |
| `SERVER_PORT` | Port d'écoute Spring Boot | `8081` |
| `AI_SERVICE_URL` | URL interne du microservice IA | `http://localhost:8090` |
| `MAX_LOCAL_XAI_BANKS`| Nombre max de banques expliquées en détail local | `10` |
| `DB_HOST` | Hôte MariaDB (XAMPP) | `localhost` |
| `DB_PORT` | Port MariaDB | `3306` |
| `DB_NAME` | Nom de la base de données | `market_simulator` |
| `FINNHUB_API_KEY` | Clé d'API Finnhub | `db6bck9r01qmd5lj8b6gdb6bck9r01qmd5lj8b70` |
| `JWT_SECRET` | Clé secrète de signature HMAC | *(intégrée en configuration dev)* |

---

## Guide de Démarrage Rapide

### 1. Démarrer MariaDB (XAMPP)
Vérifiez que le service MySQL/MariaDB est démarré sur le port `3306` (via le panneau de configuration XAMPP). Les migrations Flyway `V1` à `V5` s'appliquent automatiquement au démarrage du backend.

### 2. Démarrer le Service IA (FastAPI, Port 8090)

```powershell
cd ai-service

# Création et activation de l'environnement virtuel Python
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Installation des dépendances ML
pip install -r requirements.txt

# Lancement du serveur FastAPI
uvicorn main:app --port 8090
```
- Healthcheck IA : [http://localhost:8090/health](http://localhost:8090/health)
- Documentation Swagger IA : [http://localhost:8090/docs](http://localhost:8090/docs)

### 3. Démarrer le Backend Spring Boot (Port 8081)

```powershell
cd backend
$env:JAVA_HOME = "C:\Program Files\Java\jdk-22"
.\mvnw.cmd spring-boot:run
```
*Ou directement depuis votre IDE (IntelliJ IDEA) en lançant `MarketSimulatorApplication`.*

- Swagger UI Backend : [http://localhost:8081/swagger-ui/index.html](http://localhost:8081/swagger-ui/index.html)

### 4. Démarrer le Frontend React (Port 5173)

```powershell
cd frontend
npm run dev
```
- Application Web : [http://localhost:5173](http://localhost:5173)

---

## Contrats d'API — Nouveaux Endpoints Étape 5

### 1. Administration & Ingestion (Réservé ADMIN)
- `POST /api/admin/stress/import` : Envoi multipart d'un fichier CSV. Retourne les statistiques d'ingestion (`totalRows`, `importedRows`, `newBanksCount`, `errors`, `detectedFeatures`, `detectedTargets`).
- `POST /api/admin/stress/models/train` : Entraîne un modèle ML sur les données importées via le service IA.
  ```json
  {
    "name": "RandomForest-ExpectedLoss-v1",
    "modelType": "RANDOM_FOREST",
    "targetKey": "expected_loss",
    "featureKeys": ["interest_rate", "gdp_growth", "unemployment_rate", "cet1_ratio", "npl_ratio"]
  }
  ```
- `GET /api/admin/stress/template` : Télécharge le template CSV officiel.

### 2. Simulations & XAI (Accès USER / ADMIN)
- `GET /api/stress/template` : Téléchargement direct du template CSV.
- `GET /api/stress/banks` : Liste des banques enregistrées et nombre d'observations disponibles.
- `GET /api/stress/models` : Liste des modèles ML entraînés avec métriques ($MAE$, $RMSE$, $R^2$).
- `GET /api/stress/scenarios` : Liste des scénarios de choc macroéconomique.
- `POST /api/stress/scenarios` : Création d'un scénario personnalisé.
  ```json
  {
    "name": "Choc Taux & Récession",
    "description": "Hausse des taux et contraction de l'activité",
    "shocks": {
      "interest_rate": 0.035,
      "gdp_growth": -0.025,
      "unemployment_rate": 0.02
    }
  }
  ```
- `POST /api/stress/runs` : Lancement asynchrone d'un stress test (`{ "scenarioId": 1, "modelId": 1 }`).
- `GET /api/stress/runs` : Historique des runs de l'utilisateur connecté.
- `GET /api/stress/runs/{id}` : Détails d'un run, métriques agrégées, comparaison Conventionnelles vs Non-Conventionnelles, et résumé XAI global.
- `GET /api/stress/runs/{id}/results` : Liste détaillée des prédictions (Baseline, Stressed, Delta $\Delta$, Risk Score) pour chaque banque.
- `GET /api/stress/runs/{id}/xai?type=LOCAL&bankId=1` : Explication SHAP détaillée (waterfall des contributions) pour une banque ciblée.

---

## Parcours de Démonstration Étape 5

1. **Connexion & Navigation** :
   - Connectez-vous sur [http://localhost:5173/login](http://localhost:5173/login).
   - Cliquez sur l'onglet **Stress Test** (icône bouclier d'alerte) dans la barre de navigation supérieure pour accéder à `/app/stress-testing`.

2. **Étape A : Importation des Données Bancaires** :
   - Ouvrez l'onglet **Import CSV**.
   - Cliquez sur **Template CSV** pour récupérer la structure officielle.
   - Sélectionnez ou déposez votre fichier CSV (ex: observations réelles trimestrielles).
   - Cliquez sur **Valider & Importer** : visualisez le rapport d'import (lignes importées, détection automatique des features et des banques).

3. **Étape B : Entraînement du Modèle IA** :
   - Rendez-vous sur l'onglet **Modèles ML**.
   - Choisissez l'algorithme (**Random Forest** ou **Gradient Boosting**) et la variable cible (ex: `expected_loss`).
   - Cliquez sur **Lancer l'Entraînement IA** : le service FastAPI entraîne le modèle et retourne instantanément les scores de précision (MAE, RMSE, R²).

4. **Étape C : Configuration du Scénario Adverse** :
   - Ouvrez l'onglet **Scénarios**.
   - Cliquez sur l'un des préréglages (ex: *Stagflation 2026*) ou ajustez vos propres curseurs de choc ($\Delta$ Taux, $\Delta$ PIB, $\Delta$ Chômage).
   - Cliquez sur **Enregistrer le Scénario**.

5. **Étape D : Exécution de la Simulation & Résultats "WOW"** :
   - Ouvrez l'onglet **Simulations**.
   - Sélectionnez votre scénario et votre modèle, puis cliquez sur **Lancer le Stress Test AI**.
   - Le statut passe à `RUNNING` puis `DONE` en direct.
   - Observez les KPI agrégés :
     - **Impact Moyen Global** sous stress.
     - **Comparaison Conventionnelles vs Non-Conventionnelles** : comparez côte-à-côte les impacts moyens et la résilience relative.
     - **Importance Globale XAI (SHAP)** : visualisez quelles variables macroéconomiques pèsent le plus lourd dans les pertes estimées.
   - Dans le tableau des banques, cliquez sur **Expliquer** en face d'une banque :
     - La fenêtre modale **Waterfall SHAP** s'ouvre et détaille feature par feature la contribution exacte au stress de cette institution bancaire.


---

## Crisis Replay Mode — COVID-19 2020 (Étape 4bis)

Le **Crisis Replay Mode** permet à un utilisateur de revivre en temps réel accéléré la période historique du krach boursier et de la reprise COVID-19 (01/02/2020 → 01/11/2020) et de trader comme s'il était sur les marchés à cette époque.

### 🛡️ Principes et Exigences de Réalisme
- **Zéro Fake Price / Zéro prix simulé** : tous les ticks et bougies rejoués proviennent exclusivement des données historiques réelles Finnhub (`/stock/candle`) préalablement stockées en base MariaDB (`market_candles`).
- **Simulation temporelle pure** : seule la progression temporelle est accélérée, jamais les prix de marché.
- **Portefeuille de trading isolé (`sessionId`)** : les ordres d'achat/vente en session replay sont exécutés strictement au dernier prix replay diffusé et n'impactent pas le portefeuille de live trading (`sessionId = 0`).

### ⚙️ Architecture & Contrôles
- **Horloge virtuelle (`ReplayEngineService`)** : ticks réguliers (`@Scheduled`) diffusés sur WebSocket STOMP :
  - `/topic/replay/{sessionId}/clock` : statut, vitesse (`1x`, `5x`, `20x`, `60x`, `120x`), date/heure simulée.
  - `/topic/replay/{sessionId}/quotes` : ticks et bougies réelles horodatées au timestamp simulé.
- **Contrôles interactifs** : Play, Pause, Resume, Stop, Changement de vitesse, et Scrubber temporel (Seek).

### 📡 Contrats d'API Replay
- `GET /api/replay/scenarios` : Liste les scénarios de crise préconfigurés (ex: `COVID_2020`).
- `POST /api/replay/sessions` : Initialise une nouvelle session avec backfill automatique des candles réelles Finnhub vers MariaDB.
- `GET /api/replay/sessions` : Liste les sessions de l'utilisateur connecté.
- `GET /api/replay/sessions/{id}` : Récupère l'état et l'avancement d'une session.
- `POST /api/replay/sessions/{id}/control` : Envoie une commande (`PLAY`, `PAUSE`, `RESUME`, `STOP`, `SEEK`, `SET_SPEED`).
- `POST /api/orders/market?sessionId={id}` : Exécute un ordre de paper trading au dernier cours de la session replay (renvoie `409 Conflict` si aucun cours récent dans la fenêtre simulée).
- `GET /api/portfolio/summary?sessionId={id}` : Vue PnL et balance cash isolée à la session replay.

---

## Étape 6 : Sentiment Analysis & News Timeline "WOW" (100% Données Réelles)

L'**Étape 6** intègre un flux complet d'actualités financières réelles (**Finnhub REST Company News & Market News**) associé à un moteur d'**Analyse de Sentiment par IA (FinBERT)** et d'**Explication XAI des mots-clés déterminants**, le tout profondément synchronisé avec le mode **Crisis Replay COVID-19 2020**.

### 🛡️ Contraintes & Zéro Donnée Fake
- **Sources 100% officielles** : Toutes les dépêches proviennent de l'API officielle Finnhub (`/company-news` et `/news`).
- **Sécurité** : `FINNHUB_API_KEY` reste exclusivement confinée au backend Spring Boot et n'est jamais exposée au client.
- **Cache MariaDB (`news_articles`, `news_symbols`, `news_sentiments`)** : Évite les dépassements de quota et permet la réutilisation instantanée des dépêches et des scores de sentiment.
- **Analyse IA (Python FastAPI)** :
  - Endpoint `POST /sentiment/analyze` sur le port `8090`.
  - Inférence FinBERT avec probabilities (`positive`, `neutral`, `negative`).
  - **Explainable AI (XAI)** : Extraction des tokens textuels les plus influents (`topTokens` avec poids d'impact et direction positive/négative).

### 🎬 Intégration Forte avec le Mode Crisis Replay (COVID-19 2020)
Pendant une session de Replay :
- L'utilisateur peut basculer sur l'onglet **"Dépêches & Sentiment IA (FinBERT)"**.
- L'endpoint `GET /api/replay/{sessionId}/news?windowDays=3` renvoie les actualités publiées autour de la **date simulée courante** de l'horloge virtuelle.
- En avançant dans le temps ou en sautant vers un jalon historique (ex: *16 Mars 2020 - Black Monday II* ou *23 Mars 2020 - Annonce Fed illimitée*), les titres de presse changent en direct pour refléter le sentiment des marchés à cette date précise.

### 📡 Nouveaux Endpoints REST Backend (JWT requis)
- `GET /api/news?symbol=AAPL&from=2020-02-01&to=2020-11-01&refresh=false` : Récupère les actualités d'un actif avec sentiment et XAI.
- `POST /api/news/sentiment/recompute?articleId=12` : Recalcule le sentiment IA pour un article spécifique.
- `POST /api/news/sentiment/recompute-batch` : Calcule en lot le sentiment IA pour les articles sans score.
- `GET /api/replay/{sessionId}/news?windowDays=3` : Dépêches synchronisées à l'horloge virtuelle du Replay.

---

## Guide de Démarrage & Procédure de Démo Complète

### 1. Démarrer MariaDB
- Ouvrez le panneau de contrôle **XAMPP** et démarrez le service **MySQL** (port `3306`).

### 2. Démarrer le Backend (Spring Boot :8081)
- Dans **IntelliJ IDEA** : ouvrez le projet `backend`, faites `Build → Rebuild Project`, puis lancez `MarketSimulatorApplication` (Run ▶️).
- Ou en terminal :
  ```powershell
  cd backend
  $env:JAVA_HOME = "C:\Program Files\Java\jdk-22"
  .\mvnw.cmd spring-boot:run
  ```
- Vérification : `http://localhost:8081/swagger-ui/index.html`

### 3. Démarrer l'AI Service (FastAPI :8090) + Frontend (Vite :5173)
- Dans le terminal VS Code à la racine du projet :
  ```powershell
  .\start-ai-front.ps1
  ```
  *(Ou dans VS Code : `Ctrl + Shift + B` → "Start AI Service + Frontend")*
- Vérification AI Service : `http://localhost:8090/health` (doit renvoyer `{"status": "UP"}`)
- Application Frontend : `http://localhost:5173`

### 4. Parcours de Démonstration "WOW" (Étape 6)
1. Rendez-vous sur `http://localhost:5173` et connectez-vous (`trader@marketsim.com` / `Trader123!`).
2. **Page News & Sentiment dédiée** (`/app/news`) :
   - Sélectionnez un symbole (ex: `AAPL`, `MSFT`, `SPY`).
   - Cliquez sur **Rafraîchir** pour ingérer les dépêches Finnhub réelles.
   - Cliquez sur **Analyser Sentiment (Lot)** pour voir apparaître les badges FinBERT et la distribution Positif/Neutre/Négatif.
   - Cliquez sur un article : la modale XAI s'ouvre avec la barre de probabilité et les **mots-clés déterminants (topTokens)**.
3. **Mode Crisis Replay COVID-19 avec News Synchronisées** (`/app/replay`) :
   - Lancez ou rejoignez une session Replay COVID-19.
   - Basculez sur l'onglet **"Dépêches & Sentiment IA (FinBERT)"**.
   - Avancez l'horloge ou cliquez sur un jalon historique (ex: *16 Mars 2020*) : constatez que les actualités affichées correspondent exactement à l'ambiance de panique sanitaire et de krach boursier de cette période !


---

## Étape 7 : Agent de Trading Automatique (Paper) + Strategy Lab + Explainability (XAI)

L'Étape 7 dote la plateforme d'un **Agent de Trading Automatique** et d'un **Laboratoire de Stratégies Algorithmiques (Strategy Lab)** avec explicabilité en temps réel (XAI) et exécution Paper Trading sécurisée.

### 🛡️ Principes & Zéro Donnée Simulée
- **Données 100% Réelles** : Tous les signaux sont calculés exclusivement à partir des cours réels ingérés en direct (cache live Finnhub WebSocket / ticks MariaDB) ou des cours réels historiques de la session Replay COVID-19. **Aucun prix n'est inventé ou simulé.**
- **Agrégateur de Candles Live sans Quota (`LiveCandleAggregatorService`)** : Construit des chandeliers 1 minute réels à partir du flux de ticks haute fréquence (`market_quotes`) toutes les 10 secondes, sans consommer le moindre quota d'API REST Finnhub.
- **Sécurité & Risk Management Automatisé** :
  - Plafond d'exposition maximale (`maxExposurePct`, ex: 40% de l'équité totale).
  - Période de cooldown (60 secondes) entre deux passages d'ordre pour éviter le sur-trading.
  - Sizing de position configurable (`FIXED_NOTIONAL`).
  - Validation pré-ordre via le moteur de risque de l'`OrderService`.

### 🧠 Stratégies Algorithmiques Disponibles
1. **SMA Cross (`SMA_CROSS`)** :
   - Détection des croisements Golden Cross (SMA rapide croise au-dessus de la SMA lente $\rightarrow$ **BUY**) et Death Cross (SMA rapide croise en-dessous $\rightarrow$ **SELL**).
2. **RSI Rebound (`RSI`)** :
   - Indice de force relative sur $N$ périodes (défaut 14).
   - Rebond depuis zone de survente ($< 30$) $\rightarrow$ **BUY**.
   - Repli depuis zone de surachat ($> 70$) $\rightarrow$ **SELL**.
3. **SMA Cross + Sentiment IA FinBERT (`SMA_SENTIMENT`)** :
   - Stratégie hybride technique + fondamentale.
   - Les croisements SMA sont conditionnés par le score de sentiment FinBERT des dépêches de presse réelles des dernières 24h. Un signal d'achat est validé uniquement si le sentiment de marché est positif ou neutre ; un signal de vente est validé si le sentiment est négatif ou neutre.

### 🔬 Explainable AI (XAI) pour chaque Signal
Chaque signal généré émet une explication détaillée comprenant :
- Les valeurs réelles observées (prix spot, SMA Fast, SMA Slow, RSI, FinBERT sentiment score).
- Les seuils déclencheurs et deltas calculés.
- Les facteurs de décision avec polarité (haussière, baissière, neutre) et poids d'influence normalisé.
- La modale XAI (`SignalExplanationModal.tsx`) permet à l'utilisateur de comprendre la logique exacte de l'algorithme.

### 📡 Nouveaux Endpoints REST Backend (`/api/strategies`) — JWT Requis
- `POST /api/strategies` : Création d'une nouvelle stratégie (mode `LIVE` ou `REPLAY`).
- `GET /api/strategies` : Liste de toutes les stratégies de l'utilisateur.
- `GET /api/strategies/{id}` : Détails d'une stratégie.
- `PUT /api/strategies/{id}` : Mise à jour des paramètres ou bascule de l'auto-trading.
- `DELETE /api/strategies/{id}` : Suppression d'une stratégie.
- `POST /api/strategies/{id}/start` : Démarrage du moteur d'évaluation périodique.
- `POST /api/strategies/{id}/stop` : Arrêt du moteur.
- `GET /api/strategies/{id}/signals` : Historique des signaux avec métadonnées XAI.
- `GET /api/strategies/{id}/executions` : Historique des ordres paper trading exécutés automatiquement.
- `GET /api/strategies/{id}/performance` : Métriques de performance (PnL réalisé, PnL latent, win-rate, profit factor, exposition).

### ⚡ Flux WebSocket STOMP Temps Réel
- `/topic/strategies/{id}/signals` : Réception instantanée des signaux générés dès qu'un tick déclenche une condition.
- `/topic/strategies/{id}/status` : Notification des transitions d'état (`ACTIVE`, `STOPPED`, `ERROR`).

---
