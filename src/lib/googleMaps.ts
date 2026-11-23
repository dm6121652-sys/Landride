type GoogleWindow = Window & {
  google?: { maps?: { importLibrary: (name: string) => Promise<Record<string, any>> } }
  __landrideMapsReady?: () => void
  __landrideMapsPromise?: Promise<void>
  gm_authFailure?: () => void
}

export function loadGoogleMaps(key: string): Promise<void> {
  const root = window as GoogleWindow
  if (root.google?.maps?.importLibrary) return Promise.resolve()
  if (root.__landrideMapsPromise) return root.__landrideMapsPromise

  root.__landrideMapsPromise = new Promise((resolve, reject) => {
    root.__landrideMapsReady = resolve
    root.gm_authFailure = () => reject(new Error('Google Maps rejected the API key. Check that Maps JavaScript API is enabled for it.'))
    const script = document.createElement('script')
    script.dataset.landrideGoogleMaps = 'true'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=marker&callback=__landrideMapsReady`
    script.async = true
    script.onerror = () => reject(new Error('Google Maps could not load. Check your connection and API key.'))
    document.head.appendChild(script)
  })
  return root.__landrideMapsPromise
}
