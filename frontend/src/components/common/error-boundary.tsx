import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-6">
              <h2 className="mb-2 text-lg font-semibold">
                Something went wrong
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {this.state.error?.message || 'An unexpected error occurred.'}
              </p>
              <Button onClick={this.handleReset}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
