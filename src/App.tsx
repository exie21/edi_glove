import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import { useBridgeState } from './hooks/useBridgeState';
import { useKeyboardDrive } from './hooks/useKeyboardDrive';
import { MapView } from './components/map/MapView';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
        facing_deg: object.facing_deg,
        facing_fov_deg: object.facing_fov_deg,
        stopbar_offset_m: object.stopbar_offset_m,
        traffic_light_state: object.traffic_light_state,
        trigger_radius_m: object.trigger_radius_m,
        min_trigger_radius_m: object.min_trigger_radius_m,
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
    options?: {
      facing_deg?: number;
      facing_fov_deg?: number;
      stopbar_offset_m?: number;
      traffic_light_state?: SceneObject['traffic_light_state'];
      trigger_radius_m?: number;
      min_trigger_radius_m?: number;
      detection_width_m?: number;
    },
  ) => {
    setSceneObjects((current) => [
      ...current,
      {
        id: `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        kind,
        label: getNextSceneObjectLabel(kind, current),
        latitude_deg,
        longitude_deg,
        facing_deg: options?.facing_deg,
        facing_fov_deg: options?.facing_fov_deg,
        stopbar_offset_m: options?.stopbar_offset_m,
        traffic_light_state: options?.traffic_light_state,
        trigger_radius_m: options?.trigger_radius_m,
        min_trigger_radius_m: options?.min_trigger_radius_m,
        detection_width_m: options?.detection_width_m,
      },
    ]);
  };

  const sidebarWidth = sidebarOpen ? '21.25rem' : '2.9rem';

  return (
    <main
      className={`app-shell${sidebarOpen ? '' : ' app-shell--sidebar-collapsed'}`}
      style={{ '--sidebar-offset': sidebarWidth } as CSSProperties}
    >
      <section className="app-shell__map">
        <MapView
          bridgeState={bridgeState}
          connectionStatus={connectionStatus}
          bridgeReady={bridgeReady}
          errorMessage={errorMessage}
          lastCommandMessage={lastCommandMessage}
          mapPresetKey={mapPresetKey}
          onMapPresetChange={setMapPresetKey}
          interactionMode={interactionMode}
          onInteractionModeChange={setInteractionMode}
          editorTool={editorTool}
          onEditorToolChange={setEditorTool}
          waypoints={waypoints}
          sceneObjects={sceneObjects}
          onAddWaypoint={addWaypoint}
          onAddSceneObject={addSceneObject}
          onUpdateSceneObject={(id, updates) => {
            setSceneObjects((current) => current.map((object) => (
              object.id === id
                ? {
                    ...object,
                    ...updates,
                  }
                : object
            )));
          }}
          onRemoveWaypoint={(id) => {
            setWaypoints((current) => current.filter((waypoint) => waypoint.id !== id));
          }}
          onRemoveSceneObject={(id) => {
            setSceneObjects((current) => current.filter((object) => object.id !== id));
          }}
          overlayVisibility={overlayVisibility}
          onGoalPick={setGoal}
          onResetVehicle={resetVehicle}
        />
      </section>
      <aside className={`app-shell__sidebar${sidebarOpen ? '' : ' app-shell__sidebar--collapsed'}`}>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={sidebarOpen}
          onClick={() => {
            setSidebarOpen((current) => !current);
          }}
        >
          <span className="sidebar-toggle__arrow">{sidebarOpen ? '>' : '<'}</span>
        </button>
        <div className="app-shell__sidebar-scroll">
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
            waypoints={waypoints}
            sceneObjects={sceneObjects}
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
