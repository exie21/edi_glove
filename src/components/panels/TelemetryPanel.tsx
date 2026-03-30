import { formatAge, formatDegrees, formatLatLon, formatMeters, formatSpeed } from '../../lib/format';
import type { BridgeState } from '../../types/bridge';
import { PanelCard } from './PanelCard';

interface TelemetryPanelProps {
  bridgeState: BridgeState | null;
}

export function TelemetryPanel({ bridgeState }: TelemetryPanelProps) {
  const ego = bridgeState?.ego;
  const controller = bridgeState?.controller_command;

  return (
    <PanelCard title="Ego Telemetry" eyebrow="Vehicle">
      <dl className="metric-grid metric-grid--dense">
        <div>
          <dt>Speed</dt>
          <dd>{formatSpeed(ego?.speed_mps)}</dd>
        </div>
        <div>
          <dt>Heading</dt>
          <dd>{formatDegrees(ego?.heading_deg)}</dd>
        </div>
        <div>
          <dt>X</dt>
          <dd>{formatMeters(ego?.x_m)}</dd>
        </div>
        <div>
          <dt>Y</dt>
          <dd>{formatMeters(ego?.y_m)}</dd>
        </div>
        <div>
          <dt>GPS</dt>
          <dd>{formatLatLon(ego?.latitude_deg, ego?.longitude_deg)}</dd>
        </div>
        <div>
          <dt>Controller Age</dt>
          <dd>{formatAge(controller?.age_sec)}</dd>
        </div>
      </dl>
      <dl className="metric-grid metric-grid--dense">
        <div>
          <dt>Throttle</dt>
          <dd>{controller?.throttle_mps2?.toFixed(2) ?? 'n/a'} m/s²</dd>
        </div>
        <div>
          <dt>Brake</dt>
          <dd>{controller?.brake_mps2?.toFixed(2) ?? 'n/a'} m/s²</dd>
        </div>
        <div>
          <dt>Steer Column</dt>
          <dd>{controller?.steering_column_deg?.toFixed(1) ?? 'n/a'} deg</dd>
        </div>
        <div>
          <dt>Origin</dt>
          <dd>
            {formatLatLon(
              ego?.origin.latitude_deg,
              ego?.origin.longitude_deg,
            )}
          </dd>
        </div>
      </dl>
    </PanelCard>
  );
}

