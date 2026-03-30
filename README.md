# Ediglove UI

Standalone frontend for the `edi_sandbox_bridge` backend in `WAutoDrive`.

This repo is intentionally UI-only. It talks to the bridge over HTTP and does
not import ROS packages directly.

## Stack

- React
- TypeScript
- Vite
- MapLibre GL JS

## Features

- satellite map
- ego vehicle icon
- click-to-set goal
- manual / auto mode toggle
- WASD manual control
- route overlay
- reference trajectory overlay
- MPC predicted path overlay
- overlay visibility toggles
- bridge health and telemetry panels

## Expected Backend

The UI expects the bridge API created in:

- `WAutoDrive/workspace/src/system/edi_sandbox_bridge`

Default backend URL:

- `http://127.0.0.1:8765`

Override with:

```bash
cp .env.example .env.local
```

Then edit `VITE_BRIDGE_BASE_URL`.

Bridge/API notes live in:

- `docs/bridge-api.md`

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

## First Run Flow

1. Launch the ROS bridge stack in `WAutoDrive`.
2. Copy `.env.example` to `.env.local` if you need a non-default bridge URL.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local Vite URL and verify:
   - the bridge status turns `connected`
   - the ego icon appears on the map
   - clicking the map updates the goal panel
   - switching to manual mode lets WASD send commands

## Debugging Notes

- If the app stays in `error`, hit `http://127.0.0.1:8765/healthz` first.
- If goal clicks fail, confirm the backend can reach `get_shortest_path`.
- If the map loads but no overlays appear, check `/api/v1/state` for non-empty
  `route`, `reference_trajectory`, or MPC debug snapshots.
- If manual mode looks unresponsive, make sure the browser tab is focused so it
  can capture keyboard events.

## Local Dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Notes

- This machine did not have `node` / `npm` on PATH during scaffolding, so the
  app structure and TypeScript sources were created carefully but not executed
  with a live frontend dev server in this session.
- The design is organized so the map, bridge client, keyboard driving, and
  panels can be debugged independently.
