import { Component, type ReactNode, type ErrorInfo } from "react";
import { ShieldAlert, RefreshCcw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

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
      <div className="flex min-h-[50vh] w-full items-center justify-center p-6 animate-in fade-in duration-300">
        <Card className="relative w-full max-w-lg overflow-hidden border-destructive/20 bg-card/60 backdrop-blur-md shadow-lg">
          {/* Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-destructive animate-pulse" />

          <CardHeader className="space-y-4 pb-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-1.5 text-center">
              <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
                {this.props.label ? `${this.props.label} Glitch` : "Component Error"}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                An unexpected rendering error occurred. You can safely reset this component or contact support.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {this.state.error && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center gap-2 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Trace details</span>
                </div>
                <pre className="max-h-[150px] overflow-y-auto rounded bg-background p-3 text-left text-xs font-mono text-destructive-foreground/80 leading-relaxed border shadow-inner">
                  {this.state.error.message || "No error details available"}
                </pre>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-center gap-3 border-t bg-muted/20 px-6 py-4">
            <Button
              onClick={this.handleReset}
              variant="outline"
              className="gap-2 transition-transform duration-200 hover:scale-105 active:scale-95 border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
            >
              <RefreshCcw className="h-4 w-4 animate-spin-hover" />
              <span>Reset & Reload</span>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
}
