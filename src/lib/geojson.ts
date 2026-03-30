import type { BridgeGoal, PathPoint } from '../types/bridge';

export function lineFeatureCollection(points: PathPoint[]): Record<string, unknown> {
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
): Record<string, unknown> {
  if (!goal) {
    return { type: 'FeatureCollection', features: [] };
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [goal.goal_lon, goal.goal_lat],
        },
      },
    ],
  };
}

