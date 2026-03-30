# Ediglove UI

Ediglove is a standalone autonomy sandbox frontend built with React, TypeScript,
Vite, and MapLibre GL JS. It connects to a companion ROS 2 bridge over HTTP and
renders a live map view for manual driving, goal setting, and autonomy
inspection.

This repository is intentionally UI-only. It does not import ROS packages
directly.

## Features

- satellite map view
- ego vehicle marker
- click-to-set goal
- typed latitude / longitude goal entry
- manual / auto mode toggle
- WASD manual control
- route overlay
- reference trajectory overlay
- MPC predicted path overlay
- debug reference overlay
- per-layer visibility toggles
- bridge health and vehicle telemetry panels
- map follow mode for live monitoring

## Architecture

Ediglove expects a companion backend named `edi_sandbox_bridge` running in a
ROS 2 Humble workspace.

The bridge is responsible for:

- publishing simulated ego state
- accepting manual commands
- forwarding goal requests to the high planner
- publishing returned `HLPath` messages
- mirroring route and trajectory data into a normalized HTTP API

Default bridge URL:

- `http://127.0.0.1:8765`

Bridge/API notes:

- `docs/bridge-api.md`

## Requirements

### Frontend

- Node.js 18 or newer
- npm

Example install on macOS with Homebrew:

```bash
brew install node
```

### Backend

- ROS 2 Humble
- a ROS 2 workspace containing the `edi_sandbox_bridge` package
- optional autonomy packages for the full closed-loop stack:
  - `hd_map_service`
  - `high_planner`
  - `mid_planner_y5_edi`
  - `simple_mpc`

## Quick Start

### 1. Run The Frontend

From this repository root:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open the local Vite URL printed in the terminal, typically:

```text
http://localhost:5173
```

### 2. Run The Bridge Only

In a separate terminal, from the ROS 2 workspace root:

```bash
source /opt/ros/humble/setup.bash
colcon build --packages-select edi_sandbox_bridge
source install/setup.bash
ros2 launch edi_sandbox_bridge edi_sandbox_bridge.launch.py
```

This mode is useful for:

- frontend integration
- manual driving tests
- bridge API validation
- fake vehicle state publishing

### 3. Run The Full Sandbox Stack

In a separate terminal, from the ROS 2 workspace root:

```bash
source /opt/ros/humble/setup.bash
colcon build
source install/setup.bash
ros2 launch edi_sandbox_bridge ediglove_stack.launch.py
```

This launch is intended to bring up:

- `hd_map_service`
- `high_planner`
- `mid_planner_y5_edi`
- `simple_mpc`
- `edi_sandbox_bridge`

Use either the bridge-only launch or the full sandbox launch, not both at the
same time.

## Running Without A Bridge

The frontend can still be opened without the backend running.

Expected behavior in that mode:

- the app shell and map load normally
- bridge status shows disconnected or error
- goal requests do not complete
- no live ego, route, or trajectory data appears

## Configuration

To point the frontend at a non-default bridge URL:

```bash
cp .env.example .env.local
```

Then edit:

- `VITE_BRIDGE_BASE_URL`

## Project Layout

```text
.
├── docs/
│   └── bridge-api.md
├── src/
│   ├── components/
│   │   ├── map/
│   │   └── panels/
│   ├── hooks/
│   ├── lib/
│   ├── styles/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── index.html
├── package.json
└── vite.config.ts
```

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm run preview
```

## Troubleshooting

- If the UI stays in `error`, check `http://127.0.0.1:8765/healthz`.
- If the map loads but the overlays stay empty, inspect `GET /api/v1/state`.
- If goal clicks fail, confirm the bridge can reach `get_shortest_path`.
- If manual driving appears unresponsive, make sure the browser tab is focused.
