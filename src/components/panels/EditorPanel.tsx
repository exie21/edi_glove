import { formatLatLon } from '../../lib/format';
import {
  getSceneObjectTitle,
} from '../../lib/editorObjects';
import { getWaypointLabel } from '../../lib/waypoints';
import type {
  SceneObject,
  Waypoint,
} from '../../types/ui';
import { PanelCard } from './PanelCard';

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
            sceneObjects.map((object) => (
              <div key={object.id} className="waypoint-row">
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
            ))
          )}
        </div>
      </div>
    </PanelCard>
  );
}
