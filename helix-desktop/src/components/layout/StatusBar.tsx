import { useGateway } from '../../hooks/useGateway';
import './StatusBar.css';

export function StatusBar() {
  const { status, connected } = useGateway();

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
        <span className="status-text">
          {connected ? 'Connected' : status.running ? 'Connecting...' : 'Disconnected'}
        </span>
        {status.port && (
          <span className="status-port">Port: {status.port}</span>
        )}
      </div>
      <div className="status-bar-right">
        <span className="status-version">Helix Desktop</span>
      </div>
    </div>
  );
}
