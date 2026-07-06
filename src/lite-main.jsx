import React from 'react';
import ReactDOM from 'react-dom/client';
import LiteCalculator from './features/lite/LiteCalculator';
import './styles.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] React render error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0d1c2a', color: '#f8fafc',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '2rem', fontFamily: 'monospace',
        }}>
          <div style={{ maxWidth: 700, width: '100%' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>
              App crashed — render error
            </div>
            <div style={{
              background: '#182636', border: '1px solid #2e3f56', borderRadius: 12,
              padding: '1rem', fontSize: 13, color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {String(this.state.error)}
              {'\n\n'}
              {this.state.error?.stack || ''}
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                marginTop: 16, padding: '8px 20px', background: '#d97706', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0d1c2a',
          backgroundImage: `
            radial-gradient(circle at 20% 20%, rgba(217,119,6,0.10), transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(16,185,129,0.08), transparent 35%),
            linear-gradient(180deg, #111f2e 0%, #0d1c2a 100%)
          `,
        }}
      >
        <LiteCalculator />
      </div>
    </ErrorBoundary>
  </React.StrictMode>
);
