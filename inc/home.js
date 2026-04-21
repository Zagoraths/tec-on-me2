// home.js
const $geoForm = document.querySelector('.gps_form');

$geoForm.addEventListener('submit', (e) => {
    // On ne fait PAS de e.preventDefault() ici pour laisser le formulaire 
    // rediriger naturellement l'utilisateur vers sa destination.
    
    // On change juste la destination (action) du formulaire juste avant l'envoi
    $geoForm.action = "carte.html";
});