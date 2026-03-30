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
