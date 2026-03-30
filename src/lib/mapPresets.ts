export type MapPresetKey = 'mcity' | 'columbus';

export interface MapPreset {
  key: MapPresetKey;
  label: string;
  description: string;
  center: {
    lat: number;
    lon: number;
  };
  bounds: [[number, number], [number, number]];
  minZoom: number;
  zoom: number;
  maxZoom: number;
  pitch: number;
}

export const MAP_PRESETS: Record<MapPresetKey, MapPreset> = {
  mcity: {
    key: 'mcity',
    label: 'MCity',
    description: 'Default Ann Arbor MCity sandbox view.',
    center: {
      lat: 42.3008428,
      lon: -83.6982926,
    },
    bounds: [
      [-83.713, 42.2925],
      [-83.684, 42.3095],
    ],
    minZoom: 15.2,
    zoom: 17.4,
    maxZoom: 19.25,
    pitch: 48,
  },
  columbus: {
    key: 'columbus',
    label: 'Columbus',
    description: 'Columbus testing center view from stack map data.',
    center: {
      lat: 43.2859055,
      lon: -89.0989139,
    },
    bounds: [
      [-89.118, 43.275],
      [-89.079, 43.297],
    ],
    minZoom: 15,
    zoom: 18.6,
    maxZoom: 20.5,
    pitch: 48,
  },
};

export function getDefaultMapPreset(): MapPreset {
  return MAP_PRESETS.mcity;
}
