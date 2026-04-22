/**
 * =============================================================================
 * TABLE DES MATIÈRES
 * =============================================================================
 * 1. CONSTRUCTEUR & CONFIGURATION ........ Initialisation et état global
 * 2. GESTION DES ICÔNES .................. Création des marqueurs personnalisés
 * 3. SYSTÈME DE GÉOLOCALISATION .......... GPS, Permissions et Secours
 * 4. MOTEUR DE CARTE (LEAFLET) ........... Création et gestion des calques
 * 5. CHARGEMENT DES DONNÉES (API) ........ Récupération des arrêts (ODWB)
 * 6. RENDU ET POPUPS ..................... Affichage des marqueurs et bus
 * =============================================================================
 */

/**
 * RESPONSIVE & UX NOTES
 * - The app is adapted for mobile/tablet/desktop via CSS only (see styles/map.css).
 * - JS behavior is unchanged: we keep map logic, markers and panels. CSS repositions
 *   controls (distance slider, favorites panel, info panel) to improve touch
 *   ergonomics on small screens (larger tap targets, bottom-accessible panels).
 * - We avoided structural HTML changes to preserve existing selectors used by JS.
 * - Favorites now store structured objects {id, number, name} to let the UI show
 *   "Numéro — Nom" in the favorites panel; code still supports legacy string-only
 *   favorites for backward compatibility.
 * - Performance choices: images used in alerts are lazy-loaded; heavy layout
 *   changes are done via CSS media queries to avoid runtime JS repositioning.
 */

class Geo {
    /**
     * 1. CONSTRUCTEUR & CONFIGURATION
     * Prépare les variables de base dont l'application a besoin pour fonctionner.
     */
    constructor($mapBox) {
        // L'adresse de notre serveur qui contient les données des lignes de bus
        this.urlApi = 'https://cepegra-frontend.xyz/bootcamp';
        
        // Références aux éléments HTML (la div de la carte et le bouton)
        this.$mapBox = $mapBox;
        
        // État de l'application : on stocke la carte et la distance de recherche
        this.map = null;          // Contiendra l'objet Leaflet une fois créé
        this.distance = 1;        // Rayon de recherche par défaut (1km)
        this.lastPosition = null; // Stocke les dernières coordonnées pour les calculs
        
        // --- LES CALQUES (LAYER GROUPS) ---
        // On crée des "tiroirs" pour ranger nos éléments.
        // Cela permet de vider un tiroir (ex: les arrêts) sans effacer la carte elle-même.
        this.layers = {
            stops: L.layerGroup(),   // Pour les icônes d'arrêts de bus
            route: L.layerGroup(),   // Pour le tracé rouge du bus
            click: L.layerGroup(),   // Pour le marqueur créé par clic
            walking: L.layerGroup(), // Pour le tracé à pied (OSRM)
        };
        this.activeMarker = null; // Pour stocker le marqueur de la position cliquée (si besoin)
        this.userMarker = null; // Marqueur de la position de l'utilisateur (ne doit jamais disparaître)
        this.clickMarker = null; // Marqueur du dernier clic sur la carte

        // Écouteur global pour les lignes de bus (Délégation d'événement)
        // On écoute la zone de la carte : si on clique sur un lien avec la classe 'bus-link', on trace la ligne.
        // Remplace ton ancien écouteur par celui-ci :
        document.addEventListener('click', (e) => {
            // On vérifie si l'élément cliqué (ou l'un de ses parents) est un lien de bus
            const busLink = e.target.closest('.bus-link');
            
            if (busLink) {
                e.preventDefault();
                console.log("Chargement de la ligne :", busLink.dataset.shape);
                this.drawRoute(busLink.dataset.shape);
                
                // Optionnel : On peut fermer le panneau quand on clique sur une ligne
                // document.querySelector('#info-panel').classList.add('hidden');
            }
        });

        // Options pour la précision du GPS
        this.optionsMap = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
        
        // On lance la préparation des images des marqueurs
        this._initIcons();
    }

