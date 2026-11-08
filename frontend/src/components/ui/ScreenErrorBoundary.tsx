/** Screen-level React error boundary that contains render failures and offers a safe reload action. */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './CoreIcon.tsx'

type Props = { children: ReactNode; title: string }
type State = { failed: boolean }

/** Prevents a failed lazy screen chunk from taking down the portal shell. */
export class ScreenErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Do not log game/session payloads or private prompt data.
  }

  override render() {
    if (this.state.failed) {
      return <section className="workspace" role="alert" aria-labelledby="screen-load-error-title">
        <span className="eyebrow">SCREEN UNAVAILABLE</span>
        <h1 id="screen-load-error-title" className="page-title">{this.props.title}<br /><em>did not load.</em></h1>
        <p className="lead">The screen code could not be loaded. Your saved local game data has not been cleared.</p>
        <button type="button" className="primary" onClick={() => window.location.reload()}>Reload KING-FUN <Icon name="refresh" size={15} /></button>
      </section>
    }
    return this.props.children
  }
}
