import type { FeatureCollection, Point } from 'geojson';

import type { EditorTool, SceneObject, SceneObjectKind } from '../types/ui';

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
  barrel: {
    label: 'Barrel',
    shortLabel: 'BR',
    description: 'Scene marker for work-zone barrels or lane-closure props.',
  },
};

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
      },
      geometry: {
        type: 'Point',
        coordinates: [object.longitude_deg, object.latitude_deg],
      },
    })),
  };
}

export function getSceneObjectTitle(object: SceneObject): string {
  return `${EDITOR_TOOL_META[object.kind].label} ${object.label}`;
}
