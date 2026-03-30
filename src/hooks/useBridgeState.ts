import { startTransition, useEffect, useRef, useState } from 'react';

import {
  clearMission,
  fetchBridgeState,
  resetVehicle,
  setGoal,
  setManualCommand,
  setMode,
  startMission,
} from '../lib/bridgeApi';
import type {
  BridgeState,
  GoalPayload,
  ManualCommand,
  MissionStartPayload,
  ResetVehiclePayload,
} from '../types/bridge';

type ConnectionStatus = 'loading' | 'connected' | 'error';

export function useBridgeState() {
  const [bridgeState, setBridgeState] = useState<BridgeState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCommandMessage, setLastCommandMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const poll = async () => {
      try {
        const nextState = await fetchBridgeState();
        if (!mountedRef.current) {
          return;
        }
        startTransition(() => {
          setBridgeState(nextState);
          setConnectionStatus('connected');
          setErrorMessage(null);
        });
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        startTransition(() => {
          setConnectionStatus('error');
          setErrorMessage(
            error instanceof Error ? error.message : 'Unknown bridge error.',
          );
        });
      }
    };

    void poll();
    const timerId = window.setInterval(() => {
      void poll();
    }, 300);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timerId);
    };
  }, []);

  const runCommand = async (
    description: string,
    runner: () => Promise<unknown>,
  ) => {
    if (mountedRef.current) {
      setErrorMessage(null);
      setLastCommandMessage(null);
    }

    try {
      await runner();
      if (!mountedRef.current) {
        return;
      }
      setLastCommandMessage(description);
      const nextState = await fetchBridgeState();
      if (!mountedRef.current) {
        return;
      }
      startTransition(() => {
        setBridgeState(nextState);
        setConnectionStatus('connected');
        setErrorMessage(null);
      });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setLastCommandMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'Command failed.');
    }
  };

  return {
    bridgeState,
    connectionStatus,
    errorMessage,
    lastCommandMessage,
    setMode: async (mode: 'manual' | 'auto') => {
      await runCommand(`Mode set to ${mode}.`, () => setMode({ mode }));
    },
    setManualCommand: async (command: ManualCommand) => {
      await setManualCommand(command);
    },
    setGoal: async (goal: GoalPayload) => {
      await runCommand(
        `Goal sent to ${goal.goal_lat.toFixed(6)}, ${goal.goal_lon.toFixed(6)}.`,
        () => setGoal(goal),
      );
    },
    resetVehicle: async (payload: ResetVehiclePayload) => {
      await runCommand('Vehicle reset sent to bridge.', () => resetVehicle(payload));
    },
    startMission: async (payload: MissionStartPayload) => {
      await runCommand(
        `Waypoint mission started with ${payload.waypoints.length} points.`,
        () => startMission(payload),
      );
    },
    clearMission: async () => {
      await runCommand('Waypoint mission cleared on the bridge.', () => clearMission());
    },
  };
}
