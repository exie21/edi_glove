import type { FeatureCollection, LineString, Point } from 'geojson';

import type { Waypoint } from '../types/ui';

export function getWaypointLabel(index: number): string {
  let value = index;
  let label = '';

  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return label;
}

export function waypointFeatureCollection(
  waypoints: Waypoint[],
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: waypoints.map((waypoint, index) => ({
      type: 'Feature',
      properties: {
        id: waypoint.id,
        label: waypoint.label ?? getWaypointLabel(index),
      },
      geometry: {
        type: 'Point',
        coordinates: [waypoint.longitude_deg, waypoint.latitude_deg],
      },
    })),
  };
}

export function waypointLineFeatureCollection(
  waypoints: Waypoint[],
): FeatureCollection<LineString> {
  if (waypoints.length < 2) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: waypoints.map((waypoint) => [
            waypoint.longitude_deg,
            waypoint.latitude_deg,
          ]),
        },
      },
    ],
  };
}
