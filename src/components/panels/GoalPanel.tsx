import { useEffect, useState } from 'react';

import { formatLatLon, formatMode } from '../../lib/format';
import type { BridgeState, GoalPayload } from '../../types/bridge';
import { PanelCard } from './PanelCard';

interface GoalPanelProps {
  bridgeState: BridgeState | null;
  onGoalSubmit: (goal: GoalPayload) => Promise<void>;
}

export function GoalPanel({ bridgeState, onGoalSubmit }: GoalPanelProps) {
  const goalStatus = bridgeState?.goal_status;
  const goal = goalStatus?.goal;
  const [draftLat, setDraftLat] = useState('');
  const [draftLon, setDraftLon] = useState('');
  const [draftHeading, setDraftHeading] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!bridgeState || draftLat || draftLon || draftHeading) {
      return;
    }

    setDraftLat(bridgeState.ego.latitude_deg.toFixed(6));
    setDraftLon(bridgeState.ego.longitude_deg.toFixed(6));
    setDraftHeading(bridgeState.ego.heading_deg.toFixed(1));
  }, [bridgeState, draftHeading, draftLat, draftLon]);

  const fillFromEgo = () => {
    if (!bridgeState) {
      return;
    }
    setDraftLat(bridgeState.ego.latitude_deg.toFixed(6));
    setDraftLon(bridgeState.ego.longitude_deg.toFixed(6));
    setDraftHeading(bridgeState.ego.heading_deg.toFixed(1));
    setFormError(null);
  };

  const fillFromGoal = () => {
    if (!goal) {
      return;
    }
    setDraftLat(goal.goal_lat.toFixed(6));
    setDraftLon(goal.goal_lon.toFixed(6));
    setDraftHeading(goal.goal_heading.toFixed(1));
    setFormError(null);
  };

  const submitGoal = async () => {
    const parsedLat = Number(draftLat);
    const parsedLon = Number(draftLon);
    const parsedHeading = Number(draftHeading);

    if (
      Number.isNaN(parsedLat) ||
      Number.isNaN(parsedLon) ||
      Number.isNaN(parsedHeading)
    ) {
      setFormError('Enter valid numeric goal values before sending.');
      return;
    }

    setFormError(null);
    await onGoalSubmit({
      goal_lat: parsedLat,
      goal_lon: parsedLon,
      goal_heading: parsedHeading,
    });
  };

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
      <div className="field-grid">
        <label className="field">
          <span>Goal Latitude</span>
          <input
            type="text"
            inputMode="decimal"
            value={draftLat}
            onChange={(event) => {
              setDraftLat(event.target.value);
            }}
          />
        </label>
        <label className="field">
          <span>Goal Longitude</span>
          <input
            type="text"
            inputMode="decimal"
            value={draftLon}
            onChange={(event) => {
              setDraftLon(event.target.value);
            }}
          />
        </label>
        <label className="field">
          <span>Goal Heading</span>
          <input
            type="text"
            inputMode="decimal"
            value={draftHeading}
            onChange={(event) => {
              setDraftHeading(event.target.value);
            }}
          />
        </label>
      </div>
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void submitGoal()}>
          Send Typed Goal
        </button>
        <button className="action-button action-button--ghost" type="button" onClick={fillFromEgo}>
          Use Ego Pose
        </button>
        <button
          className="action-button action-button--ghost"
          type="button"
          onClick={fillFromGoal}
          disabled={!goal}
        >
          Use Active Goal
        </button>
      </div>
      {formError ? <p className="panel-note panel-note--error">{formError}</p> : null}
      <p className="panel-note">
        {goalStatus?.message ??
          'Click the map or type a lat/lon goal to send a GetShortestPath request.'}
      </p>
    </PanelCard>
  );
}
