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



// délenche la gestion de fermetures des boxes
boxClose()