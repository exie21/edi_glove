import type { KeyboardState, ManualCommand } from '../../types/bridge';
import { PanelCard } from './PanelCard';

interface ManualDrivePanelProps {
  mode: 'manual' | 'auto';
  manualCommand: ManualCommand;
  keyState: KeyboardState;
  onModeChange: (mode: 'manual' | 'auto') => Promise<void>;
  onResetToOrigin: () => Promise<void>;
}

function Keycap({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`keycap${active ? ' keycap--active' : ''}`}>{label}</span>
  );
}

export function ManualDrivePanel({
  mode,
  manualCommand,
  keyState,
  onModeChange,
  onResetToOrigin,
}: ManualDrivePanelProps) {
  return (
    <PanelCard
      title="Drive Controls"
      eyebrow="Manual / Auto"
      action={
        <div className="toggle-group">
          <button
            className={`toggle-button${mode === 'manual' ? ' toggle-button--active' : ''}`}
            onClick={() => {
              void onModeChange('manual');
            }}
            type="button"
          >
            Manual
          </button>
          <button
            className={`toggle-button${mode === 'auto' ? ' toggle-button--active' : ''}`}
            onClick={() => {
              void onModeChange('auto');
            }}
            type="button"
          >
            Auto
          </button>
        </div>
      }
    >
      <div className="drive-grid">
        <div className="drive-grid__cluster">
          <div className="drive-grid__row drive-grid__row--center">
            <Keycap label="W" active={keyState.forward} />
          </div>
          <div className="drive-grid__row">
            <Keycap label="A" active={keyState.left} />
            <Keycap label="S" active={keyState.brake} />
            <Keycap label="D" active={keyState.right} />
          </div>
          <div className="drive-grid__row drive-grid__row--center">
            <Keycap label="Space" active={keyState.hardBrake} />
          </div>
        </div>
        <div className="drive-grid__stats">
          <div>
            <span>Throttle</span>
            <strong>{manualCommand.throttle.toFixed(2)}</strong>
          </div>
          <div>
            <span>Brake</span>
            <strong>{manualCommand.brake.toFixed(2)}</strong>
          </div>
          <div>
            <span>Steer</span>
            <strong>{manualCommand.steer.toFixed(2)}</strong>
          </div>
        </div>
      </div>
      <div className="button-row">
        <button
          className="action-button action-button--ghost"
          type="button"
          onClick={() => {
            void onResetToOrigin();
          }}
        >
          Reset To Origin
        </button>
      </div>
      <p className="panel-note">
        In manual mode, the bridge gets a fresh WASD command every 100 ms. In auto
        mode, the fake vehicle follows `/control/tbs`.
      </p>
    </PanelCard>
  );
}

