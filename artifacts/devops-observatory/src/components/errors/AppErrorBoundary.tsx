import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary caught an error", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background px-6 py-10">
          <div className="mx-auto max-w-3xl">
            <div className="glass-panel rounded-2xl p-8 text-center">
              <h1 className="mb-2 text-2xl font-bold text-slate-100">
                Something went wrong
              </h1>
              <p className="mb-6 text-slate-400">
                An unexpected UI error occurred. Reload the page to recover.
              </p>
              <button
                className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-primary hover:bg-primary/20"
                onClick={this.handleReload}
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
