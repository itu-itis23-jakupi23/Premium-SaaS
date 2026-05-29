import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional label shown in the error panel (e.g. page name). */
  label?: string;
  /** Optional callback fired when the user clicks "Try again". */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches runtime errors anywhere in the child tree and shows a
 * graceful fallback instead of a blank white screen.
 *
 * Usage:
 *   <ErrorBoundary label="Chief Managers">
 *     <ChiefManagers />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">
            {this.props.label ? `${this.props.label} — ` : ""}Something went wrong
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred. You can try reloading this section without
            losing your session.
          </p>
          {this.state.error && (
            <pre className="mt-3 max-w-md overflow-x-auto rounded bg-muted px-4 py-2 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <Button onClick={this.handleReset} variant="outline">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }
}
