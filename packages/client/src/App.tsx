import React from 'react'
import { AppShell } from './components/layout/AppShell'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 font-mono bg-background text-foreground min-h-screen">
          <h1 className="text-red-500 text-xl font-bold mb-4">Something went wrong</h1>
          <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm overflow-auto max-h-[60vh]">
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  )
}
