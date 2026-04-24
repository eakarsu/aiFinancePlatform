import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <AlertTriangle size={48} color="#f44336" />
            <h2>Something went wrong</h2>
            <p>An unexpected error occurred. Please try again.</p>
            {this.state.error?.message && (
              <pre className="error-boundary-details">{this.state.error.message}</pre>
            )}
            <button className="btn-primary" onClick={this.handleRetry}>
              <RefreshCw size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
