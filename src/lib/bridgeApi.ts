import type {
  BridgeState,
  CommandAck,
  GoalPayload,
  ManualCommand,
  MissionStartPayload,
  ModePayload,
  ResetVehiclePayload,
} from '../types/bridge';

const bridgeBaseUrl = (
  import.meta.env.VITE_BRIDGE_BASE_URL ?? 'http://127.0.0.1:8765'
).replace(/\/$/, '');

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${bridgeBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const fallback = `Bridge request failed: ${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? fallback);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(fallback);
    }
  }

  return response.json() as Promise<T>;
}

export function getBridgeBaseUrl(): string {
  return bridgeBaseUrl;
}

export async function fetchBridgeState(): Promise<BridgeState> {
  return request<BridgeState>('/api/v1/state');
}

export async function setMode(payload: ModePayload): Promise<CommandAck> {
  return request<CommandAck>('/api/v1/control/mode', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function setManualCommand(
  payload: ManualCommand,
): Promise<CommandAck> {
  return request<CommandAck>('/api/v1/control/manual', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function setGoal(payload: GoalPayload): Promise<CommandAck> {
  return request<CommandAck>('/api/v1/goals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resetVehicle(
  payload: ResetVehiclePayload,
): Promise<CommandAck> {
  return request<CommandAck>('/api/v1/vehicle/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function startMission(
  payload: MissionStartPayload,
): Promise<CommandAck> {
  return request<CommandAck>('/api/v1/mission/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function clearMission(): Promise<CommandAck> {
  return request<CommandAck>('/api/v1/mission/clear', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
