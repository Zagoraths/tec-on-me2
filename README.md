# 🚌 Tec on Me !

**Tec on Me** est une application web interactive et pédagogique permettant de localiser les arrêts de bus TEC (Belgique) autour de soi, de visualiser le tracé des lignes et de calculer son itinéraire piéton.

---

## 📌 Table des matières
1. [Aperçu du projet](#-aperçu-du-projet)
2. [Structure des fichiers](#-structure-des-fichiers)
3. [Fonctionnement des APIs (Requêtes AJAX)](#-fonctionnement-des-apis-requêtes-ajax)
4. [Installation et usage](#-installation-et-usage)
5. [Détails Techniques (UX/UI)](#-détails-techniques-uxui)

---

## 🧐 Aperçu du projet

L'application propose deux modes d'entrée :
- **Mode Géolocalisation** : Utilise le GPS du navigateur pour une précision maximale.
- **Mode Par défaut** : Positionne l'utilisateur à Neuville si le GPS est refusé ou indisponible.

Une fois la carte affichée, l'utilisateur peut ajuster un curseur de distance (1 à 10 km) pour scanner les arrêts environnants. Chaque arrêt cliqué déclenche un calcul d'itinéraire piéton "temps réel".



---

## 📁 Structure des fichiers

- `index.html` : Porte d'entrée gérant le choix de l'expérience utilisateur via un formulaire HTML natif.
- `carte.html` : Interface principale hébergeant la carte Leaflet.
- `main.js` : Chef d'orchestre. Il lit les paramètres d'URL, initialise les composants et gère les événements (curseur, boutons).
- `inc/geo.js` : Cœur logique (Classe `Geo`). Contient toute l'intelligence liée à Leaflet et aux appels API.
- `inc/box.js` : Utilitaire gérant les interactions de fermeture (modales, alertes).
- `styles/style.css` : Contient l'habillage graphique et les correctifs pour l'affichage fixe des popups.

---

## 🚀 Fonctionnement des APIs (Requêtes AJAX)

Le projet orchestre trois APIs distinctes via la méthode `fetch()`.

### 1. Liste des arrêts (ODWB - Open Data Wallonie)
Cette API est interrogée pour peupler la carte en marqueurs.
- **Utilisation** : Dans `loadStops()`.
- **Logique** : Elle reçoit une longitude, une latitude et un rayon (distance). Elle renvoie un JSON contenant tous les arrêts TEC correspondants.
- **Extrait de requête** :
  `where=within_distance(coordinates, geom'POINT(${lon} ${lat})', ${this.distance}km)`

### 2. Passages des bus (API Locale / Cepegra)
Permet de lister les lignes de bus s'arrêtant à un point précis.
- **Utilisation** : Au clic sur un marqueur d'arrêt.
- **Données récupérées** : Nom de la ligne, destination et `shape_id` (identifiant unique du tracé de la route).

### 3. Itinéraire piéton (OSRM - Open Source Routing Machine)
Calcul le chemin le plus court en suivant les rues praticables.
- **Utilisation** : Dans `getWalkingRoute()`.
- **Algorithme** : L'API renvoie une géométrie (GeoJSON) pour le tracé bleu et une distance en mètres.
- **Calcul de temps** : La distance est divisée par une base de 75m/min pour afficher une estimation réaliste à l'utilisateur.



---

## 🛠 Installation et usage

1. **Clonage** : Copiez les fichiers sur votre environnement local.
2. **Serveur Local** : Utilisez un serveur (ex: Live Server sur VS Code) pour ouvrir `index.html`. 
   > *Note : Le GPS nécessite un contexte sécurisé (localhost ou HTTPS).*
3. **Navigation** : 
   - Choisissez votre mode sur la page d'accueil.
   - Ajustez la distance via le curseur en bas de l'écran.
   - Cliquez sur un arrêt pour voir le trajet à pied et les bus disponibles.

---

## 🎨 Détails Techniques (UX/UI)

- **Gestion des Calques (Layers)** : Gestion granulaire via les Calques (Layers) : L'utilisation de L.layerGroup() permet de segmenter les données (arrêts, tracés de bus, itinéraires piétons). Cela offre une manipulation chirurgicale de l'affichage : on peut réinitialiser spécifiquement le tracé piéton lors d'un nouveau clic sans perturber les autres éléments visuels déjà présents.
- **Popups Fixes** : Un traitement CSS spécifique force les popups Leaflet à s'afficher sous forme de bandeau fixe en haut de l'écran pour une ergonomie "Mobile First".
- **Délégation d'événements** : Les clics sur les liens de bus (générés dynamiquement) sont capturés par un écouteur global sur le conteneur de la carte pour optimiser les performances.

---
*Projet réalisé dans le cadre du Bootcamp Front-End.*


# Plus en détails techniques
