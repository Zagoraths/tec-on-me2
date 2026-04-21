// gestion de la carte
import {Geo} from './inc/geo.js'
//Gestion du bouton d'installation
import './inc/install.js'

//gestion des fermetures des boxes
import boxClose from './inc/box.js'
//lance le process d'installation de l'app

// end install

//sélection des éléments HTML
const $mapBox = document.querySelector('#map')

const myGeo = new Geo($mapBox)
myGeo.init()
// Gestion du curseur de distance
const $distanceRange = document.querySelector('#distance');
const $distanceValue = document.querySelector('#distance-value');

if ($distanceRange) {
	// Initial display
	if ($distanceValue) $distanceValue.textContent = `${$distanceRange.value} km`;

	$distanceRange.addEventListener('input', (e) => {
		const km = parseFloat(e.target.value);
		if ($distanceValue) $distanceValue.textContent = `${km} km`;
		// Met à jour dynamiquement les arrêts visibles via Geo.setDistance
		myGeo.setDistance(km);
	});
}



// délenche la gestion de fermetures des boxes
boxClose()