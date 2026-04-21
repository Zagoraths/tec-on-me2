//Métode boxClose
const boxClose = () => {
    // récupération des boxes
    const boxes = document.querySelectorAll('.box')
    // recup de la croix de fermeture
    const closeBtns = document.querySelectorAll('.close')
    // pour chaque croix
    closeBtns.forEach(element => {
        // on écoute un click
        element.addEventListener('click', e => {
            e.preventDefault()
            //alert('click')
            // on ajoute la classe "hidden"
            e.target.parentElement.classList.add('hidden')
        })
    });
}
//export de la méthode
export default boxClose