    /**
     * 2. GESTION DES ICÔNES
     * Définit l'apparence des marqueurs sur la carte (taille, point d'ancrage).
     */
    _initIcons() {
        const configCommune = {
            iconSize: [53, 53],    // Taille de l'image en pixels
            iconAnchor: [26, 53],  // Le point de l'image qui "touche" la coordonnée (le bas milieu)
            popupAnchor: [0, -50]  // Où la bulle d'info s'affiche par rapport au marqueur
        };

        this.icons = {
            stop: L.icon({ ...configCommune, iconUrl: './icons/icon-map-bus-stop.svg' }),
            start: L.icon({ ...configCommune, iconUrl: './icons/icon-map-bus-start.svg' }),
            end: L.icon({ ...configCommune, iconUrl: './icons/icon-map-bus-end.svg' }),
            user: L.icon({ ...configCommune, iconUrl: './icons/icon-map-user-location.svg' }),
            click: L.icon({ ...configCommune, iconUrl: './icons/icon-me.svg' })
        };
    }

    /**
     * 3. SYSTÈME DE GÉOLOCALISATION
     * Gère la demande d'autorisation et récupère la position de l'utilisateur.
     */
    async init() {
        try {
            // On vérifie si l'utilisateur a déjà donné sa permission
            const result = await navigator.permissions.query({ name: 'geolocation' });
            
            if (result.state === 'granted' || result.state === 'prompt') {
                // Si autorisé, on demande la position précise au navigateur
                navigator.geolocation.getCurrentPosition(
                    (pos) => this.createMap(pos), // Succès
                    (err) => this.errorPosition(err), // Erreur
                    this.optionsMap
                );
            } else {
                // Si refusé, on utilise la position de secours
                this._fallbackPosition();
            }
        } catch (error) {
            this._fallbackPosition();
        }
    }

    // Position par défaut (Neuville) si le GPS est inaccessible
    _fallbackPosition() {
        const dummyPos = { coords: { latitude: 50.112673, longitude: 4.418669 } };
        this.createMap(dummyPos);
    }

    // Affiche une erreur dans la console si le GPS échoue
    errorPosition(err) {
        console.warn(`Erreur de localisation (${err.code}): ${err.message}`);
    }

    // Permet de changer le rayon de recherche (ex: via le curseur range)
    setDistance(km) {
        this.distance = km;
        // Recharger dynamiquement les arrêts visibles selon le contexte courant
        // Si un pin de clic existe, on recharge autour de ce pin, sinon autour de la position courante
        if (this.clickMarker && this.clickMarker.getLatLng) {
            const latlng = this.clickMarker.getLatLng();
            this.loadStops({ coords: { latitude: latlng.lat, longitude: latlng.lng } });
        } else if (this.lastPosition) {
            this.loadStops(this.lastPosition);
        }
    }

    /**
     * 4. MOTEUR DE CARTE (LEAFLET)
     * Affiche la carte et configure les interactions de base.
     */
    createMap(position) {
        const { latitude, longitude } = position.coords;

        // Si une carte existe déjà, on la supprime pour éviter les bugs visuels
        if (this.map) this.map.remove();

        // On affiche la zone de la carte et on initialise Leaflet centrée sur nous
        this.$mapBox.classList.remove('hidde');
        this.map = L.map(this.$mapBox).setView([latitude, longitude], 17);

        // On ajoute le "fond de carte" (les images des rues)
        // NOTE: Thunderforest requires API keys and may be blocked on some devices or
        // hosts; use the public OpenStreetMap tiles as a reliable fallback for mobile.
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // On active nos "tiroirs" (calques) sur la carte
        this.layers.stops.addTo(this.map);
        this.layers.route.addTo(this.map);
        this.layers.click.addTo(this.map);
    this.layers.walking.addTo(this.map);

        // Marqueur fixe pour notre position initiale
        this.userMarker = L.marker([latitude, longitude], { icon: this.icons.user }).addTo(this.map);

        // On charge les arrêts autour de nous
        this.loadStops(position);
    // Préparer le panneau des favoris (UI)
    this.renderFavoritesPanel();
        
        // Gestion du clic sur la carte : pose d'un pin et chargement des arrêts autour de ce pin
        this.map.on('click', (e) => this._onMapClick(e.latlng));
    }

