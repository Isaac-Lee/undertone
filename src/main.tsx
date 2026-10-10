import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-mono/300.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-sans-kr/300.css'
import '@fontsource/ibm-plex-sans-kr/400.css'
import '@fontsource/ibm-plex-sans-kr/500.css'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
