export type OverlayKey = 'route' | 'trajectory' | 'predicted' | 'debug';

export interface OverlayVisibility {
  route: boolean;
  trajectory: boolean;
  predicted: boolean;
  debug: boolean;
}

export const DEFAULT_OVERLAY_VISIBILITY: OverlayVisibility = {
  route: true,
  trajectory: true,
  predicted: true,
  debug: true,
};