    /**
     * Clic sur la carte : création d'un pin, suppression de l'ancien et chargement
     * des arrêts autour du point cliqué. La position utilisateur (this.userMarker)
     * n'est jamais supprimée.
     */
    _onMapClick(latlng) {
        // Supprimer l'ancien marqueur de clic
        if (this.clickMarker) {
            this.layers.click.removeLayer(this.clickMarker);
            this.clickMarker = null;
        }

        // Créer le nouveau marqueur de clic
        this.clickMarker = L.marker([latlng.lat, latlng.lng], { icon: this.icons.click }).addTo(this.layers.click);

        // Mettre à jour lastPosition pour que les distances des arrêts soient calculées depuis le pin cliqué
        const fakePosition = { coords: { latitude: latlng.lat, longitude: latlng.lng } };

        // Charger les arrêts autour du point cliqué (cela efface automatiquement les arrêts précédents)
        this.loadStops(fakePosition, true);
    }

    /**
     * 5. CHARGEMENT DES DONNÉES (API)
     * Va chercher les arrêts de bus TEC réels via l'Open Data Wallonie-Bruxelles.
     */
    async loadStops(position, showClickMarker = false) {
        this.lastPosition = position; // Sauvegarde pour les calculs d'itinéraires piétons
        
        // Nettoyage avant de charger de nouveaux points
        this.layers.stops.clearLayers();
        // Masquer la boîte d'alerte au début du chargement ; elle sera affichée
        // seulement si aucun arrêt n'est trouvé.
        const $boxAlert = document.querySelector('.box-alert');
        if ($boxAlert) $boxAlert.classList.add('hidden');
        
        const { latitude, longitude } = position.coords;

        try {
            // URL complexe qui demande : "donne moi les arrêts dans un rayon de X km autour de ce point"
            const url = `https://www.odwb.be/api/explore/v2.1/catalog/datasets/le-tec-arrets-bus/records?limit=100&where=within_distance(coordinates, geom'POINT(${longitude} ${latitude})', ${this.distance}km)&order_by=distance(coordinates, geom'POINT(${longitude} ${latitude})')`;
            
            const response = await fetch(url);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                // Pour chaque arrêt trouvé par l'API, on crée son marqueur
                data.results.forEach(stop => this._renderStopMarker(stop));
                // S'il y avait un message d'alerte visible, on le masque
                if ($boxAlert) $boxAlert.classList.add('hidden');
            } else {
                // Si aucun arrêt, on affiche notre message d'alerte HTML
                if ($boxAlert) $boxAlert.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Erreur lors de la récupération des arrêts :", error);
        }
    }

