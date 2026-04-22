// Gestion de l'installation en PWA via le bouton .install-btn
// Ce module ne gère pas le mode offline (pas de service worker ici)

let deferredPrompt = null

function initInstallButton () {
  const installBtn = document.querySelector('.install-btn')
  if (!installBtn) return

  // Masquer le bouton par défaut ; il sera affiché quand le navigateur permettra l'installation
  installBtn.style.display = 'none'

  // Lorsque le navigateur détecte qu'on peut installer l'app
  window.addEventListener('beforeinstallprompt', (e) => {
    // Empêcher l'affichage automatique du prompt
    e.preventDefault()
    deferredPrompt = e

    // Afficher le bouton d'installation
    installBtn.style.display = ''
    installBtn.setAttribute('aria-hidden', 'false')

    // Clic sur le bouton : afficher le prompt
    const onClick = async () => {
      if (!deferredPrompt) return
      // afficher la boîte d'installation native
      deferredPrompt.prompt()
      // attendre le choix de l'utilisateur
      try {
        const choice = await deferredPrompt.userChoice
        if (choice && choice.outcome === 'accepted') {
          console.log('PWA: utilisateur a accepté l\'installation')
        } else {
          console.log('PWA: utilisateur a refusé ou fermé le prompt')
        }
      } catch (err) {
        console.warn('PWA: erreur lors du prompt', err)
      }
      // Reset
      deferredPrompt = null
      // Cacher le bouton après interaction
      installBtn.style.display = 'none'
      installBtn.removeEventListener('click', onClick)
    }

    installBtn.addEventListener('click', onClick)
  })

  // Lorsque l'application est installée (événement utile pour analytics ou UI)
  window.addEventListener('appinstalled', (evt) => {
    console.log('PWA: application installée', evt)
    const installBtn = document.querySelector('.install-btn')
    if (installBtn) installBtn.style.display = 'none'
    // Hide the whole install box if present (we don't want to see it inside the installed app)
    const box = document.querySelector('.box-install')
    if (box) box.classList.add('hidden')
    deferredPrompt = null
  })

  // Sur iOS/Safari, there is no beforeinstallprompt; if app already 'installed' (standalone), hide button
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  if (isStandalone) {
    const installBtn = document.querySelector('.install-btn')
    if (installBtn) installBtn.style.display = 'none'
    const box = document.querySelector('.box-install')
    if (box) box.classList.add('hidden')
  }
}

// Initialisation immédiate à l'import
document.addEventListener('DOMContentLoaded', initInstallButton)

export { initInstallButton }
