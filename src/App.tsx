import { useState } from 'react';

import { useBridgeState } from './hooks/useBridgeState';
import { useKeyboardDrive } from './hooks/useKeyboardDrive';
import { MapView } from './components/map/MapView';
import { BridgeStatusPanel } from './components/panels/BridgeStatusPanel';
import { GoalPanel } from './components/panels/GoalPanel';
import { ManualDrivePanel } from './components/panels/ManualDrivePanel';
import { OverlayPanel } from './components/panels/OverlayPanel';
import { TelemetryPanel } from './components/panels/TelemetryPanel';
import { DEFAULT_OVERLAY_VISIBILITY } from './types/ui';

export default function App() {
  const [overlayVisibility, setOverlayVisibility] = useState(DEFAULT_OVERLAY_VISIBILITY);
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

  return (
    <main className="app-shell">
      <section className="app-shell__map">
        <MapView
          bridgeState={bridgeState}
          connectionStatus={connectionStatus}
          bridgeReady={bridgeReady}
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
