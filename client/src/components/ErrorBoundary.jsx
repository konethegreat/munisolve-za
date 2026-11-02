import { Component } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle size={28} />
          </div>
          <h1 className="text-xl font-bold text-[#0d3b5c]">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">
            The page could not finish loading. Reloading usually fixes it. If the problem
            continues, contact support and mention what you were doing.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary flex-1 px-4 py-2.5 text-sm"
            >
              <RefreshCw size={16} /> Reload
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="btn flex-1 border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Home size={16} /> Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
