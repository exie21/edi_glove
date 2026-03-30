import { useEffect, useState } from 'react';

import { useBridgeState } from './hooks/useBridgeState';
import { useKeyboardDrive } from './hooks/useKeyboardDrive';
import { MapView } from './components/map/MapView';
import { BridgeStatusPanel } from './components/panels/BridgeStatusPanel';
import { EditorPanel } from './components/panels/EditorPanel';
import { GoalPanel } from './components/panels/GoalPanel';
import { ManualDrivePanel } from './components/panels/ManualDrivePanel';
import { OverlayPanel } from './components/panels/OverlayPanel';
import { TelemetryPanel } from './components/panels/TelemetryPanel';
import {
  getNextSceneObjectLabel,
} from './lib/editorObjects';
import { getDefaultMapPreset } from './lib/mapPresets';
import { getWaypointLabel } from './lib/waypoints';
import {
  DEFAULT_OVERLAY_VISIBILITY,
  type EditorTool,
  type MapInteractionMode,
  type SceneObject,
  type Waypoint,
} from './types/ui';

export default function App() {
  const [overlayVisibility, setOverlayVisibility] = useState(DEFAULT_OVERLAY_VISIBILITY);
  const [mapPresetKey, setMapPresetKey] = useState(getDefaultMapPreset().key);
  const [interactionMode, setInteractionMode] = useState<MapInteractionMode>('goal');
  const [editorTool, setEditorTool] = useState<EditorTool>('waypoint');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([]);
  const {
    bridgeState,
    connectionStatus,
    errorMessage,
    lastCommandMessage,
    setMode,
    setManualCommand,
    setGoal,
    resetVehicle,
    syncSceneObjects,
  } = useBridgeState();

  const bridgeReady = connectionStatus === 'connected';
  const currentMode = bridgeState?.bridge.mode === 'auto' ? 'auto' : 'manual';
  const { keyState, manualCommand } = useKeyboardDrive(
    currentMode === 'manual' && bridgeReady,
    async (command) => {
      await setManualCommand(command);
    },
  );

  useEffect(() => {
    const livePreset = bridgeState?.bridge.map_preset;
    if (livePreset === 'mcity' || livePreset === 'columbus') {
      setMapPresetKey(livePreset);
    }
  }, [bridgeState?.bridge.map_preset]);

  useEffect(() => {
    if (!bridgeReady) {
      return;
    }

    void syncSceneObjects({
      objects: sceneObjects.map((object) => ({
        id: object.id,
        kind: object.kind,
        label: object.label,
        latitude_deg: object.latitude_deg,
        longitude_deg: object.longitude_deg,
      })),
    }).catch(() => {
      // Polling already reports bridge connectivity; keep scene sync quiet here.
    });
  }, [bridgeReady, sceneObjects]);

  const addWaypoint = (latitude_deg: number, longitude_deg: number) => {
    setWaypoints((current) => {
      const usedLabels = new Set(
        current
          .map((waypoint) => waypoint.label)
          .filter((label): label is string => Boolean(label)),
      );
      let nextIndex = 0;
      let nextLabel = getWaypointLabel(nextIndex);

      while (usedLabels.has(nextLabel)) {
        nextIndex += 1;
        nextLabel = getWaypointLabel(nextIndex);
      }

      return [
        ...current,
        {
          id: `waypoint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          label: nextLabel,
          latitude_deg,
          longitude_deg,
        },
      ];
    });
  };

  const addSceneObject = (
    kind: SceneObject['kind'],
    latitude_deg: number,
    longitude_deg: number,
  ) => {
    setSceneObjects((current) => [
      ...current,
      {
        id: `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        kind,
        label: getNextSceneObjectLabel(kind, current),
        latitude_deg,
        longitude_deg,
      },
    ]);
  };

  return (
    <main className="app-shell">
      <section className="app-shell__map">
        <MapView
          bridgeState={bridgeState}
          connectionStatus={connectionStatus}
          bridgeReady={bridgeReady}
          mapPresetKey={mapPresetKey}
          onMapPresetChange={setMapPresetKey}
          interactionMode={interactionMode}
          onInteractionModeChange={setInteractionMode}
          editorTool={editorTool}
          waypoints={waypoints}
          sceneObjects={sceneObjects}
          onAddWaypoint={addWaypoint}
          onAddSceneObject={addSceneObject}
          overlayVisibility={overlayVisibility}
          onGoalPick={setGoal}
          onResetVehicle={resetVehicle}
        />
      </section>
      <aside className="app-shell__sidebar">
        <div className="app-shell__sidebar-scroll">
          <BridgeStatusPanel
            bridgeState={bridgeState}
            connectionStatus={connectionStatus}
            errorMessage={errorMessage}
            lastCommandMessage={lastCommandMessage}
          />
          <ManualDrivePanel
            bridgeReady={bridgeReady}
            mode={currentMode}
            manualCommand={manualCommand}
            keyState={keyState}
            onModeChange={setMode}
            onResetToOrigin={async () => {
              await resetVehicle({
                x_m: 0,
                y_m: 0,
                speed_mps: 0,
                heading_deg: 90,
              });
            }}
          />
          <TelemetryPanel bridgeState={bridgeState} />
          <GoalPanel
            bridgeState={bridgeState}
            bridgeReady={bridgeReady}
            onGoalSubmit={setGoal}
          />
          <EditorPanel
            bridgeReady={bridgeReady}
            generatedWorldPath={
              bridgeState?.scene.generated_mock_perception_world.path ?? null
            }
            generatedWorldError={
              bridgeState?.scene.generated_mock_perception_world.last_error ?? null
            }
            liveScenePublishingEnabled={
              bridgeState?.scene.publish_to_perception ?? false
            }
            interactionMode={interactionMode}
            editorTool={editorTool}
            waypoints={waypoints}
            sceneObjects={sceneObjects}
            onInteractionModeChange={setInteractionMode}
            onEditorToolChange={setEditorTool}
            onClearWaypoints={() => {
              setWaypoints([]);
            }}
            onRemoveWaypoint={(id) => {
              setWaypoints((current) => current.filter((waypoint) => waypoint.id !== id));
            }}
            onActivateWaypoint={async (waypoint) => {
              await setGoal({
                goal_lat: waypoint.latitude_deg,
                goal_lon: waypoint.longitude_deg,
                goal_heading: bridgeState?.ego.heading_deg ?? 0,
              });
            }}
            onClearSceneObjects={() => {
              setSceneObjects([]);
            }}
            onRemoveSceneObject={(id) => {
              setSceneObjects((current) => current.filter((object) => object.id !== id));
            }}
          />
          <OverlayPanel
            bridgeState={bridgeState}
            overlayVisibility={overlayVisibility}
            onToggleOverlay={(overlayKey) => {
              setOverlayVisibility((current) => ({
                ...current,
                [overlayKey]: !current[overlayKey],
              }));
            }}
          />
        </div>
      </aside>
    </main>
  );
}