    /**
     * 6. RENDU ET POPUPS
     * Crée physiquement les icônes d'arrêts et gère le contenu de la bulle d'info.
     */
    _renderStopMarker(stop) {
    const stopPos = L.latLng(stop.coordinates.lat, stop.coordinates.lon);
    const userPos = L.latLng(this.lastPosition.coords.latitude, this.lastPosition.coords.longitude);
    const distance = userPos.distanceTo(stopPos);
    const distText = distance > 1000 ? (distance / 1000).toFixed(1) + " km" : Math.round(distance) + " m";

    const marker = L.marker([stop.coordinates.lat, stop.coordinates.lon], { icon: this.icons.stop })
        .addTo(this.layers.stops);

    marker.on('click', async () => {
        // Si un autre marqueur était actif, on lui retire la classe
        if (this.activeMarker && this.activeMarker._icon) {
            this.activeMarker._icon.classList.remove('marker-active');
        }

        // On ajoute la classe au marqueur actuel
        marker._icon.classList.add('marker-active');
        
        // On mémorise que c'est lui le nouveau "chef"
        this.activeMarker = marker;
        // 1. Récupération des bus qui passent par l'arrêt (via notre API)
        const response = await fetch(`${this.urlApi}/bus/${stop.stop_name}/${stop.coordinates.lon}`);
        const data = await response.json();
        
        // Construire dynamiquement la liste des lignes (un item par bus)
        // et créer un bouton de favori par ligne (shape_id).
        const busListEl = document.createElement('div');
        busListEl.className = 'bus-list';
        let stopShapeId = null;
        if (data.code === 'ok') {
            data.content.forEach(bus => {
                if (bus.route_id) {
                    const item = document.createElement('div');
                    item.className = 'bus-item';

                    const a = document.createElement('a');
                    a.href = '#';
                    a.className = 'bus-link';
                    a.dataset.shape = bus.shape_id;
                    a.textContent = `${bus.route_short_name} - ${bus.route_long_name}`;

                    item.appendChild(a);

                    // Bouton favori spécifique à cette ligne (shape_id)
                    if (bus.shape_id) {
                        const shapeId = String(bus.shape_id);
                        if (!stopShapeId) stopShapeId = shapeId;
                        const lineFavBtn = document.createElement('button');
                        lineFavBtn.className = 'fav-btn';
                        // Déterminer un label lisible pour la ligne (court si possible)
                        const lineNumber = bus.route_short_name || bus.route_id || '';
                        const lineName = bus.route_long_name || '';
                        // Affiche un texte contextualisé : supprimer si déjà en favori, sinon ajouter
                        lineFavBtn.textContent = this.isFavorite(shapeId) ? 'Retirer des favoris' : 'Ajouter aux favoris';
                        // Ne pas désactiver : on permet le toggle (ajout / suppression)
                        lineFavBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            const result = this.toggleFavorite(shapeId, lineNumber, lineName);
                            if (result === 'added') {
                                lineFavBtn.textContent = 'Retirer des favoris';
                            } else if (result === 'removed') {
                                lineFavBtn.textContent = 'Ajouter aux favoris';
                            } else {
                                // en cas d'erreur, garder l'état précédent
                                console.warn('Impossible de basculer le favori pour', shapeId);
                            }
                        });
                        item.appendChild(lineFavBtn);
                    }

                    busListEl.appendChild(item);
                }
            });
        }

        // 2. Préparation du contenu du panneau
        const $panel = document.querySelector('#info-panel');
        $panel.innerHTML = `
            <span class="close-panel">&times;</span>
            <h4>${stop.stop_name}</h4>
            <hr>
        `;

        // Insérer la liste des lignes (avec boutons favori) dans le panneau
        $panel.appendChild(busListEl);

        // 3. Affichage (en retirant la classe hidden)
        $panel.classList.remove('hidden');

        // 5. Tracer le trajet à pied depuis la position utilisateur jusqu'à cet arrêt
        // On utilise OSRM public : router.project-osrm.org
        try {
            await this._drawWalkingRoute(stop);
            // Après tracé, extraire distance/durée si disponible
            // L'info sera ajoutée dans le panneau par _drawWalkingRoute
        } catch (err) {
            console.warn('OSRM route error', err);
        }

        // 4. Gestion de la fermeture
        $panel.querySelector('.close-panel').addEventListener('click', () => {
            $panel.classList.add('hidden');
            this.layers.walking.clearLayers(); // On efface le tracé bleu aussi
        });
    });
}

    /**
     * Dessine un itinéraire piéton entre la position utilisateur et l'arrêt fourni.
     * Utilise l'API OSRM publique (router.project-osrm.org).
     * Ajoute la polyline au calque `walking` et met à jour le panneau d'infos
     * avec la distance et la durée.
     */
    async _drawWalkingRoute(stop) {
        // Déterminer la position de départ : préférence pour this.userMarker
        let startLat, startLon;
        if (this.userMarker && this.userMarker.getLatLng) {
            const latlng = this.userMarker.getLatLng();
            startLat = latlng.lat;
            startLon = latlng.lng;
        } else if (this.lastPosition && this.lastPosition.coords) {
            startLat = this.lastPosition.coords.latitude;
            startLon = this.lastPosition.coords.longitude;
        } else {
            throw new Error('Position utilisateur inconnue');
        }

        const endLat = stop.coordinates.lat;
        const endLon = stop.coordinates.lon;

        // Construire l'URL OSRM (walking profile)
        const url = `https://router.project-osrm.org/route/v1/walking/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;

        // Nettoyer l'ancien tracé piéton
        try {
            this.layers.walking.clearLayers();
        } catch (e) { /* noop */ }

        const res = await fetch(url);
        if (!res.ok) throw new Error('OSRM response not ok');

        const json = await res.json();
        if (!json.routes || json.routes.length === 0) {
            throw new Error('Aucune route trouvée');
        }

        const route = json.routes[0];
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]); // [lat,lon]

        // Dessiner la polyline (bleu) pour le trajet piéton
        const line = L.polyline(coords, { color: '#007bff', weight: 5, opacity: 0.85 }).addTo(this.layers.walking);

        // Ajuster la vue pour montrer le trajet (sans masquer la position utilisateur)
        try {
            const bounds = line.getBounds();
            this.map.fitBounds(bounds, { padding: [50, 50] });
        } catch (e) { /* noop */ }

        // Mettre à jour le panneau d'infos avec distance et durée
        const $panel = document.querySelector('#info-panel');
        if ($panel) {
            const dist = route.distance; // en mètres
            const distText = dist >= 1000 ? (dist/1000).toFixed(1) + ' km' : Math.round(dist) + ' m';

            // On conserve l'estimation interne et on affiche aussi la durée estimée
            const estimatedSeconds = this._estimateWalkingTime(dist, 4);
            stop.estimated_walk_seconds = estimatedSeconds;
            const estMins = Math.floor(estimatedSeconds / 60);
            const estSecs = Math.round(estimatedSeconds % 60);
            const estText = estMins > 0 ? `${estMins} min ${estSecs} s` : `${estSecs} s`;

            // Ajoute/injecte une petite ligne récap sous le titre (distance + estimation 4 km/h)
            const summaryHtml = `<div class="walk-summary">À pied : <strong>${distText}</strong> — Estimation (4 km/h) : <strong>${estText}</strong></div>`;
            // Si un élément summary existe déjà, on le remplace
            const existing = $panel.querySelector('.walk-summary');
            if (existing) existing.remove();
            // Insérer après le h4 si présent sinon en bas
            const h4 = $panel.querySelector('h4');
            if (h4) h4.insertAdjacentHTML('afterend', summaryHtml);
            else $panel.insertAdjacentHTML('beforeend', summaryHtml);
        }
    }

    /* ---------------------------------------------
     * FAVORITES (localStorage)
     * Fonctions utilitaires pour gérer la liste des
     * arrêts favoris dans localStorage sans doublons.
     * Key utilisée : 'tec_on_me_favorites'
     * --------------------------------------------- */

    // Retourne le tableau des favoris (ids) depuis localStorage
    _getFavorites() {
        try {
            const raw = localStorage.getItem('tec_on_me_favorites');
            if (!raw) return [];
            return JSON.parse(raw);
        } catch (e) {
            console.warn('Impossible de lire les favoris depuis localStorage', e);
            return [];
        }
    }

    // Sauvegarde le tableau d'ids en localStorage
    _saveFavorites(arr) {
        try {
            localStorage.setItem('tec_on_me_favorites', JSON.stringify(arr));
            return true;
        } catch (e) {
            console.warn('Impossible de sauvegarder les favoris', e);
            return false;
        }
    }

    // Retourne true si l'id est déjà en favoris
    isFavorite(id) {
        if (!id) return false;
        const fav = this._getFavorites();
        return fav.some(item => {
            if (!item) return false;
            if (typeof item === 'string') return item === id;
            if (typeof item === 'object' && item.id) return String(item.id) === String(id);
            return false;
        });
    }

    // Ajoute un favori {id,label} si non présent (évite les doublons)
    // Ajoute un favori {id,number,name} si non présent (évite les doublons)
    // Accepte soit (id, number, name), soit un objet {id, number, name}
    // Retourne true si ajouté, false si déjà présent ou erreur
    addFavorite(idOrObj, number, name) {
        if (!idOrObj) return false;
        let id = null;
        let num = '';
        let nm = '';

        if (typeof idOrObj === 'object') {
            id = String(idOrObj.id || '');
            num = idOrObj.number || idOrObj.num || '';
            nm = idOrObj.name || idOrObj.label || '';
        } else {
            id = String(idOrObj);
            num = number || '';
            nm = name || '';
        }
        if (!id) return false;

        const fav = this._getFavorites();
        if (fav.some(item => (typeof item === 'string' ? item === id : String(item.id) === String(id)))) return false; // déjà

        // push as object to store number and name
        fav.push({ id: id, number: num, name: nm });
        const saved = this._saveFavorites(fav);
        // Mettre à jour le panneau si il est affiché
        if (saved && this._favoritesPanel) this.updateFavoritesPanel();
        return saved;
    }

    // Supprime un id des favoris s'il existe.
    // Retourne true si supprimé, false si absent ou erreur.
    removeFavorite(id) {
        if (!id) return false;
        const fav = this._getFavorites();
        const idx = fav.findIndex(item => (typeof item === 'string' ? item === id : String(item.id) === String(id)));
        if (idx === -1) return false; // pas présent
        fav.splice(idx, 1);
        const saved = this._saveFavorites(fav);
        if (saved && this._favoritesPanel) this.updateFavoritesPanel();
        return saved;
    }

    // Bascule l'état favoris : accepte soit (id) / (id, number, name) ou un objet {id,number,name}
    // Retourne 'added' | 'removed' | false (en cas d'erreur).
    toggleFavorite(idOrObj, number, name) {
        if (!idOrObj) return false;
        // Si un objet est passé en premier paramètre
        if (typeof idOrObj === 'object') {
            const id = String(idOrObj.id || '');
            if (!id) return false;
            if (this.isFavorite(id)) {
                const removed = this.removeFavorite(id);
                return removed ? 'removed' : false;
            } else {
                const added = this.addFavorite(idOrObj);
                return added ? 'added' : false;
            }
        }

        // Sinon on a un id en premier param
        const id = String(idOrObj);
        if (!id) return false;
        if (this.isFavorite(id)) {
            const removed = this.removeFavorite(id);
            return removed ? 'removed' : false;
        } else {
            const added = this.addFavorite(id, number, name);
            return added ? 'added' : false;
        }
    }

    /* ------------------------------------------------------------------
     * FAVORITES PANEL UI
     * Fonctions pour créer et mettre à jour une vue liste des favoris.
     * - renderFavoritesPanel() : crée le panneau et le bouton d'ouverture
     * - updateFavoritesPanel() : met à jour le contenu en lisant localStorage
     * - _handleFavoriteSelect(id) : gère le clic sur un favori (affiche la ligne)
     *
     * Ces fonctions sont appelées automatiquement lorsque l'utilisateur
     * ajoute/retire un favori (on rafraîchit la liste si le panneau existe).
     * ------------------------------------------------------------------ */

    // Crée le panneau de favoris et le bouton pour l'ouvrir (appelé à la demande)
    renderFavoritesPanel() {
        // Si déjà créé, ne rien faire
        if (this._favoritesPanel) return;

        // Conteneur principal
        const panel = document.createElement('div');
        panel.className = 'favorites-panel';
        // Styles minimaux pour être fonctionnel sans modifier les CSS externes
        Object.assign(panel.style, {
            position: 'fixed',
            right: '1rem',
            bottom: '6rem',
            width: '260px',
            maxHeight: '50vh',
            overflow: 'auto',
            background: 'white',
            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            borderRadius: '8px',
            padding: '8px',
            zIndex: 2000,
            display: 'none'
        });

        // Titre
        const h = document.createElement('h3');
        h.textContent = 'Favoris';
        h.style.margin = '0 0 8px 0';
        panel.appendChild(h);

        // Liste
        const ul = document.createElement('ul');
        ul.className = 'favorites-list';
        ul.style.listStyle = 'none';
        ul.style.padding = '0';
        ul.style.margin = '0';
        panel.appendChild(ul);

        // Fermer
        const close = document.createElement('button');
        close.textContent = 'Fermer';
        Object.assign(close.style, { marginTop: '8px', width: '100%' });
        close.addEventListener('click', () => { panel.style.display = 'none'; });
        panel.appendChild(close);

        document.body.appendChild(panel);
        this._favoritesPanel = panel;

        // Bouton flottant pour afficher/masquer le panneau
        const toggle = document.createElement('button');
        toggle.className = 'favorites-toggle';
        toggle.textContent = '★ Favoris';
        Object.assign(toggle.style, {
            position: 'fixed',
            right: '1rem',
            bottom: '1rem',
            zIndex: 2000,
            padding: '8px 10px',
            borderRadius: '8px',
            background: '#FFD600',
            border: 'none',
            cursor: 'pointer'
        });
        toggle.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            // Lorsqu'on ouvre, rafraîchir le contenu
            if (panel.style.display === 'block') this.updateFavoritesPanel();
        });
        document.body.appendChild(toggle);
        this._favoritesToggle = toggle;
    }

    // Met à jour la liste des favoris dans le panneau (doit exister)
    updateFavoritesPanel() {
        if (!this._favoritesPanel) return;
        const ul = this._favoritesPanel.querySelector('.favorites-list');
        if (!ul) return;
        // Vider
        ul.innerHTML = '';

        const fav = this._getFavorites();
        if (!fav || fav.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Aucun favori';
            li.style.padding = '6px 0';
            ul.appendChild(li);
            return;
        }

        fav.forEach(item => {
            const id = (typeof item === 'string') ? item : String(item.id || '');
            const number = (typeof item === 'object' && item.number) ? item.number : '';
            const name = (typeof item === 'object' && item.name) ? item.name : '';
            // texte affiché : si on a un numéro et un nom -> "numéro — nom", sinon afficher ce qu'on a
            let text = '';
            if (number && name) text = `${number} — ${name}`;
            else if (number) text = `${number}`;
            else if (name) text = `${name}`;
            else text = id;

            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '6px 0';

            const a = document.createElement('a');
            a.href = '#';
            a.textContent = text;
            a.style.flex = '1';
            a.dataset.favId = id;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                this._handleFavoriteSelect(id);
            });

            const del = document.createElement('button');
            del.textContent = '×';
            del.title = 'Supprimer';
            del.style.marginLeft = '8px';
            del.addEventListener('click', (e) => {
                e.preventDefault();
                const removed = this.removeFavorite(id);
                if (removed) this.updateFavoritesPanel();
            });

            li.appendChild(a);
            li.appendChild(del);
            ul.appendChild(li);
        });
    }

    // Gère la sélection d'un favori : affiche la ligne correspondante
    // et s'assure que la ligne précédente disparaisse (drawRoute efface le calque route).
    _handleFavoriteSelect(id) {
        if (!id) return;
        // Afficher la ligne (shapeId)
        this.drawRoute(id);
        // Mettre en avant l'élément sélectionné dans la liste si panel visible
        if (this._favoritesPanel) {
            // retirer la classe 'selected' des autres
            const items = this._favoritesPanel.querySelectorAll('.favorites-list li');
            items.forEach(li => li.classList.remove('selected'));
            // trouver l'élément correspondant
            const anchors = this._favoritesPanel.querySelectorAll('.favorites-list a');
            anchors.forEach(a => {
                if (a.dataset && a.dataset.favId === String(id)) a.parentElement.classList.add('selected');
            });
        }
    }

    // Génère un identifiant unique pour un arrêt reçu de l'API
    // Utilise un champ existant si présent, sinon fallback sur le nom+coords
    _getStopId(stop) {
        // Plusieurs APIs peuvent exposer des identifiants différents
        if (!stop) return null;
        if (stop.recordid) return String(stop.recordid);
        if (stop.id) return String(stop.id);
        // fallback : compose un id à partir du nom et des coordonnées
        try {
            const name = stop.stop_name ? stop.stop_name.replace(/\s+/g, '_') : 'stop';
            const lat = stop.coordinates && stop.coordinates.lat ? stop.coordinates.lat : '0';
            const lon = stop.coordinates && stop.coordinates.lon ? stop.coordinates.lon : '0';
            return `${name}_${lat}_${lon}`;
        } catch (e) {
            return null;
        }
    }

    /**
     * Estime le temps de marche en secondes pour une distance donnée (en mètres)
     * selon une vitesse en km/h (par défaut 4 km/h).
     * Retourne le temps estimé en secondes (arrondi).
     */
    _estimateWalkingTime(distanceMeters, speedKmh = 4) {
        if (!distanceMeters || distanceMeters <= 0) return 0;
        // vitesse en m/s = (km/h) * 1000 / 3600
        const speedMs = (speedKmh * 1000) / 3600;
        const seconds = Math.round(distanceMeters / speedMs);
        return seconds;
    }


    
    // Trace le parcours complet d'une ligne de bus (depuis notre API)
    async drawRoute(shapeId) {
        this.layers.route.clearLayers(); // On efface le trajet précédent

        try {
            //requête à notre API pour récupérer les points de la ligne de bus
            const response = await fetch(`${this.urlApi}/shapes/${shapeId}`);
            const data = await response.json();

            if (data.content && data.content.length > 0) {
                // Transformation des points API en coordonnées Leaflet
                const points = data.content.map(p => [p.shape_pt_lat, p.shape_pt_lon]);
                
                // Dessin de la ligne rouge
                L.polyline(points, { color: 'red', weight: 8, opacity: 0.7 }).addTo(this.layers.route);
                
                // Icônes de départ et d'arrivée du bus
                L.marker(points[0], { icon: this.icons.start }).bindPopup('Départ du bus').addTo(this.layers.route);
                L.marker(points[points.length - 1], { icon: this.icons.end }).bindPopup('Terminus').addTo(this.layers.route);

                // On ajuste la vue pour voir toute la ligne de bus
                this.map.flyToBounds(points, { padding: [50, 50] });
            }
        } catch (error) {
            console.error("Erreur lors du tracé du trajet :", error);
        }
    }

   
}

export { Geo };