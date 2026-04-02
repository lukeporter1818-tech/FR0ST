'use client'

/**
 * React error boundary for authenticated page content.
 *
 * Catches unexpected render errors in child component trees, logs them
 * via the telemetry endpoint (message only — no stack trace, no PII),
 * and shows a minimal recovery prompt instead of crashing the whole shell.
 *
 * Must be a class component — React's error boundary API requires it.
 */
import { Component, type ReactNode } from 'react'
import { logClientError } from '@/lib/client-telemetry'

interface Props {
  children: ReactNode
  /** Optional custom fallback UI. Defaults to a minimal recovery message. */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    // Extract the first frame of the component stack (file + component name only)
    // Never log the full stack — it can contain user-visible text from renders
    const topFrame = info.componentStack
      ? info.componentStack.trim().split('\n')[0].trim().slice(0, 100)
      : undefined

    logClientError(error.message, topFrame)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <p className="text-sm font-medium text-gray-300">Something went wrong.</p>
              <p className="text-xs text-gray-500 mt-1">
                Reload the page to continue.
              </p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="mt-4 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
