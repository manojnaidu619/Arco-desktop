/**
 * Renderer entry point. Mounts the React app into #root (see index.html) and
 * wraps it in the theme provider so light/dark/system mode works app-wide.
 *
 * Note: we intentionally do NOT use <React.StrictMode> here. In dev it
 * double-invokes effects, which would double-create sessions and double-fire
 * streams in this IPC-driven app. Skipping it keeps dev behavior identical to
 * production.
 */
import ReactDOM from 'react-dom/client'
import './index.css'
import { App } from './App'
import { ThemeProvider } from './components/theme-provider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
)
