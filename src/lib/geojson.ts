import type {
  FeatureCollection,
  LineString,
  Point,
} from 'geojson';

import type { BridgeGoal, PathPoint } from '../types/bridge';

export function lineFeatureCollection(
  points: PathPoint[],
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: points.length >= 2
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: points.map((point) => [
                point.longitude_deg,
                point.latitude_deg,
              ]),
            },
          },
        ]
      : [],
  };
}

export function pointFeatureCollection(
  goal: BridgeGoal | null | undefined,
): FeatureCollection<Point> {
  if (!goal) {
    return { type: 'FeatureCollection', features: [] };
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          label: 'G',
        },
        geometry: {
          type: 'Point',
          coordinates: [goal.goal_lon, goal.goal_lat],
        },
      },
    ],
  };
}
