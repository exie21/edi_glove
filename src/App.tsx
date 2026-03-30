import { useEffect, useState } from 'react';

import { useBridgeState } from './hooks/useBridgeState';
import { useKeyboardDrive } from './hooks/useKeyboardDrive';
import { MapView } from './components/map/MapView';
import { BridgeStatusPanel } from './components/panels/BridgeStatusPanel';
import { GoalPanel } from './components/panels/GoalPanel';
import { ManualDrivePanel } from './components/panels/ManualDrivePanel';
import { OverlayPanel } from './components/panels/OverlayPanel';
import { TelemetryPanel } from './components/panels/TelemetryPanel';
import { WaypointPanel } from './components/panels/WaypointPanel';
import { getDefaultMapPreset } from './lib/mapPresets';
import { getWaypointLabel } from './lib/waypoints';
import {
  DEFAULT_OVERLAY_VISIBILITY,
  type MapClickMode,
  type Waypoint,
} from './types/ui';

export default function App() {
  const [overlayVisibility, setOverlayVisibility] = useState(DEFAULT_OVERLAY_VISIBILITY);
  const [mapPresetKey, setMapPresetKey] = useState(getDefaultMapPreset().key);
  const [clickMode, setClickMode] = useState<MapClickMode>('goal');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const {
    bridgeState,
    connectionStatus,
    errorMessage,
    lastCommandMessage,
    setMode,
    setManualCommand,
    setGoal,
    resetVehicle,
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

  return (
    <main className="app-shell">
      <section className="app-shell__map">
        <MapView
          bridgeState={bridgeState}
          connectionStatus={connectionStatus}
          bridgeReady={bridgeReady}
          mapPresetKey={mapPresetKey}
          onMapPresetChange={setMapPresetKey}
          clickMode={clickMode}
          onClickModeChange={setClickMode}
          waypoints={waypoints}
          onAddWaypoint={addWaypoint}
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
          <WaypointPanel
            bridgeReady={bridgeReady}
            clickMode={clickMode}
            waypointCount={waypoints.length}
            waypoints={waypoints}
            onClickModeChange={setClickMode}
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
