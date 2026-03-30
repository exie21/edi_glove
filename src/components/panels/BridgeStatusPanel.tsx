import { getBridgeBaseUrl } from '../../lib/bridgeApi';
import { formatMode } from '../../lib/format';
import type { BridgeState } from '../../types/bridge';
import { PanelCard } from './PanelCard';

interface BridgeStatusPanelProps {
  bridgeState: BridgeState | null;
  connectionStatus: 'loading' | 'connected' | 'error';
  errorMessage: string | null;
  lastCommandMessage: string | null;
}

export function BridgeStatusPanel({
  bridgeState,
  connectionStatus,
  errorMessage,
  lastCommandMessage,
}: BridgeStatusPanelProps) {
  const displayName = bridgeState?.display_name ?? 'Ediglove';

  return (
    <PanelCard
      title={displayName}
      eyebrow="Bridge"
      action={
        <span className={`status-pill status-pill--${connectionStatus}`}>
          {connectionStatus}
        </span>
      }
    >
      <dl className="metric-grid">
        <div>
          <dt>Mode</dt>
          <dd>{formatMode(bridgeState?.bridge.mode)}</dd>
        </div>
        <div>
          <dt>Control</dt>
          <dd>{formatMode(bridgeState?.bridge.last_control_source)}</dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd>{bridgeState?.bridge.service_ready ? 'Ready' : 'Waiting'}</dd>
        </div>
        <div>
          <dt>Endpoint</dt>
          <dd>{getBridgeBaseUrl()}</dd>
        </div>
      </dl>
      {lastCommandMessage ? (
        <p className="panel-note panel-note--success">{lastCommandMessage}</p>
      ) : null}
      {errorMessage ? (
        <p className="panel-note panel-note--error">{errorMessage}</p>
      ) : (
        <p className="panel-note">
          Frontend polls the bridge every 300 ms and keeps manual control alive while
          keys are held.
        </p>
      )}
    </PanelCard>
  );
}

