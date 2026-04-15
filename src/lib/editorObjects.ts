import type { FeatureCollection, Point, Polygon } from 'geojson';

import type { EditorTool, SceneObject, SceneObjectKind } from '../types/ui';

const METERS_PER_DEGREE_LATITUDE = 111_320;
const DEFAULT_TRAFFIC_LIGHT_TRIGGER_RADIUS_M = 80;
const DEFAULT_TRAFFIC_LIGHT_MIN_TRIGGER_RADIUS_M = 3;
const DEFAULT_TRAFFIC_LIGHT_DETECTION_WIDTH_M = 10;

export const EDITOR_TOOL_META: Record<
  EditorTool,
  {
    label: string;
    shortLabel: string;
    description: string;
  }
> = {
  waypoint: {
    label: 'Waypoint',
    shortLabel: 'WP',
    description: 'Reusable route targets you can click later to send as goals.',
  },
  traffic_light: {
    label: 'Traffic Light',
    shortLabel: 'TL',
    description: 'Scene marker for a signalized intersection control point.',
  },
  stop_sign: {
    label: 'Stop Sign',
    shortLabel: 'SS',
    description: 'Stop sign with an attached stop bar and adjustable facing direction.',
  },
  barrel: {
    label: 'Barrel',
    shortLabel: 'BR',
    description: 'Scene marker for work-zone barrels or lane-closure props.',
  },
  delete: {
    label: 'Delete',
    shortLabel: 'DEL',
    description: 'Click an existing waypoint or scene prop on the map to remove it.',
  },
};

export const CREATE_HOTBAR_TOOLS: EditorTool[] = [
  'waypoint',
  'traffic_light',
  'stop_sign',
  'barrel',
  'delete',
];

export function getNextSceneObjectLabel(
  kind: SceneObjectKind,
  currentObjects: SceneObject[],
): string {
  const prefix = EDITOR_TOOL_META[kind].shortLabel;
  const existingNumbers = currentObjects
    .filter((object) => object.kind === kind)
    .map((object) => Number.parseInt(object.label.replace(prefix, ''), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  let nextIndex = 1;
  while (existingNumbers.includes(nextIndex)) {
    nextIndex += 1;
  }

  return `${prefix}${nextIndex}`;
}

export function editorObjectFeatureCollection(
  objects: SceneObject[],
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: objects.map((object) => ({
      type: 'Feature',
      properties: {
        id: object.id,
        kind: object.kind,
        label: object.label,
        facing_deg: object.facing_deg,
      },
      geometry: {
        type: 'Point',
        coordinates: [object.longitude_deg, object.latitude_deg],
      },
    })),
  };
}

function offsetLatLon(
  latitudeDeg: number,
  longitudeDeg: number,
  eastM: number,
  northM: number,
): [number, number] {
  const latitudeRad = (latitudeDeg * Math.PI) / 180;
  const metersPerDegreeLongitude = Math.max(
    1,
    METERS_PER_DEGREE_LATITUDE * Math.cos(latitudeRad),
  );

  return [
    longitudeDeg + eastM / metersPerDegreeLongitude,
    latitudeDeg + northM / METERS_PER_DEGREE_LATITUDE,
  ];
}

export function trafficLightVisionFeatureCollection(
  objects: SceneObject[],
): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: objects
      .filter((object) => object.kind === 'traffic_light')
      .map((object) => {
        const facingDeg = object.facing_deg ?? 0;
        const headingRad = (facingDeg * Math.PI) / 180;
        const forwardEast = Math.sin(headingRad);
        const forwardNorth = Math.cos(headingRad);
        const rightEast = Math.cos(headingRad);
        const rightNorth = -Math.sin(headingRad);
        const startM = object.min_trigger_radius_m ?? DEFAULT_TRAFFIC_LIGHT_MIN_TRIGGER_RADIUS_M;
        const endM = object.trigger_radius_m ?? DEFAULT_TRAFFIC_LIGHT_TRIGGER_RADIUS_M;
        const halfWidthM = (object.detection_width_m ?? DEFAULT_TRAFFIC_LIGHT_DETECTION_WIDTH_M) / 2;
        const corners = [
          [startM, -halfWidthM],
          [endM, -halfWidthM],
          [endM, halfWidthM],
          [startM, halfWidthM],
        ].map(([forwardM, sideM]) => offsetLatLon(
          object.latitude_deg,
          object.longitude_deg,
          forwardEast * forwardM + rightEast * sideM,
          forwardNorth * forwardM + rightNorth * sideM,
        ));

        return {
          type: 'Feature',
          properties: {
            id: object.id,
            label: object.label,
            state: object.traffic_light_state ?? 'red',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[...corners, corners[0]]],
          },
        };
      }),
  };
}

export function getSceneObjectTitle(object: SceneObject): string {
  return `${EDITOR_TOOL_META[object.kind].label} ${object.label}`;
}
