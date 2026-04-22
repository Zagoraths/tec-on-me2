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
    deferredPrompt = null
  })

  // Sur iOS/Safari, there is no beforeinstallprompt; if app already 'installed' (standalone), hide button
  if (window.navigator.standalone === true) {
    const installBtn = document.querySelector('.install-btn')
    if (installBtn) installBtn.style.display = 'none'
  }

  // Fallback: si aucun beforeinstallprompt n'est reçu dans X ms sur Android, afficher
  // le bouton en mode instructions (l'utilisateur pourra voir comment ajouter manuellement)
  setTimeout(() => {
    // Si on est en mode standalone on ne propose rien
    if (window.navigator.standalone === true) return
    // Si le deferredPrompt n'a été défini, et que l'UA semble être mobile, montrer le bouton
    const ua = navigator.userAgent || ''
    const isMobile = /Android|Mobile|iPhone|iPad/i.test(ua)
    if (!deferredPrompt && isMobile) {
      // Afficher le bouton au cas où (fallback)
      installBtn.style.display = ''
      installBtn.setAttribute('aria-hidden', 'false')
      // Clic sur le bouton affiche des instructions utiles si le prompt natif n'existe pas
      const fallbackClick = (e) => {
        e.preventDefault()
        // Simple overlay indiquant comment ajouter l'app à l'écran d'accueil
        const existing = document.querySelector('.install-instructions')
        if (existing) return
        const overlay = document.createElement('div')
        overlay.className = 'install-instructions'
        Object.assign(overlay.style, {
          position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', color: 'white', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: '20px', textAlign: 'center'
        })
        overlay.innerHTML = `
          <div style="max-width:420px">
            <h3 style="margin-top:0">Installer l'application</h3>
            <p>Sur Android : ouvrez le menu du navigateur (⋮) et choisissez "Ajouter à l'écran d'accueil".</p>
            <p>Sur iPhone : dans Safari, appuyez sur le bouton <em>Partager</em> puis "Sur l'écran d'accueil".</p>
            <button style="margin-top:12px;padding:8px 12px;border-radius:6px;border:none;" class="close-instr">Fermer</button>
          </div>
        `
        document.body.appendChild(overlay)
        overlay.querySelector('.close-instr').addEventListener('click', () => overlay.remove())
      }
      installBtn.addEventListener('click', fallbackClick)
    }
  }, 1800)
}

// Initialisation immédiate à l'import
document.addEventListener('DOMContentLoaded', initInstallButton)

export { initInstallButton }
