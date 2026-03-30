import { formatAge } from '../../lib/format';
import type { BridgeState } from '../../types/bridge';
import type { OverlayKey, OverlayVisibility } from '../../types/ui';
import { PanelCard } from './PanelCard';

interface OverlayPanelProps {
  bridgeState: BridgeState | null;
  overlayVisibility: OverlayVisibility;
  onToggleOverlay: (overlayKey: OverlayKey) => void;
}

function OverlayRow({
  overlayKey,
  label,
  swatchClassName,
  enabled,
  count,
  age,
  onToggle,
}: {
  overlayKey: OverlayKey;
  label: string;
  swatchClassName: string;
  enabled: boolean;
  count: number | undefined;
  age: number | null | undefined;
  onToggle: (overlayKey: OverlayKey) => void;
}) {
  return (
    <div className="overlay-row">
      <div className="overlay-row__label">
        <span className={`swatch ${swatchClassName}`} />
        <span>{label}</span>
      </div>
      <div className="overlay-row__meta">
        <strong>{count ?? 0}</strong>
        <span>{formatAge(age)}</span>
        <button
          className={`overlay-toggle${enabled ? ' overlay-toggle--active' : ''}`}
          type="button"
          onClick={() => {
            onToggle(overlayKey);
          }}
        >
          {enabled ? 'Visible' : 'Hidden'}
        </button>
      </div>
    </div>
  );
}

export function OverlayPanel({
  bridgeState,
  overlayVisibility,
  onToggleOverlay,
}: OverlayPanelProps) {
  return (
    <PanelCard title="Overlay Feed" eyebrow="Map Layers">
      <div className="overlay-list">
        <OverlayRow
          overlayKey="route"
          label="HLPath Route"
          swatchClassName="swatch--route"
          enabled={overlayVisibility.route}
          count={bridgeState?.route.point_count}
          age={bridgeState?.route.age_sec}
          onToggle={onToggleOverlay}
        />
        <OverlayRow
          overlayKey="trajectory"
          label="Reference Trajectory"
          swatchClassName="swatch--trajectory"
          enabled={overlayVisibility.trajectory}
          count={bridgeState?.reference_trajectory.point_count}
          age={bridgeState?.reference_trajectory.age_sec}
          onToggle={onToggleOverlay}
        />
        <OverlayRow
          overlayKey="predicted"
          label="Predicted Path"
          swatchClassName="swatch--predicted"
          enabled={overlayVisibility.predicted}
          count={bridgeState?.predicted_path.point_count}
          age={bridgeState?.predicted_path.age_sec}
          onToggle={onToggleOverlay}
        />
        <OverlayRow
          overlayKey="debug"
          label="Debug Reference"
          swatchClassName="swatch--debug"
          enabled={overlayVisibility.debug}
          count={bridgeState?.debug_reference_path.point_count}
          age={bridgeState?.debug_reference_path.age_sec}
          onToggle={onToggleOverlay}
        />
      </div>
    </PanelCard>
  );
}
