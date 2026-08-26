import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * De app draait vanaf de wortel van zijn eigen adres.
 *
 * Dat was niet altijd zo: op GitHub Pages stond hij onder `/trainingsapp/`, en het
 * basispad kwam daar uit een omgevingsvariabele. Sinds de app op de Pi staat en via
 * `tailscale serve` bereikbaar is, is er geen subpad meer — en dus ook geen reden om het
 * pad instelbaar te houden. Eén vaste waarde is hier veiliger dan een knop: de service
 * worker, het manifest en de start-URL moeten alle drie hetzelfde pad hebben, anders is
 * de PWA niet meer te installeren.
 */
const base = '/'

/**
 * De PWA-instellingen staan hier apart zodat `tests/hosting.test.ts` er bij kan. Dat is
 * geen omweg om te kunnen testen maar precies wat er getest hoort te worden: of het
 * basispad, `start_url` en `scope` nog hetzelfde zijn.
 */
export const pwaOptions = {
  registerType: 'autoUpdate' as const,
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    navigateFallback: `${base}index.html`,
    // Het advies komt van de server en hoort niet uit de cache te komen. Zonder deze
    // uitzondering zou de service worker een verzoek naar /api/ als navigatie kunnen
    // afhandelen en er index.html op teruggeven — en dan lijkt een uitstaande Pi op
    // een kapot antwoord in plaats van op geen antwoord.
    navigateFallbackDenylist: [/^\/api\//],
    cleanupOutdatedCaches: true,
  },
  manifest: {
    name: 'Trainingsschema',
    short_name: 'Training',
    description: 'Persoonlijk full-body krachtschema met hardlopen',
    theme_color: '#131110',
    background_color: '#131110',
    display: 'standalone' as const,
    orientation: 'portrait' as const,
    start_url: base,
    scope: base,
    id: base,
    lang: 'nl',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' as const },
    ],
  },
}

export default defineConfig({
  base,
  server: {
    /**
     * Tijdens ontwikkelen praat de app met het servertje uit `server/`. In productie doet
     * nginx dit; hier doet Vite het, zodat `/api/review` in beide gevallen hetzelfde pad
     * is en de app niets van adressen hoeft te weten.
     */
    proxy: {
      '/api': { target: 'http://127.0.0.1:8098', changeOrigin: false },
    },
  },
  plugins: [
    react(),
    VitePWA(pwaOptions),
  ],
})
