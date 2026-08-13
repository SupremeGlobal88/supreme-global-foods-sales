import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary] React crash:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: "#0C0D0E", color: "#fff" }}>
          <h1 className="text-xl font-bold mb-4" style={{ color: "#EF4444" }}>Something went wrong</h1>
          <p className="text-sm mb-4 text-center" style={{ color: "#8A8B8C" }}>
            The app encountered an error. Please try refreshing the page (Ctrl+Shift+R).
          </p>
          <details className="text-xs p-3 rounded max-w-lg w-full" style={{ backgroundColor: "#1A1A1B", color: "#8A8B8C" }}>
            <summary>Error details</summary>
            <pre className="mt-2 whitespace-pre-wrap">{this.state.error?.message}\n{this.state.error?.stack}</pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 rounded text-sm font-semibold"
            style={{ backgroundColor: "#D4A843", color: "#0C0D0E" }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
