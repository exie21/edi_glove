# Ediglove Bridge API

Ediglove talks to the ROS-side backend through the `edi_sandbox_bridge` HTTP
API. The frontend does not import ROS messages directly.

Default base URL:

- `http://127.0.0.1:8765`

API version:

- `v1`

## Endpoints

### `GET /healthz`

Quick health check for the bridge process.

### `GET /api/v1/state`

Returns the current UI snapshot, including:

- bridge mode and service readiness
- ego pose and speed
- current manual and controller commands
- goal status
- route snapshot
- reference trajectory snapshot
- MPC predicted path snapshot
- MPC debug reference path snapshot

### `POST /api/v1/control/mode`

Request body:

```json
{
  "mode": "manual"
}
```

### `POST /api/v1/control/manual`

Request body:

```json
{
  "throttle": 1.0,
  "brake": 0.0,
  "steer": -0.4
}
```

### `POST /api/v1/goals`

Request body:

```json
{
  "goal_lat": 42.3008428,
  "goal_lon": -83.6982926,
  "goal_heading": 90.0
}
```

The bridge converts the current simulated ego pose into the
`GetShortestPath` start pose, sends the request to the high planner, and
publishes the returned `HLPath` to `/control/hlpath`.

### `POST /api/v1/vehicle/reset`

Request body can use local coordinates:

```json
{
  "x_m": 0.0,
  "y_m": 0.0,
  "speed_mps": 0.0,
  "heading_deg": 90.0
}
```

Or GPS coordinates:

```json
{
  "latitude_deg": 42.3008428,
  "longitude_deg": -83.6982926,
  "speed_mps": 0.0,
  "heading_deg": 90.0
}
```

## Frontend File Ownership

- `src/lib/bridgeApi.ts`: raw HTTP client
- `src/hooks/useBridgeState.ts`: polling and command orchestration
- `src/hooks/useKeyboardDrive.ts`: WASD capture and manual command cadence
- `src/components/map/MapView.tsx`: MapLibre map and overlays
- `src/components/panels/*`: control and telemetry panels
- `src/types/bridge.ts`: normalized bridge payloads
- `src/types/ui.ts`: frontend-only UI state
