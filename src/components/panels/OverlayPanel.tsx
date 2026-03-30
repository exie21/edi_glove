import { formatAge } from '../../lib/format';
import type { BridgeState } from '../../types/bridge';
import { PanelCard } from './PanelCard';

interface OverlayPanelProps {
  bridgeState: BridgeState | null;
}

function OverlayRow({
  label,
  swatchClassName,
  count,
  age,
}: {
  label: string;
  swatchClassName: string;
  count: number | undefined;
  age: number | null | undefined;
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
      </div>
    </div>
  );
}

export function OverlayPanel({ bridgeState }: OverlayPanelProps) {
  return (
    <PanelCard title="Overlay Feed" eyebrow="Map Layers">
      <div className="overlay-list">
        <OverlayRow
          label="HLPath Route"
          swatchClassName="swatch--route"
          count={bridgeState?.route.point_count}
          age={bridgeState?.route.age_sec}
        />
        <OverlayRow
          label="Reference Trajectory"
          swatchClassName="swatch--trajectory"
          count={bridgeState?.reference_trajectory.point_count}
          age={bridgeState?.reference_trajectory.age_sec}
        />
        <OverlayRow
          label="Predicted Path"
          swatchClassName="swatch--predicted"
          count={bridgeState?.predicted_path.point_count}
          age={bridgeState?.predicted_path.age_sec}
        />
        <OverlayRow
          label="Debug Reference"
          swatchClassName="swatch--debug"
          count={bridgeState?.debug_reference_path.point_count}
          age={bridgeState?.debug_reference_path.age_sec}
        />
      </div>
    </PanelCard>
  );
}

