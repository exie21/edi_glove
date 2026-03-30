import { formatLatLon, formatMode } from '../../lib/format';
import type { BridgeState } from '../../types/bridge';
import { PanelCard } from './PanelCard';

interface GoalPanelProps {
  bridgeState: BridgeState | null;
}

export function GoalPanel({ bridgeState }: GoalPanelProps) {
  const goalStatus = bridgeState?.goal_status;
  const goal = goalStatus?.goal;

  return (
    <PanelCard title="Goal Routing" eyebrow="Planner">
      <dl className="metric-grid">
        <div>
          <dt>Status</dt>
          <dd>{formatMode(goalStatus?.state)}</dd>
        </div>
        <div>
          <dt>Route Points</dt>
          <dd>{bridgeState?.route.point_count ?? 0}</dd>
        </div>
        <div>
          <dt>Goal</dt>
          <dd>{formatLatLon(goal?.goal_lat, goal?.goal_lon)}</dd>
        </div>
        <div>
          <dt>Goal Heading</dt>
          <dd>{goal?.goal_heading?.toFixed(1) ?? 'n/a'} deg</dd>
        </div>
      </dl>
      <p className="panel-note">
        {goalStatus?.message ?? 'Click the map to send a goal through GetShortestPath.'}
      </p>
    </PanelCard>
  );
}

