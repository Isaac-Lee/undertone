import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.generated.css' // only the characters this text uses (scripts/fonts.mjs)
import './styles.css'
import App from './App'
import { clearSession } from './state'

/** If a scene ever throws, offer a clean start instead of a blank page. */
class Recover extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="stage">
        <main className="center">
          <h1 className="label" style={{ margin: 0, fontWeight: 'normal' }}>문제가 생겨 이 장면을 보여드릴 수 없습니다.</h1>
          <div><button className="btn" onClick={() => { clearSession(); location.reload() }}>처음부터 다시</button></div>
        </main>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(<Recover><App /></Recover>)
