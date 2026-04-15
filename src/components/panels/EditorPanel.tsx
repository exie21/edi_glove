import { formatLatLon } from '../../lib/format';
import {
  getSceneObjectTitle,
} from '../../lib/editorObjects';
import { getWaypointLabel } from '../../lib/waypoints';
import type {
  SceneObject,
  TrafficLightState,
  Waypoint,
} from '../../types/ui';
import { PanelCard } from './PanelCard';

const TRAFFIC_LIGHT_STATES: TrafficLightState[] = ['red', 'yellow', 'green'];
const DEFAULT_TRAFFIC_LIGHT_TRIGGER_RADIUS_M = 80;
const DEFAULT_TRAFFIC_LIGHT_MIN_TRIGGER_RADIUS_M = 3;
const DEFAULT_TRAFFIC_LIGHT_FACING_FOV_DEG = 160;
const DEFAULT_TRAFFIC_LIGHT_STOPBAR_OFFSET_M = 8;
const DEFAULT_STOP_SIGN_TRIGGER_RADIUS_M = 40;
const DEFAULT_STOP_SIGN_MIN_TRIGGER_RADIUS_M = 3;
const DEFAULT_STOP_SIGN_STOPBAR_OFFSET_M = 3;
const DEFAULT_STOP_SIGN_FACING_FOV_DEG = 160;

interface EditorPanelProps {
  bridgeReady: boolean;
  generatedWorldPath: string | null;
  generatedWorldError: string | null;
  liveScenePublishingEnabled: boolean;
  waypoints: Waypoint[];
  sceneObjects: SceneObject[];
  onClearWaypoints: () => void;
  onRemoveWaypoint: (id: string) => void;
  onActivateWaypoint: (waypoint: Waypoint) => Promise<void>;
  onClearSceneObjects: () => void;
  onRemoveSceneObject: (id: string) => void;
  onUpdateSceneObject: (id: string, updates: Partial<SceneObject>) => void;
}

