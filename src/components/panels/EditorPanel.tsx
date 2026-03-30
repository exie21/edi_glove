import { formatLatLon } from '../../lib/format';
import {
  EDITOR_TOOL_META,
  getSceneObjectTitle,
} from '../../lib/editorObjects';
import { getWaypointLabel } from '../../lib/waypoints';
import type {
  EditorTool,
  MapInteractionMode,
  SceneObject,
  Waypoint,
} from '../../types/ui';
import { PanelCard } from './PanelCard';

interface EditorPanelProps {
  bridgeReady: boolean;
  generatedWorldPath: string | null;
  generatedWorldError: string | null;
  liveScenePublishingEnabled: boolean;
  interactionMode: MapInteractionMode;
  editorTool: EditorTool;
  waypoints: Waypoint[];
  sceneObjects: SceneObject[];
  onInteractionModeChange: (mode: MapInteractionMode) => void;
  onEditorToolChange: (tool: EditorTool) => void;
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
  interactionMode,
  editorTool,
  waypoints,
  sceneObjects,
  onInteractionModeChange,
  onEditorToolChange,
  onClearWaypoints,
  onRemoveWaypoint,
  onActivateWaypoint,
  onClearSceneObjects,
  onRemoveSceneObject,
}: EditorPanelProps) {
  const createModeEnabled = interactionMode === 'editor';
  const trafficLightCount = sceneObjects.filter((object) => object.kind === 'traffic_light').length;
  const barrelCount = sceneObjects.filter((object) => object.kind === 'barrel').length;

  return (
    <PanelCard
      title="Scenario Editor"
      eyebrow="Create / Place"
      action={
        <div className="toggle-group">
          <button
            className={`toggle-button${interactionMode === 'goal' ? ' toggle-button--active' : ''}`}
            type="button"
            onClick={() => {
              onInteractionModeChange('goal');
            }}
          >
            Drive
          </button>
          <button
            className={`toggle-button${createModeEnabled ? ' toggle-button--active' : ''}`}
            type="button"
            onClick={() => {
              onInteractionModeChange('editor');
            }}
          >
            Create
          </button>
        </div>
      }
    >
      <dl className="metric-grid">
        <div>
          <dt>Mode</dt>
          <dd>{createModeEnabled ? 'Create Mode' : 'Drive / Goal Mode'}</dd>
        </div>
        <div>
          <dt>Active Tool</dt>
          <dd>{EDITOR_TOOL_META[editorTool].label}</dd>
        </div>
        <div>
          <dt>Waypoints</dt>
          <dd>{waypoints.length}</dd>
        </div>
        <div>
          <dt>Scene Props</dt>
          <dd>{sceneObjects.length}</dd>
        </div>
      </dl>

      <div className="editor-tool-grid">
        {(['waypoint', 'traffic_light', 'barrel'] as const).map((tool) => (
          <button
            key={tool}
            className={`editor-tool-button${editorTool === tool ? ' editor-tool-button--active' : ''}`}
            type="button"
            onClick={() => {
              onEditorToolChange(tool);
            }}
          >
            <strong>{EDITOR_TOOL_META[tool].label}</strong>
            <span>{EDITOR_TOOL_META[tool].description}</span>
          </button>
        ))}
      </div>

      <p className="panel-note">
        {createModeEnabled
          ? `Create Mode is live. Blank-map clicks place ${EDITOR_TOOL_META[editorTool].label.toLowerCase()} objects. Existing waypoint pins still route there when clicked.`
          : 'Drive / Goal Mode is live. Map clicks send goals, and editor placement is locked until you turn Create Mode on.'}
      </p>

      <dl className="metric-grid metric-grid--dense">
        <div>
          <dt>Traffic Lights</dt>
          <dd>{trafficLightCount}</dd>
        </div>
        <div>
          <dt>Barrels</dt>
          <dd>{barrelCount}</dd>
        </div>
      </dl>

      <p className="panel-note">
        {liveScenePublishingEnabled
          ? 'Live scene publishing is on. Barrels and lights are mirrored to ROS perception while the bridge is connected.'
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
              No saved waypoints yet. Turn on Create Mode and choose the Waypoint tool to place them.
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
              No traffic lights or barrels yet. Turn on Create Mode and choose a prop tool to place them.
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
                    <p>{formatLatLon(object.latitude_deg, object.longitude_deg)}</p>
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
