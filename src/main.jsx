import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
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
          minHeight: '100vh', background: '#061018', color: '#f8fafc',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '2rem', fontFamily: 'monospace',
        }}>
          <div style={{ maxWidth: 700, width: '100%' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>
              App crashed — render error
            </div>
            <div style={{
              background: '#0f1720', border: '1px solid #2d3a4e', borderRadius: 12,
              padding: '1rem', fontSize: 13, color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {String(this.state.error)}
              {'\n\n'}
              {this.state.error?.stack || ''}
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                marginTop: 16, padding: '8px 20px', background: '#3668fc', color: '#fff',
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
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
