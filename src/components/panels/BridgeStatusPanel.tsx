import { useState } from 'react';

import { getBridgeBaseUrl } from '../../lib/bridgeApi';
import { formatMode } from '../../lib/format';
import type { BridgeState } from '../../types/bridge';

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
  const [expanded, setExpanded] = useState(false);
  const displayName = bridgeState?.display_name === 'Ediglove'
    ? 'EdiGlove'
    : bridgeState?.display_name ?? 'EdiGlove';
  const mode = formatMode(bridgeState?.bridge.mode);
  const control = formatMode(bridgeState?.bridge.last_control_source);
  const service = bridgeState?.bridge.service_ready ? 'Ready' : 'Waiting';

  return (
    <div className="debug-widget">
      <button
        className={`debug-widget__toggle debug-widget__toggle--${connectionStatus}`}
        type="button"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((current) => !current);
        }}
      >
        <span className={`debug-widget__dot debug-widget__dot--${connectionStatus}`} />
        <span>Debug</span>
      </button>
      {expanded ? (
        <div className="debug-widget__panel">
          <div className="debug-widget__header">
            <div>
              <p className="debug-widget__eyebrow">Bridge</p>
              <strong className="debug-widget__title">{displayName}</strong>
            </div>
            <span className={`status-pill status-pill--${connectionStatus}`}>
              {connectionStatus}
            </span>
          </div>
          <dl className="debug-widget__stats">
            <div>
              <dt>Mode</dt>
              <dd>{mode}</dd>
            </div>
            <div>
              <dt>Control</dt>
              <dd>{control}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{service}</dd>
            </div>
          </dl>
          <p className="debug-widget__endpoint">{getBridgeBaseUrl()}</p>
          {errorMessage ? (
            <p className="debug-widget__message debug-widget__message--error">
              {errorMessage}
            </p>
          ) : lastCommandMessage ? (
            <p className="debug-widget__message debug-widget__message--success">
              {lastCommandMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
