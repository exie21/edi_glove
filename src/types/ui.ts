export type OverlayKey = 'route' | 'trajectory' | 'predicted' | 'debug';
export type MapInteractionMode = 'goal' | 'editor';
export type EditorTool = 'waypoint' | 'traffic_light' | 'barrel' | 'delete';
export type SceneObjectKind = Exclude<EditorTool, 'waypoint' | 'delete'>;

export interface OverlayVisibility {
  route: boolean;
  trajectory: boolean;
  predicted: boolean;
  debug: boolean;
}

export interface Waypoint {
  id: string;
  label?: string;
  latitude_deg: number;
  longitude_deg: number;
}

export interface SceneObject {
  id: string;
  kind: SceneObjectKind;
  label: string;
  latitude_deg: number;
  longitude_deg: number;
}

export const DEFAULT_OVERLAY_VISIBILITY: OverlayVisibility = {
  route: true,
  trajectory: true,
  predicted: true,
  debug: true,
};
