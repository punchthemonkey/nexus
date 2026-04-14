import { FunctionComponent } from 'preact';

interface ModelLoaderProps {
  status: 'uninitialized' | 'loading' | 'ready' | 'error';
  progress: number;
  error?: string | null;
  onRetry?: () => void;
}

export const ModelLoader: FunctionComponent<ModelLoaderProps> = ({
  status,
  progress,
  error,
  onRetry
}) => {
  if (status === 'ready') return null;

  return (
    <div class="model-loader-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div class="model-loader" style={{
        backgroundColor: 'var(--color-surface)',
        padding: '24px',
        borderRadius: '16px',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        {status === 'loading' && (
          <>
            <h3>Loading AI Model...</h3>
            <progress value={progress} max={1} style={{ width: '100%', margin: '16px 0' }} />
            <p>{Math.round(progress * 100)}%</p>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              First-time download may take a few minutes. Subsequent loads are instant.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <h3>Failed to load model</h3>
            <p style={{ margin: '16px 0', color: '#ef4444' }}>{error}</p>
            <p>Please check your connection and try again.</p>
            {onRetry && (
              <button onClick={onRetry} style={{ marginTop: '16px' }}>Retry</button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
