import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './States'

interface State {
  error: Error | null
}

// Catches render crashes so one broken component shows a message instead of a blank page.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A real app would send this to Sentry or similar.
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="Something went wrong on this page"
          message={this.state.error.message}
          onRetry={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}
