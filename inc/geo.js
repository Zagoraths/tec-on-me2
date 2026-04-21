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
        L.tileLayer("https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=f5a6d9a8d3484637b41037978e6e1e7b", {
            attribution: '© OpenStreetMap - TEC'
        }).addTo(this.map);

        // On active nos "tiroirs" (calques) sur la carte
        this.layers.stops.addTo(this.map);
        this.layers.route.addTo(this.map);
        this.layers.click.addTo(this.map);

        // Marqueur fixe pour notre position initiale
        this.userMarker = L.marker([latitude, longitude], { icon: this.icons.user }).addTo(this.map);

        // On charge les arrêts autour de nous
        this.loadStops(position);
        
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
        
        const { latitude, longitude } = position.coords;

        try {
            // URL complexe qui demande : "donne moi les arrêts dans un rayon de X km autour de ce point"
            const url = `https://www.odwb.be/api/explore/v2.1/catalog/datasets/le-tec-arrets-bus/records?limit=100&where=within_distance(coordinates, geom'POINT(${longitude} ${latitude})', ${this.distance}km)&order_by=distance(coordinates, geom'POINT(${longitude} ${latitude})')`;
            
            const response = await fetch(url);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                // Pour chaque arrêt trouvé par l'API, on crée son marqueur
                data.results.forEach(stop => this._renderStopMarker(stop));
            } else {
                // Si aucun arrêt, on affiche notre message d'alerte HTML
                document.querySelector('.box-alert').classList.remove('hidden');
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
        
        let busHtml = "";
        if (data.code === "ok") {
            data.content.forEach(bus => {
                if (bus.route_id) {
                    busHtml += `<a href="#" class="bus-link" data-shape="${bus.shape_id}">${bus.route_short_name} - ${bus.route_long_name}</a><br>`;
                }
            });
        }

        // 2. Préparation du contenu du panneau
        const $panel = document.querySelector('#info-panel');
        $panel.innerHTML = `
            <span class="close-panel">&times;</span>
            <h4>${stop.stop_name}</h4>
            <hr>
            <div class="bus-list">${busHtml}</div>
        `;

        // 3. Affichage (en retirant la classe hidden)
        $panel.classList.remove('hidden');

        // 4. Gestion de la fermeture
        $panel.querySelector('.close-panel').addEventListener('click', () => {
            $panel.classList.add('hidden');
            this.layers.walking.clearLayers(); // On efface le tracé bleu aussi
        });
    });
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