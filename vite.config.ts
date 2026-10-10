import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Share previews need absolute URLs. On Vercel the production address is picked up automatically;
// elsewhere set SITE_URL (e.g. https://example.com/first-impression). Without either the tags stay relative.
function siteUrl(): Plugin {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL // host only, e.g. first-impression.vercel.app
  const site = (process.env.SITE_URL ?? (vercel ? `https://${vercel}` : undefined))?.replace(/\/$/, '')
  return {
    name: 'site-url',
    transformIndexHtml: html => site
      ? html.replace(/content="\.?\/og\.png"/, `content="${site}/og.png"`) // Vite may already have made it ./og.png
          .replace('<meta property="og:type"', `<meta property="og:url" content="${site}/" />\n    <meta property="og:type"`)
      : html,
  }
}

// base './' so the build runs from any sub-path (a folder on a static host) as well as a domain root.
export default defineConfig({ base: './', plugins: [react(), siteUrl()] })