export function EditorPanel({
  bridgeReady,
  generatedWorldPath,
  generatedWorldError,
  liveScenePublishingEnabled,
  waypoints,
  sceneObjects,
  onClearWaypoints,
  onRemoveWaypoint,
  onActivateWaypoint,
  onClearSceneObjects,
  onRemoveSceneObject,
  onUpdateSceneObject,
}: EditorPanelProps) {
  const trafficLightCount = sceneObjects.filter((object) => object.kind === 'traffic_light').length;
  const stopSignCount = sceneObjects.filter((object) => object.kind === 'stop_sign').length;
  const barrelCount = sceneObjects.filter((object) => object.kind === 'barrel').length;

  return (
    <PanelCard title="Scenario Inventory" eyebrow="Saved Objects">
      <dl className="metric-grid">
        <div>
          <dt>Route Points</dt>
          <dd>{waypoints.length}</dd>
        </div>
        <div>
          <dt>Traffic Lights</dt>
          <dd>{trafficLightCount}</dd>
        </div>
        <div>
          <dt>Barrels</dt>
          <dd>{barrelCount}</dd>
        </div>
        <div>
          <dt>Stop Signs</dt>
          <dd>{stopSignCount}</dd>
        </div>
        <div>
          <dt>Total Props</dt>
          <dd>{sceneObjects.length}</dd>
        </div>
      </dl>

      <p className="panel-note">
        {liveScenePublishingEnabled
          ? 'Live scene publishing is on. Barrels, lights, and stop signs are mirrored to ROS perception while the bridge is connected.'
          : 'Live scene publishing is off in the bridge. Saved scene props can still be written to the generated mock_perception world file.'}
      </p>
      {generatedWorldPath ? (
        <p className="panel-note">
          Generated world file: <code>{generatedWorldPath}</code>
        </p>
      ) : null}
      {generatedWorldError ? (
        <p className="panel-note panel-note--error">{generatedWorldError}</p>
      ) : null}

      <div className="button-row">
        <button
          className="action-button action-button--ghost"
          type="button"
          disabled={waypoints.length === 0}
          onClick={onClearWaypoints}
        >
          Clear Waypoints
        </button>
        <button
          className="action-button action-button--ghost"
          type="button"
          disabled={sceneObjects.length === 0}
          onClick={onClearSceneObjects}
        >
          Clear Scene Props
        </button>
      </div>

      <div className="editor-section">
        <h3 className="editor-section__title">Waypoints</h3>
        <div className="waypoint-list">
          {waypoints.length === 0 ? (
            <p className="panel-note">
              No saved waypoints yet. Enter Create Mode from the map tray and use the bottom hotbar to place them.
            </p>
          ) : (
            waypoints.map((waypoint, index) => (
              <div key={waypoint.id} className="waypoint-row">
                <div className="waypoint-row__label">
                  <span className="waypoint-badge">
                    {waypoint.label ?? getWaypointLabel(index)}
                  </span>
                  <div>
                    <strong>Waypoint {waypoint.label ?? getWaypointLabel(index)}</strong>
                    <p>{formatLatLon(waypoint.latitude_deg, waypoint.longitude_deg)}</p>
                  </div>
                </div>
                <div className="button-row">
                  <button
                    className="action-button"
                    type="button"
                    disabled={!bridgeReady}
                    onClick={() => {
                      void onActivateWaypoint(waypoint);
                    }}
                  >
                    Route Here
                  </button>
                  <button
                    className="overlay-toggle"
                    type="button"
                    onClick={() => {
                      onRemoveWaypoint(waypoint.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="editor-section">
        <h3 className="editor-section__title">Scene Props</h3>
        <div className="waypoint-list">
          {sceneObjects.length === 0 ? (
            <p className="panel-note">
              No traffic lights, stop signs, or barrels yet. Enter Create Mode from the map tray and use the bottom hotbar to place them.
            </p>
          ) : (
            sceneObjects.map((object) => {
              const readiness = getSceneObjectReadiness(object);

              return (
              <div key={object.id} className="waypoint-row waypoint-row--stacked">
                <div className="waypoint-row__label">
                  <span className={`waypoint-badge waypoint-badge--${object.kind}`}>
                    {object.label}
                  </span>
                  <div>
                    <strong>{getSceneObjectTitle(object)}</strong>
                    <p>
                      {formatLatLon(object.latitude_deg, object.longitude_deg)}
                      {object.kind === 'stop_sign' && typeof object.facing_deg === 'number'
                        ? ` • facing ${object.facing_deg.toFixed(0)}°`
                        : ''}
                      {object.kind === 'traffic_light'
                        ? ` • ${object.traffic_light_state ?? 'red'}`
                        : ''}
                      {object.kind === 'traffic_light' && typeof object.facing_deg === 'number'
                        ? ` • facing ${object.facing_deg.toFixed(0)}°`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="scene-prop-row__body">
                  <p className={`scene-check scene-check--${readiness.level}`}>
                    <strong>{readiness.label}</strong>
                    <span>{readiness.detail}</span>
                  </p>
                  {object.kind === 'traffic_light' ? (
                    <div className="scene-signal-row">
                      <span>Manual Signal</span>
                      <div className="scene-signal-row__buttons">
                        {TRAFFIC_LIGHT_STATES.map((state) => {
                          const activeState = object.traffic_light_state ?? 'red';
                          return (
                            <button
                              key={state}
                              className={`signal-button signal-button--${state}${
                                activeState === state ? ' signal-button--active' : ''
                              }`}
                              type="button"
                              onClick={() => {
                                onUpdateSceneObject(object.id, {
                                  traffic_light_state: state,
                                });
                              }}
                            >
                              {state}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="button-row button-row--compact">
                    <button
                      className="overlay-toggle"
                      type="button"
                      onClick={() => {
                        onRemoveSceneObject(object.id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
    </PanelCard>
  );
}

function getSceneObjectReadiness(object: SceneObject): {
  level: 'ready' | 'warn';
  label: string;
  detail: string;
} {
  if (object.kind === 'traffic_light') {
    const state = object.traffic_light_state ?? 'red';
    const triggerRadiusM = object.trigger_radius_m ?? DEFAULT_TRAFFIC_LIGHT_TRIGGER_RADIUS_M;
    const minTriggerRadiusM = object.min_trigger_radius_m ?? DEFAULT_TRAFFIC_LIGHT_MIN_TRIGGER_RADIUS_M;
    const facingFovDeg = object.facing_fov_deg ?? DEFAULT_TRAFFIC_LIGHT_FACING_FOV_DEG;
    const stopbarOffsetM = object.stopbar_offset_m ?? DEFAULT_TRAFFIC_LIGHT_STOPBAR_OFFSET_M;

    if (triggerRadiusM <= minTriggerRadiusM || facingFovDeg <= 0) {
      return {
        level: 'warn',
        label: 'Check Trigger',
        detail: `Needs trigger radius > min radius. Current ${minTriggerRadiusM.toFixed(0)}-${triggerRadiusM.toFixed(0)} m.`,
      };
    }

    return {
      level: 'ready',
      label: 'Behavior Ready',
      detail: `${state} light publishes in ${minTriggerRadiusM.toFixed(0)}-${triggerRadiusM.toFixed(0)} m range, FOV ${facingFovDeg.toFixed(0)}°, stopbar ${stopbarOffsetM.toFixed(0)} m.`,
    };
  }

  if (object.kind === 'stop_sign') {
    const triggerRadiusM = object.trigger_radius_m ?? DEFAULT_STOP_SIGN_TRIGGER_RADIUS_M;
    const minTriggerRadiusM = object.min_trigger_radius_m ?? DEFAULT_STOP_SIGN_MIN_TRIGGER_RADIUS_M;
    const facingFovDeg = object.facing_fov_deg ?? DEFAULT_STOP_SIGN_FACING_FOV_DEG;
    const stopbarOffsetM = object.stopbar_offset_m ?? DEFAULT_STOP_SIGN_STOPBAR_OFFSET_M;

    return {
      level: 'ready',
      label: 'Behavior Ready',
      detail: `Stop sign publishes in ${minTriggerRadiusM.toFixed(0)}-${triggerRadiusM.toFixed(0)} m range, FOV ${facingFovDeg.toFixed(0)}°, stopbar ${stopbarOffsetM.toFixed(0)} m.`,
    };
  }

  return {
    level: 'ready',
    label: 'Perception Ready',
    detail: 'Barrel publishes as a barricade/work-zone obstacle when ego enters its trigger radius.',
  };
}
