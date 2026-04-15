import { useEffect, useRef, useState } from 'react';
import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Map as MapLibreMap,
  type Marker,
  type StyleSpecification,
} from 'maplibre-gl';

import { BridgeStatusPanel } from '../panels/BridgeStatusPanel';
import { lineFeatureCollection, pointFeatureCollection } from '../../lib/geojson';
import {
  CREATE_HOTBAR_TOOLS,
  EDITOR_TOOL_META,
  editorObjectFeatureCollection,
  trafficLightVisionFeatureCollection,
} from '../../lib/editorObjects';
import {
  MAP_PRESETS,
  type MapPresetKey,
} from '../../lib/mapPresets';
import { createScenePropMarkerElement } from '../../lib/scenePropMarker';
import { waypointFeatureCollection } from '../../lib/waypoints';
import type {
  BridgeGoal,
  BridgeState,
  GoalPayload,
  ResetVehiclePayload,
} from '../../types/bridge';
import type {
  EditorTool,
  MapInteractionMode,
  OverlayVisibility,
  SceneObject,
  TrafficLightState,
  Waypoint,
} from '../../types/ui';

const FOLLOW_EGO_MIN_DELTA_DEG = 1e-6;
const MAX_SOURCE_ZOOM = 19;
const MAP_STATUS_TIMEOUT_MS = 3000;
const MIN_SCENE_PROP_SCALE = 0.82;
const MAX_SCENE_PROP_SCALE = 1.22;
const STOP_SIGN_DEFAULT_FACING_DEG = 0.0;
const STOP_SIGN_DEFAULT_STOPBAR_OFFSET_M = 3.0;
const TRAFFIC_LIGHT_DEFAULT_STATE: TrafficLightState = 'red';
const TRAFFIC_LIGHT_DEFAULT_TRIGGER_RADIUS_M = 80.0;
const TRAFFIC_LIGHT_DEFAULT_MIN_TRIGGER_RADIUS_M = 3.0;
const TRAFFIC_LIGHT_DEFAULT_DETECTION_WIDTH_M = 10.0;
const TRAFFIC_LIGHT_DEFAULT_FACING_FOV_DEG = 160.0;
const TRAFFIC_LIGHT_STATES: TrafficLightState[] = ['red', 'yellow', 'green'];

function getScenePropScaleForZoom(zoom: number): number {
  const normalizedZoom = Math.max(15, Math.min(21, zoom));
  const progress = (normalizedZoom - 15) / 6;
  return MIN_SCENE_PROP_SCALE + (MAX_SCENE_PROP_SCALE - MIN_SCENE_PROP_SCALE) * progress;
}

function normalizeCompassDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function computeFacingFromClientPoint(
  map: MapLibreMap,
  object: SceneObject,
  clientX: number,
  clientY: number,
): number {
  const center = map.project([object.longitude_deg, object.latitude_deg]);
  const mapRect = map.getCanvasContainer().getBoundingClientRect();
  const dxPx = clientX - mapRect.left - center.x;
  const dyPx = clientY - mapRect.top - center.y;
  return normalizeCompassDegrees((Math.atan2(dxPx, -dyPx) * 180.0) / Math.PI);
}

function stopMapGesturePropagation(event: Event): void {
  event.stopPropagation();
}

function suspendMapDragPan(
  map: MapLibreMap,
  restoreRef: { current: boolean | null },
): void {
  if (restoreRef.current === null) {
    restoreRef.current = map.dragPan.isEnabled();
  }
  if (map.dragPan.isEnabled()) {
    map.dragPan.disable();
  }
}

function resumeMapDragPan(
  map: MapLibreMap,
  restoreRef: { current: boolean | null },
): void {
  if (restoreRef.current) {
    map.dragPan.enable();
  }
  restoreRef.current = null;
}

function resumeMapDragPanOnGestureEnd(
  map: MapLibreMap,
  restoreRef: { current: boolean | null },
): void {
  const resume = () => {
    resumeMapDragPan(map, restoreRef);
  };

  window.addEventListener('mouseup', resume, { once: true });
  window.addEventListener('touchend', resume, { once: true });
  window.addEventListener('touchcancel', resume, { once: true });
  window.addEventListener('blur', resume, { once: true });
}

function buildSatelliteStyle(): Record<string, unknown> {
  return {
    version: 8,
    sources: {
      esri_satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: MAX_SOURCE_ZOOM,
        attribution: 'Esri',
      },
    },
    layers: [
      {
        id: 'esri_satellite',
        type: 'raster',
        source: 'esri_satellite',
        paint: {
          'raster-resampling': 'linear',
        },
      },
    ],
  };
}

function syncOverlayLayerVisibility(
  map: MapLibreMap,
  overlayVisibility: OverlayVisibility,
): void {
  const layerVisibility: Array<[string, boolean]> = [
    ['route-layer', overlayVisibility.route],
    ['trajectory-layer', overlayVisibility.trajectory],
    ['predicted-layer', overlayVisibility.predicted],
    ['debug-layer', overlayVisibility.debug],
  ];

  for (const [layerId, visible] of layerVisibility) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

function getTrafficLightState(object: SceneObject): TrafficLightState {
  if (
    object.traffic_light_state === 'red'
    || object.traffic_light_state === 'yellow'
    || object.traffic_light_state === 'green'
    || object.traffic_light_state === 'off'
  ) {
    return object.traffic_light_state;
  }
  return TRAFFIC_LIGHT_DEFAULT_STATE;
}

function applySceneObjectMarkerState(
  element: HTMLElement,
  object: SceneObject,
  selected: boolean,
  draggable: boolean,
): void {
  element.classList.toggle('scene-prop-marker--selected', selected);
  element.classList.toggle('scene-prop-marker--draggable', draggable);
  for (const state of ['red', 'yellow', 'green', 'off'] as TrafficLightState[]) {
    element.classList.toggle(
      `scene-prop-marker--signal-${state}`,
      object.kind === 'traffic_light' && getTrafficLightState(object) === state,
    );
  }
}

interface MapViewProps {
  bridgeState: BridgeState | null;
  connectionStatus: 'loading' | 'connected' | 'error';
  bridgeReady: boolean;
  errorMessage: string | null;
  lastCommandMessage: string | null;
  mapPresetKey: MapPresetKey;
  onMapPresetChange: (preset: MapPresetKey) => void;
  interactionMode: MapInteractionMode;
  onInteractionModeChange: (mode: MapInteractionMode) => void;
  editorTool: EditorTool;
  onEditorToolChange: (tool: EditorTool) => void;
  waypoints: Waypoint[];
  sceneObjects: SceneObject[];
  onAddWaypoint: (latitude_deg: number, longitude_deg: number) => void;
  onAddSceneObject: (
    kind: SceneObject['kind'],
    latitude_deg: number,
    longitude_deg: number,
    options?: {
      facing_deg?: number;
      facing_fov_deg?: number;
      stopbar_offset_m?: number;
      traffic_light_state?: TrafficLightState;
      trigger_radius_m?: number;
      min_trigger_radius_m?: number;
      detection_width_m?: number;
    },
  ) => void;
  onUpdateSceneObject: (id: string, updates: Partial<SceneObject>) => void;
  onRemoveWaypoint: (id: string) => void;
  onRemoveSceneObject: (id: string) => void;
  overlayVisibility: OverlayVisibility;
  onGoalPick: (goal: GoalPayload) => Promise<void>;
  onResetVehicle: (payload: ResetVehiclePayload) => Promise<void>;
}

export function MapView({
  bridgeState,
  connectionStatus,
  bridgeReady,
  errorMessage,
  lastCommandMessage,
  mapPresetKey,
  onMapPresetChange,
  interactionMode,
  onInteractionModeChange,
  editorTool,
  onEditorToolChange,
  waypoints,
  sceneObjects,
  onAddWaypoint,
  onAddSceneObject,
  onUpdateSceneObject,
  onRemoveWaypoint,
  onRemoveSceneObject,
  overlayVisibility,
  onGoalPick,
  onResetVehicle,
}: MapViewProps) {
  const [followEgo, setFollowEgo] = useState(true);
  const [previewGoal, setPreviewGoal] = useState<BridgeGoal | null>(null);
  const [mapStatusMessage, setMapStatusMessage] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(true);
  const [selectedSceneObjectId, setSelectedSceneObjectId] = useState<string | null>(null);
  const [stopSignFacingDeg, setStopSignFacingDeg] = useState(STOP_SIGN_DEFAULT_FACING_DEG);
  const [trafficLightState, setTrafficLightState] = useState<TrafficLightState>(
    TRAFFIC_LIGHT_DEFAULT_STATE,
  );
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapReadyRef = useRef(false);
  const egoMarkerRef = useRef<Marker | null>(null);
  const sceneObjectMarkersRef = useRef<Map<string, Marker>>(new Map());
  const rotationHandleElementRef = useRef<HTMLSpanElement | null>(null);
  const rotationHandleDraggingRef = useRef(false);
  const rotationDraftFacingDegRef = useRef(STOP_SIGN_DEFAULT_FACING_DEG);
  const sceneObjectDragPanRestoreRef = useRef<boolean | null>(null);
  const rotationHandleDragPanRestoreRef = useRef<boolean | null>(null);
  const initialCameraSetRef = useRef(false);
  const lastFollowCenterRef = useRef<{ lat: number; lon: number } | null>(null);
  const latestBridgeStateRef = useRef<BridgeState | null>(bridgeState);
  const latestBridgeReadyRef = useRef(bridgeReady);
  const latestInteractionModeRef = useRef<MapInteractionMode>(interactionMode);
  const latestEditorToolRef = useRef<EditorTool>(editorTool);
  const latestGoalHandlerRef = useRef(onGoalPick);
  const latestAddWaypointRef = useRef(onAddWaypoint);
  const latestAddSceneObjectRef = useRef(onAddSceneObject);
  const latestUpdateSceneObjectRef = useRef(onUpdateSceneObject);
  const latestRemoveWaypointRef = useRef(onRemoveWaypoint);
  const latestRemoveSceneObjectRef = useRef(onRemoveSceneObject);
  const latestOverlayVisibilityRef = useRef(overlayVisibility);
  const latestWaypointsRef = useRef(waypoints);
  const latestSceneObjectsRef = useRef(sceneObjects);
  const latestSelectedSceneObjectIdRef = useRef<string | null>(selectedSceneObjectId);
  const activePreset = MAP_PRESETS[mapPresetKey];
  const hasLiveBridgeState = bridgeReady && Boolean(bridgeState);
  const followButtonActive = followEgo && hasLiveBridgeState;
  const createModeEnabled = interactionMode === 'editor';
  const selectedSceneObject = selectedSceneObjectId
    ? sceneObjects.find((object) => object.id === selectedSceneObjectId) ?? null
    : null;
  const selectedStopSign = selectedSceneObject?.kind === 'stop_sign' ? selectedSceneObject : null;
  const selectedTrafficLight = selectedSceneObject?.kind === 'traffic_light'
    ? selectedSceneObject
    : null;
  const selectedDirectionalObject = selectedSceneObject
    && (selectedSceneObject.kind === 'stop_sign' || selectedSceneObject.kind === 'traffic_light')
    ? selectedSceneObject
    : null;

  const waypointLabel = (waypoint: Waypoint) => waypoint.label ?? 'Waypoint';

  const removeRotationHandleMarker = (map?: MapLibreMap) => {
    if (map) {
      resumeMapDragPan(map, rotationHandleDragPanRestoreRef);
    }
    rotationHandleElementRef.current?.remove();
    rotationHandleElementRef.current = null;
    rotationHandleDraggingRef.current = false;
  };

  const syncRotationHandleMarker = (map: MapLibreMap) => {
    try {
      const selectedObjectId = latestSelectedSceneObjectIdRef.current;
      const selectedObject = selectedObjectId
        ? latestSceneObjectsRef.current.find((candidate) => candidate.id === selectedObjectId) ?? null
        : null;
      const activeDirectionalObject = selectedObject
        && (selectedObject.kind === 'stop_sign' || selectedObject.kind === 'traffic_light')
        ? selectedObject
        : null;
      const canEditSelection = latestInteractionModeRef.current === 'editor'
        && latestEditorToolRef.current !== 'delete';

      if (!canEditSelection || !activeDirectionalObject) {
        removeRotationHandleMarker(map);
        return;
      }

      const markerElement = sceneObjectMarkersRef.current
        .get(activeDirectionalObject.id)
        ?.getElement();
      if (!markerElement) {
        removeRotationHandleMarker(map);
        return;
      }

      if (
        !rotationHandleElementRef.current
        || rotationHandleElementRef.current.parentElement !== markerElement
      ) {
        rotationHandleElementRef.current?.remove();

        const element = document.createElement('span');
        element.className = 'scene-rotation-handle scene-rotation-handle--attached';
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
        element.innerHTML = '<span class="scene-rotation-handle__icon">↻</span>';

        const updateFacingFromPointer = (event: PointerEvent) => {
          const currentObjectId = latestSelectedSceneObjectIdRef.current;
          if (!currentObjectId) {
            return;
          }
          const currentDirectionalObject = latestSceneObjectsRef.current.find(
            (candidate) => (
              candidate.id === currentObjectId
              && (candidate.kind === 'stop_sign' || candidate.kind === 'traffic_light')
            ),
          );
          if (!currentDirectionalObject) {
            return;
          }

          const nextFacingDeg = computeFacingFromClientPoint(
            map,
            currentDirectionalObject,
            event.clientX,
            event.clientY,
          );
          rotationDraftFacingDegRef.current = nextFacingDeg;
          setStopSignFacingDeg(nextFacingDeg);
          sceneObjectMarkersRef.current
            .get(currentDirectionalObject.id)
            ?.getElement()
            .style
            .setProperty('--scene-prop-yaw', `${nextFacingDeg.toFixed(1)}deg`);

          const visionSource = map.getSource('traffic-light-vision-source') as GeoJSONSource | undefined;
          visionSource?.setData(trafficLightVisionFeatureCollection(
            latestSceneObjectsRef.current.map((object) => (
              object.id === currentDirectionalObject.id
                ? {
                    ...object,
                    facing_deg: nextFacingDeg,
                  }
                : object
            )),
          ));
        };

        const finishRotation = (event: PointerEvent) => {
          event.preventDefault();
          event.stopPropagation();
          window.removeEventListener('pointermove', updateFacingFromPointer);
          window.removeEventListener('pointerup', finishRotation);
          window.removeEventListener('pointercancel', finishRotation);
          if (element.hasPointerCapture(event.pointerId)) {
            element.releasePointerCapture(event.pointerId);
          }
          rotationHandleDraggingRef.current = false;
          resumeMapDragPan(map, rotationHandleDragPanRestoreRef);

          const currentObjectId = latestSelectedSceneObjectIdRef.current;
          const currentDirectionalObject = currentObjectId
            ? latestSceneObjectsRef.current.find(
                (candidate) => (
                  candidate.id === currentObjectId
                  && (candidate.kind === 'stop_sign' || candidate.kind === 'traffic_light')
                ),
              )
            : null;
          if (!currentDirectionalObject) {
            return;
          }

          const nextFacingDeg = normalizeCompassDegrees(rotationDraftFacingDegRef.current);
          setStopSignFacingDeg(nextFacingDeg);
          latestUpdateSceneObjectRef.current(currentDirectionalObject.id, {
            facing_deg: nextFacingDeg,
          });
          setMapStatusMessage(
            `${currentDirectionalObject.label} rotated to ${nextFacingDeg.toFixed(0)} degrees.`,
          );
        };

        element.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          rotationHandleDraggingRef.current = true;
          suspendMapDragPan(map, rotationHandleDragPanRestoreRef);
          element.setPointerCapture(event.pointerId);
          updateFacingFromPointer(event);
          window.addEventListener('pointermove', updateFacingFromPointer);
          window.addEventListener('pointerup', finishRotation);
          window.addEventListener('pointercancel', finishRotation);
        });
        element.addEventListener('click', stopMapGesturePropagation);

        markerElement.append(element);
        rotationHandleElementRef.current = element;
      }

      rotationDraftFacingDegRef.current = normalizeCompassDegrees(
        activeDirectionalObject.facing_deg ?? stopSignFacingDeg,
      );
      rotationHandleElementRef.current.setAttribute(
        'aria-label',
        `Rotate ${activeDirectionalObject.label}`,
      );
    } catch (error) {
      console.error('Failed to sync the scene-object rotation handle.', error);
      removeRotationHandleMarker(map);
      setMapStatusMessage('Rotation editing is temporarily unavailable.');
    }
  };

  const applySceneObjectMarkerScale = (map: MapLibreMap) => {
    const scale = getScenePropScaleForZoom(map.getZoom()).toFixed(3);
    for (const [markerId, marker] of sceneObjectMarkersRef.current.entries()) {
      const sceneObject = latestSceneObjectsRef.current.find((candidate) => candidate.id === markerId);
      marker.getElement().style.setProperty('--scene-prop-scale', scale);
      marker.getElement().style.setProperty(
        '--scene-prop-yaw',
        `${normalizeCompassDegrees(sceneObject?.facing_deg ?? 0).toFixed(1)}deg`,
      );
      if (sceneObject) {
        applySceneObjectMarkerState(
          marker.getElement(),
          sceneObject,
          Boolean(
            latestSelectedSceneObjectIdRef.current
            && markerId === latestSelectedSceneObjectIdRef.current,
          ),
          latestInteractionModeRef.current === 'editor'
            && latestEditorToolRef.current !== 'delete',
        );
      }
    }
  };

  const handleSceneObjectClick = (objectId: string) => {
    const object = latestSceneObjectsRef.current.find((candidate) => candidate.id === objectId);
    if (!object) {
      return;
    }

    if (
      latestInteractionModeRef.current === 'editor'
      && latestEditorToolRef.current === 'delete'
    ) {
      latestRemoveSceneObjectRef.current(object.id);
      setMapStatusMessage(`${object.label} removed from the scene.`);
      return;
    }

    if (latestInteractionModeRef.current === 'editor') {
      latestSelectedSceneObjectIdRef.current = object.id;
      setSelectedSceneObjectId(object.id);
      if (mapRef.current) {
        syncSceneObjectMarkers(mapRef.current);
      }
      if (object.kind === 'stop_sign') {
        setStopSignFacingDeg(
          normalizeCompassDegrees(object.facing_deg ?? STOP_SIGN_DEFAULT_FACING_DEG),
        );
        setMapStatusMessage(
          `${object.label} selected. Drag it to move, or drag the rotate handle to aim it.`,
        );
        return;
      }
      if (object.kind === 'traffic_light') {
        setStopSignFacingDeg(
          normalizeCompassDegrees(object.facing_deg ?? STOP_SIGN_DEFAULT_FACING_DEG),
        );
        setTrafficLightState(object.traffic_light_state ?? TRAFFIC_LIGHT_DEFAULT_STATE);
        setMapStatusMessage(
          `${object.label} selected. Drag it to move, rotate it, or change its signal state.`,
        );
        return;
      }
      setMapStatusMessage(
        `${object.label} selected. Drag it on the map to move it.`,
      );
      return;
    }

    setMapStatusMessage(`${object.label} is a local scene object.`);
  };

  const syncSceneObjectMarkers = (map: MapLibreMap) => {
    const nextIds = new Set(latestSceneObjectsRef.current.map((object) => object.id));

    for (const [markerId, marker] of sceneObjectMarkersRef.current.entries()) {
      if (!nextIds.has(markerId)) {
        marker.remove();
        sceneObjectMarkersRef.current.delete(markerId);
      }
    }

    const scale = getScenePropScaleForZoom(map.getZoom()).toFixed(3);

    for (const object of latestSceneObjectsRef.current) {
      const marker = sceneObjectMarkersRef.current.get(object.id);
      const signature = `${object.kind}:${object.label}`;
      const canDragObject = (
        latestInteractionModeRef.current === 'editor'
        && latestEditorToolRef.current !== 'delete'
      );

      if (!marker || marker.getElement().dataset.signature !== signature) {
        marker?.remove();
        sceneObjectMarkersRef.current.delete(object.id);

        const element = createScenePropMarkerElement(object.kind, object.label);
        element.dataset.signature = signature;
        element.style.setProperty('--scene-prop-scale', scale);
        element.style.setProperty(
          '--scene-prop-yaw',
          `${normalizeCompassDegrees(object.facing_deg ?? 0).toFixed(1)}deg`,
        );
        applySceneObjectMarkerState(
          element,
          object,
          Boolean(
            latestSelectedSceneObjectIdRef.current
            && object.id === latestSelectedSceneObjectIdRef.current,
          ),
          canDragObject,
        );
        element.addEventListener('pointerdown', stopMapGesturePropagation);
        element.addEventListener('dblclick', stopMapGesturePropagation);
        element.addEventListener('mousedown', () => {
          const canEditObjectNow = latestInteractionModeRef.current === 'editor'
            && latestEditorToolRef.current !== 'delete';
          if (!canEditObjectNow) {
            return;
          }
          latestSelectedSceneObjectIdRef.current = object.id;
          setSelectedSceneObjectId(object.id);
          suspendMapDragPan(map, sceneObjectDragPanRestoreRef);
          resumeMapDragPanOnGestureEnd(map, sceneObjectDragPanRestoreRef);
        });
        element.addEventListener('touchstart', () => {
          const canEditObjectNow = latestInteractionModeRef.current === 'editor'
            && latestEditorToolRef.current !== 'delete';
          if (!canEditObjectNow) {
            return;
          }
          latestSelectedSceneObjectIdRef.current = object.id;
          setSelectedSceneObjectId(object.id);
          suspendMapDragPan(map, sceneObjectDragPanRestoreRef);
          resumeMapDragPanOnGestureEnd(map, sceneObjectDragPanRestoreRef);
        });
        element.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          handleSceneObjectClick(object.id);
        });

        const nextMarker = new maplibregl.Marker({
          element,
          anchor: 'bottom',
          pitchAlignment: 'map',
          rotationAlignment: 'map',
          draggable: canDragObject,
        })
          .setLngLat([object.longitude_deg, object.latitude_deg])
          .addTo(map);

        nextMarker.on('dragstart', () => {
          latestSelectedSceneObjectIdRef.current = object.id;
          setSelectedSceneObjectId(object.id);
          suspendMapDragPan(map, sceneObjectDragPanRestoreRef);
        });
        nextMarker.on('drag', () => {
          if (
            (object.kind === 'stop_sign' || object.kind === 'traffic_light')
            && !rotationHandleDraggingRef.current
          ) {
            syncRotationHandleMarker(map);
          }
          if (object.kind === 'traffic_light') {
            const lngLat = nextMarker.getLngLat();
            const visionSource = map.getSource('traffic-light-vision-source') as GeoJSONSource | undefined;
            visionSource?.setData(trafficLightVisionFeatureCollection(
              latestSceneObjectsRef.current.map((candidate) => (
                candidate.id === object.id
                  ? {
                      ...candidate,
                      latitude_deg: lngLat.lat,
                      longitude_deg: lngLat.lng,
                    }
                  : candidate
              )),
            ));
          }
        });
        nextMarker.on('dragend', () => {
          resumeMapDragPan(map, sceneObjectDragPanRestoreRef);
          const lngLat = nextMarker.getLngLat();
          latestUpdateSceneObjectRef.current(object.id, {
            latitude_deg: lngLat.lat,
            longitude_deg: lngLat.lng,
          });
          setMapStatusMessage(`${object.label} moved on the map.`);
          if (mapRef.current) {
            syncRotationHandleMarker(mapRef.current);
          }
        });

        sceneObjectMarkersRef.current.set(object.id, nextMarker);
        continue;
      }

      marker
        .setLngLat([object.longitude_deg, object.latitude_deg]);
      marker.setDraggable(canDragObject);
      marker.getElement().style.setProperty('--scene-prop-scale', scale);
      marker.getElement().style.setProperty(
        '--scene-prop-yaw',
        `${normalizeCompassDegrees(object.facing_deg ?? 0).toFixed(1)}deg`,
      );
      applySceneObjectMarkerState(
        marker.getElement(),
        object,
        Boolean(
          latestSelectedSceneObjectIdRef.current
          && object.id === latestSelectedSceneObjectIdRef.current,
        ),
        canDragObject,
      );
    }

    syncRotationHandleMarker(map);
  };

  const activateWaypointGoal = (waypoint: Waypoint) => {
    const label = waypointLabel(waypoint);
    const goal: BridgeGoal = {
      goal_lat: waypoint.latitude_deg,
      goal_lon: waypoint.longitude_deg,
      goal_heading: latestBridgeStateRef.current?.ego.heading_deg ?? 0,
    };

    setPreviewGoal(goal);

    if (!latestBridgeReadyRef.current) {
      setMapStatusMessage(`${label} selected as a local goal preview.`);
      return;
    }

    setMapStatusMessage(`Routing to ${label}...`);
    void latestGoalHandlerRef.current(goal)
      .then(() => {
        setMapStatusMessage(`${label} sent as the active goal.`);
      })
      .catch((error) => {
        setMapStatusMessage(
          error instanceof Error ? error.message : `Routing to ${label} failed.`,
        );
      });
  };

  latestBridgeStateRef.current = bridgeState;
  latestBridgeReadyRef.current = bridgeReady;
  latestInteractionModeRef.current = interactionMode;
  latestEditorToolRef.current = editorTool;
  latestGoalHandlerRef.current = onGoalPick;
  latestAddWaypointRef.current = onAddWaypoint;
  latestAddSceneObjectRef.current = onAddSceneObject;
  latestUpdateSceneObjectRef.current = onUpdateSceneObject;
  latestRemoveWaypointRef.current = onRemoveWaypoint;
  latestRemoveSceneObjectRef.current = onRemoveSceneObject;
  latestOverlayVisibilityRef.current = overlayVisibility;
  latestWaypointsRef.current = waypoints;
  latestSceneObjectsRef.current = sceneObjects;
  latestSelectedSceneObjectIdRef.current = selectedSceneObjectId;

  useEffect(() => {
    if (!mapStatusMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMapStatusMessage((current) => (current === mapStatusMessage ? null : current));
    }, MAP_STATUS_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [mapStatusMessage]);

  useEffect(() => {
    if (!selectedSceneObjectId) {
      return;
    }
    const selectedExists = sceneObjects.some((object) => object.id === selectedSceneObjectId);
    if (!selectedExists) {
      setSelectedSceneObjectId(null);
    }
  }, [sceneObjects, selectedSceneObjectId]);

  useEffect(() => {
    if (interactionMode !== 'editor') {
      setSelectedSceneObjectId(null);
    }
  }, [interactionMode]);

  useEffect(() => {
    if (!selectedStopSign) {
      return;
    }
    setStopSignFacingDeg(
      normalizeCompassDegrees(selectedStopSign.facing_deg ?? STOP_SIGN_DEFAULT_FACING_DEG),
    );
  }, [selectedStopSign]);

  useEffect(() => {
    if (!selectedTrafficLight) {
      return;
    }
    setStopSignFacingDeg(
      normalizeCompassDegrees(selectedTrafficLight.facing_deg ?? STOP_SIGN_DEFAULT_FACING_DEG),
    );
    setTrafficLightState(getTrafficLightState(selectedTrafficLight));
  }, [selectedTrafficLight]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    syncSceneObjectMarkers(map);
  }, [sceneObjects, selectedSceneObjectId, selectedStopSign]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    syncSceneObjectMarkers(map);
    syncRotationHandleMarker(map);
  }, [editorTool, interactionMode]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const container = mapContainerRef.current;
    const map = new maplibregl.Map({
      container,
      style: buildSatelliteStyle() as StyleSpecification,
      center: [activePreset.center.lon, activePreset.center.lat],
      zoom: activePreset.zoom,
      pitch: activePreset.pitch,
      bearing: 0,
      minZoom: activePreset.minZoom,
      maxZoom: activePreset.maxZoom,
      maxBounds: activePreset.bounds as LngLatBoundsLike,
      antialias: true,
      renderWorldCopies: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    const egoMarkerElement = document.createElement('div');
    egoMarkerElement.className = 'ego-marker';
    egoMarkerElement.innerHTML = '<span class="ego-marker__core"></span>';

    egoMarkerRef.current = new maplibregl.Marker({
      element: egoMarkerElement,
      rotationAlignment: 'map',
      pitchAlignment: 'map',
    })
      .setLngLat([activePreset.center.lon, activePreset.center.lat])
      .addTo(map);

    const resizeMap = () => {
      map.resize();
    };
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          resizeMap();
        })
      : null;
    resizeObserver?.observe(container);
    window.addEventListener('resize', resizeMap);
    const syncSceneMarkerScale = () => {
      applySceneObjectMarkerScale(map);
      syncRotationHandleMarker(map);
    };
    map.on('zoom', syncSceneMarkerScale);
    map.on('move', syncSceneMarkerScale);

    map.on('load', () => {
      mapReadyRef.current = true;
      resizeMap();

      map.addSource('route-source', {
        type: 'geojson',
        data: lineFeatureCollection([]),
      });
      map.addSource('trajectory-source', {
        type: 'geojson',
        data: lineFeatureCollection([]),
      });
      map.addSource('predicted-source', {
        type: 'geojson',
        data: lineFeatureCollection([]),
      });
      map.addSource('debug-source', {
        type: 'geojson',
        data: lineFeatureCollection([]),
      });
      map.addSource('goal-source', {
        type: 'geojson',
        data: pointFeatureCollection(null),
      });
      map.addSource('waypoints-source', {
        type: 'geojson',
        data: waypointFeatureCollection([]),
      });
      map.addSource('editor-objects-source', {
        type: 'geojson',
        data: editorObjectFeatureCollection([]),
      });
      map.addSource('traffic-light-vision-source', {
        type: 'geojson',
        data: trafficLightVisionFeatureCollection([]),
      });

      map.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#ffb24d',
          'line-width': 4.8,
          'line-opacity': 0.92,
          'line-dasharray': [0.25, 1.35],
        },
      });
      map.addLayer({
        id: 'trajectory-layer',
        type: 'line',
        source: 'trajectory-source',
        paint: {
          'line-color': '#22d7c4',
          'line-width': 4,
          'line-opacity': 0.85,
        },
      });
      map.addLayer({
        id: 'predicted-layer',
        type: 'line',
        source: 'predicted-source',
        paint: {
          'line-color': '#ff6e63',
          'line-width': 3,
          'line-opacity': 0.95,
          'line-dasharray': [1.2, 1.2],
        },
      });
      map.addLayer({
        id: 'debug-layer',
        type: 'line',
        source: 'debug-source',
        paint: {
          'line-color': '#b6ff73',
          'line-width': 2,
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'traffic-light-vision-fill-layer',
        type: 'fill',
        source: 'traffic-light-vision-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'state'],
            'green',
            '#87f1ba',
            'yellow',
            '#ffe177',
            'red',
            '#ff7c73',
            '#d7dee6',
          ],
          'fill-opacity': 0.16,
        },
      });
      map.addLayer({
        id: 'traffic-light-vision-line-layer',
        type: 'line',
        source: 'traffic-light-vision-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'state'],
            'green',
            '#87f1ba',
            'yellow',
            '#ffe177',
            'red',
            '#ff7c73',
            '#d7dee6',
          ],
          'line-width': 1.8,
          'line-opacity': 0.72,
          'line-dasharray': [1.1, 0.9],
        },
      });
      map.addLayer({
        id: 'goal-layer',
        type: 'circle',
        source: 'goal-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            3.2,
            18.5,
            5.3,
            20.5,
            7,
          ],
          'circle-color': '#ffcf78',
          'circle-stroke-color': '#071018',
          'circle-stroke-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0.9,
            20.5,
            1.45,
          ],
          'circle-pitch-alignment': 'map',
          'circle-pitch-scale': 'map',
        },
      });
      map.addLayer({
        id: 'goal-label-layer',
        type: 'symbol',
        source: 'goal-source',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            8,
            18.5,
            9.4,
            20.5,
            10.5,
          ],
          'text-font': ['Open Sans Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#071018',
          'text-halo-color': 'rgba(255, 255, 255, 0.15)',
          'text-halo-width': 0.6,
        },
      });
      map.addLayer({
        id: 'waypoint-layer',
        type: 'circle',
        source: 'waypoints-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            3,
            18.5,
            5,
            20.5,
            6.4,
          ],
          'circle-color': '#f4f0da',
          'circle-stroke-color': '#071018',
          'circle-stroke-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0.8,
            20.5,
            1.25,
          ],
          'circle-pitch-alignment': 'map',
          'circle-pitch-scale': 'map',
        },
      });
      map.addLayer({
        id: 'waypoint-label-layer',
        type: 'symbol',
        source: 'waypoints-source',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            7.8,
            18.5,
            9.1,
            20.5,
            10.2,
          ],
          'text-font': ['Open Sans Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#071018',
          'text-halo-color': 'rgba(255, 255, 255, 0.18)',
          'text-halo-width': 0.55,
        },
      });

      syncOverlayLayerVisibility(map, latestOverlayVisibilityRef.current);
      syncSceneObjectMarkers(map);
      map.on('mouseenter', 'waypoint-layer', setWaypointCursor);
      map.on('mouseleave', 'waypoint-layer', clearWaypointCursor);
      map.on('mouseenter', 'waypoint-label-layer', setWaypointCursor);
      map.on('mouseleave', 'waypoint-label-layer', clearWaypointCursor);
    });

    const setWaypointCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const clearWaypointCursor = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', (event) => {
      const clickedWaypointFeature = map.queryRenderedFeatures(event.point, {
        layers: ['waypoint-layer', 'waypoint-label-layer'],
      })[0];

      if (clickedWaypointFeature) {
        const waypointId =
          typeof clickedWaypointFeature.properties?.id === 'string'
            ? clickedWaypointFeature.properties.id
            : null;
        const waypoint = waypointId
          ? latestWaypointsRef.current.find((candidate) => candidate.id === waypointId)
          : undefined;

        if (waypoint) {
          if (
            latestInteractionModeRef.current === 'editor'
            && latestEditorToolRef.current === 'delete'
          ) {
            latestRemoveWaypointRef.current(waypoint.id);
            setMapStatusMessage(`${waypointLabel(waypoint)} removed from the map.`);
            return;
          }
          activateWaypointGoal(waypoint);
          return;
        }
      }

      if (latestInteractionModeRef.current === 'editor') {
        const activeEditorTool = latestEditorToolRef.current;

        if (activeEditorTool === 'delete') {
          setMapStatusMessage('Delete mode is armed. Click a waypoint or scene prop to remove it.');
          return;
        }

        if (activeEditorTool === 'waypoint') {
          latestAddWaypointRef.current(event.lngLat.lat, event.lngLat.lng);
          setMapStatusMessage('Waypoint added to the editor.');
          return;
        }

        latestAddSceneObjectRef.current(
          activeEditorTool,
          event.lngLat.lat,
          event.lngLat.lng,
          activeEditorTool === 'traffic_light'
            ? {
                facing_deg: stopSignFacingDeg,
                facing_fov_deg: TRAFFIC_LIGHT_DEFAULT_FACING_FOV_DEG,
                traffic_light_state: trafficLightState,
                trigger_radius_m: TRAFFIC_LIGHT_DEFAULT_TRIGGER_RADIUS_M,
                min_trigger_radius_m: TRAFFIC_LIGHT_DEFAULT_MIN_TRIGGER_RADIUS_M,
                detection_width_m: TRAFFIC_LIGHT_DEFAULT_DETECTION_WIDTH_M,
              }
            : activeEditorTool === 'stop_sign'
            ? {
                facing_deg: stopSignFacingDeg,
                stopbar_offset_m: STOP_SIGN_DEFAULT_STOPBAR_OFFSET_M,
              }
            : undefined,
        );
        setSelectedSceneObjectId(null);
        setMapStatusMessage(
          activeEditorTool === 'stop_sign'
            ? `Stop Sign added facing ${stopSignFacingDeg.toFixed(0)} degrees.`
            : activeEditorTool === 'traffic_light'
              ? `Traffic Light added as ${trafficLightState}.`
            : `${EDITOR_TOOL_META[activeEditorTool].label} added to the editor.`,
        );
        return;
      }

      const goal: BridgeGoal = {
        goal_lat: event.lngLat.lat,
        goal_lon: event.lngLat.lng,
        goal_heading: latestBridgeStateRef.current?.ego.heading_deg ?? 0,
      };

      setPreviewGoal(goal);

      if (!latestBridgeReadyRef.current) {
        setMapStatusMessage('Bridge offline. Goal preview updated on the map.');
        return;
      }

      setMapStatusMessage('Sending goal request through the bridge...');
      void latestGoalHandlerRef.current(goal)
        .then(() => {
          setMapStatusMessage('Goal request sent to the bridge.');
        })
        .catch((error) => {
          setMapStatusMessage(
            error instanceof Error ? error.message : 'Goal request failed.',
          );
        });
    });

    mapRef.current = map;

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeMap);
      map.off('zoom', syncSceneMarkerScale);
      map.off('move', syncSceneMarkerScale);
      map.off('mouseenter', 'waypoint-layer', setWaypointCursor);
      map.off('mouseleave', 'waypoint-layer', clearWaypointCursor);
      map.off('mouseenter', 'waypoint-label-layer', setWaypointCursor);
      map.off('mouseleave', 'waypoint-label-layer', clearWaypointCursor);
      resumeMapDragPan(map, sceneObjectDragPanRestoreRef);
      removeRotationHandleMarker(map);
      for (const marker of sceneObjectMarkersRef.current.values()) {
        marker.remove();
      }
      sceneObjectMarkersRef.current.clear();
      egoMarkerRef.current?.remove();
      egoMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
      initialCameraSetRef.current = false;
      lastFollowCenterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const preset = MAP_PRESETS[mapPresetKey];
    setFollowEgo(false);
    setMapStatusMessage(`Viewing ${preset.label}.`);
    map.setMinZoom(preset.minZoom);
    map.setMaxZoom(preset.maxZoom);
    map.setMaxBounds(preset.bounds as LngLatBoundsLike);
    map.easeTo({
      center: [preset.center.lon, preset.center.lat],
      zoom: preset.zoom,
      pitch: preset.pitch,
      duration: 900,
    });
  }, [mapPresetKey]);

  useEffect(() => {
    if (bridgeState?.goal_status.goal) {
      setPreviewGoal(null);
    }
  }, [bridgeState?.goal_status.goal]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !bridgeState) {
      return;
    }

    const routeSource = map.getSource('route-source') as GeoJSONSource | undefined;
    const trajectorySource = map.getSource('trajectory-source') as GeoJSONSource | undefined;
    const predictedSource = map.getSource('predicted-source') as GeoJSONSource | undefined;
    const debugSource = map.getSource('debug-source') as GeoJSONSource | undefined;
    const goalSource = map.getSource('goal-source') as GeoJSONSource | undefined;
    const waypointSource = map.getSource('waypoints-source') as GeoJSONSource | undefined;
    const editorObjectSource = map.getSource('editor-objects-source') as GeoJSONSource | undefined;
    const trafficLightVisionSource = map.getSource('traffic-light-vision-source') as GeoJSONSource | undefined;

    routeSource?.setData(lineFeatureCollection(bridgeState.route.points));
    trajectorySource?.setData(lineFeatureCollection(bridgeState.reference_trajectory.points));
    predictedSource?.setData(lineFeatureCollection(bridgeState.predicted_path.points));
    debugSource?.setData(lineFeatureCollection(bridgeState.debug_reference_path.points));
    goalSource?.setData(pointFeatureCollection(bridgeState.goal_status.goal ?? previewGoal));
    waypointSource?.setData(waypointFeatureCollection(waypoints));
    editorObjectSource?.setData(editorObjectFeatureCollection(sceneObjects));
    trafficLightVisionSource?.setData(trafficLightVisionFeatureCollection(sceneObjects));
    syncSceneObjectMarkers(map);

    egoMarkerRef.current
      ?.setLngLat([bridgeState.ego.longitude_deg, bridgeState.ego.latitude_deg])
      .setRotation(bridgeState.ego.heading_deg);

    if (!initialCameraSetRef.current) {
      map.jumpTo({
        center: [bridgeState.ego.longitude_deg, bridgeState.ego.latitude_deg],
        zoom: 18,
        pitch: 52,
      });
      lastFollowCenterRef.current = {
        lat: bridgeState.ego.latitude_deg,
        lon: bridgeState.ego.longitude_deg,
      };
      initialCameraSetRef.current = true;
    } else if (followEgo) {
      const lastFollowCenter = lastFollowCenterRef.current;
      const latDelta = Math.abs((lastFollowCenter?.lat ?? 0) - bridgeState.ego.latitude_deg);
      const lonDelta = Math.abs((lastFollowCenter?.lon ?? 0) - bridgeState.ego.longitude_deg);

      if (latDelta > FOLLOW_EGO_MIN_DELTA_DEG || lonDelta > FOLLOW_EGO_MIN_DELTA_DEG) {
        map.easeTo({
          center: [bridgeState.ego.longitude_deg, bridgeState.ego.latitude_deg],
          duration: 250,
          essential: true,
        });
        lastFollowCenterRef.current = {
          lat: bridgeState.ego.latitude_deg,
          lon: bridgeState.ego.longitude_deg,
        };
      }
    }
  }, [bridgeState, followEgo, previewGoal, sceneObjects, waypoints]);

  useEffect(() => {
    const map = mapRef.current;
    const goalSource = map?.getSource('goal-source') as GeoJSONSource | undefined;
    const waypointSource = map?.getSource('waypoints-source') as GeoJSONSource | undefined;
    const editorObjectSource = map?.getSource('editor-objects-source') as GeoJSONSource | undefined;
    const trafficLightVisionSource = map?.getSource('traffic-light-vision-source') as GeoJSONSource | undefined;
    if (!goalSource) {
      return;
    }
    goalSource.setData(pointFeatureCollection(bridgeState?.goal_status.goal ?? previewGoal));
    waypointSource?.setData(waypointFeatureCollection(waypoints));
    editorObjectSource?.setData(editorObjectFeatureCollection(sceneObjects));
    trafficLightVisionSource?.setData(trafficLightVisionFeatureCollection(sceneObjects));
    if (map) {
      syncSceneObjectMarkers(map);
    }
  }, [bridgeState?.goal_status.goal, previewGoal, sceneObjects, waypoints]);

  useEffect(() => {
    const markerElement = egoMarkerRef.current?.getElement();
    if (!markerElement) {
      return;
    }
    markerElement.classList.toggle('ego-marker--inactive', !bridgeReady || !bridgeState);
  }, [bridgeReady, bridgeState]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) {
      return;
    }
    syncOverlayLayerVisibility(map, overlayVisibility);
  }, [overlayVisibility]);

  const centerOnEgo = () => {
    if (!mapRef.current) {
      return;
    }

    const targetCenter = hasLiveBridgeState && bridgeState
      ? [bridgeState.ego.longitude_deg, bridgeState.ego.latitude_deg] as [number, number]
      : [activePreset.center.lon, activePreset.center.lat] as [number, number];

    mapRef.current.easeTo({
      center: targetCenter,
      zoom: Math.max(mapRef.current.getZoom(), hasLiveBridgeState ? 18 : activePreset.zoom),
      pitch: activePreset.pitch,
      duration: 700,
    });
    if (hasLiveBridgeState && bridgeState) {
      lastFollowCenterRef.current = {
        lat: bridgeState.ego.latitude_deg,
        lon: bridgeState.ego.longitude_deg,
      };
    }
  };

  const resetVehicleToMapCenter = () => {
    if (!mapRef.current || !bridgeReady) {
      return;
    }
    const center = mapRef.current.getCenter();
    void onResetVehicle({
      latitude_deg: center.lat,
      longitude_deg: center.lng,
      speed_mps: 0,
      heading_deg: bridgeState?.ego.heading_deg ?? 90,
    })
      .then(() => {
        setMapStatusMessage('Vehicle reset to the current map center.');
      })
      .catch((error) => {
        setMapStatusMessage(
          error instanceof Error ? error.message : 'Vehicle reset failed.',
        );
      });
  };

  const setActiveTrafficLightState = (nextState: TrafficLightState) => {
    setTrafficLightState(nextState);
    if (selectedTrafficLight) {
      onUpdateSceneObject(selectedTrafficLight.id, {
        traffic_light_state: nextState,
      });
      setMapStatusMessage(`${selectedTrafficLight.label} set to ${nextState}.`);
      return;
    }
    setMapStatusMessage(`Next traffic light will be ${nextState}.`);
  };

  const mapHint = bridgeReady
    ? `Bridge connected on ${activePreset.label}. ${
        createModeEnabled
          ? editorTool === 'delete'
            ? 'Create Mode is active. Delete mode is armed for placed props and saved waypoints.'
            : editorTool === 'stop_sign'
              ? 'Create Mode is active. Use the hotbar to place and rotate stop signs.'
              : editorTool === 'traffic_light'
                ? 'Create Mode is active. Place traffic lights, rotate them, and set red/yellow/green state.'
              : `Create Mode is active. Use the hotbar to place ${EDITOR_TOOL_META[editorTool].label.toLowerCase()} objects.`
          : 'Click anywhere to send a goal through the bridge.'
      }`
    : bridgeState
      ? createModeEnabled
        ? 'Bridge disconnected. Existing telemetry stays visible, and Create Mode only updates local editor objects.'
        : 'Bridge disconnected. Last known telemetry is still on screen, and map clicks only preview a goal locally.'
    : createModeEnabled
      ? 'Bridge offline. Create Mode still places local editor objects on the map.'
      : 'Bridge offline. Click anywhere to preview a goal while the rest of the UI stays browseable.';

  const mapCommandNote = mapStatusMessage ?? (
    createModeEnabled
      ? editorTool === 'delete'
        ? 'Delete mode is armed. Click any saved waypoint or scene prop on the map to remove it.'
        : editorTool === 'stop_sign'
          ? selectedStopSign
            ? `${selectedStopSign.label} is selected. Drag it to move, and drag the rotate handle to aim it.`
            : 'Stop Sign placement is active. Click to place one, then select it to move or rotate it on the map.'
          : editorTool === 'traffic_light'
            ? selectedTrafficLight
              ? `${selectedTrafficLight.label} is selected. Drag it, rotate it, or change the light state.`
              : 'Traffic Light placement is active. The colored box shows its trigger range.'
          : `${EDITOR_TOOL_META[editorTool].label} placement is active. Existing waypoint pins still route there unless Delete is armed.`
      : bridgeReady
      ? 'Live controls are enabled. Use Recenter to jump back to ego and Reset To Map Center to teleport the fake vehicle.'
      : 'Recenter still works in offline mode. Follow Ego and vehicle reset will enable once live ego state is available.'
  );
  const showMapCommandNote = Boolean(mapStatusMessage) || !createModeEnabled;

  return (
    <section className="map-shell">
      <div ref={mapContainerRef} className="map-canvas" />
      <div className="map-overlay map-overlay--top-left">
        <div className={`map-control-tray${trayOpen ? '' : ' map-control-tray--collapsed'}`}>
          <div className="map-control-tray__header">
            <div className="map-brand">
              <strong className="map-brand__title">EdiGlove</strong>
              <span className={`status-pill status-pill--${connectionStatus}`}>
                {connectionStatus}
              </span>
            </div>
            <button
              className="map-tray-toggle"
              type="button"
              aria-label={trayOpen ? 'Hide map controls' : 'Show map controls'}
              onClick={() => {
                setTrayOpen((current) => !current);
              }}
            >
              {trayOpen ? '<' : '>'}
            </button>
          </div>
          {trayOpen ? (
            <>
              <div className="map-switcher">
                {(['mcity', 'columbus'] as const).map((presetKey) => {
                  const preset = MAP_PRESETS[presetKey];
                  const active = presetKey === mapPresetKey;
                  return (
                    <button
                      key={preset.key}
                      className={`map-switcher__button${active ? ' map-switcher__button--active' : ''}`}
                      type="button"
                      disabled={bridgeReady}
                      onClick={() => {
                        onMapPresetChange(preset.key);
                      }}
                    >
                      <span>{preset.label}</span>
                      <small>{preset.description}</small>
                    </button>
                  );
                })}
              </div>
              <div className="map-mode-switcher">
                <button
                  className={`map-mode-switcher__button${interactionMode === 'goal' ? ' map-mode-switcher__button--active' : ''}`}
                  type="button"
                  onClick={() => {
                    onInteractionModeChange('goal');
                    setMapStatusMessage('Goal Mode is active.');
                  }}
                >
                  Goal Mode
                </button>
                <button
                  className={`map-mode-switcher__button${createModeEnabled ? ' map-mode-switcher__button--active' : ''}`}
                  type="button"
                  onClick={() => {
                    onInteractionModeChange('editor');
                    setMapStatusMessage('Create Mode is active. Use the bottom hotbar to place or delete objects.');
                  }}
                >
                  Create Mode
                </button>
              </div>
              <p className="map-hint">
                {mapHint}
              </p>
            </>
          ) : null}
        </div>
      </div>
      <div className="map-overlay map-overlay--top-right">
        <div className="button-stack">
          <BridgeStatusPanel
            bridgeState={bridgeState}
            connectionStatus={connectionStatus}
            errorMessage={errorMessage}
            lastCommandMessage={lastCommandMessage}
          />
          <button
            className={`action-button${followButtonActive ? ' action-button--active' : ''}`}
            type="button"
            disabled={!hasLiveBridgeState}
            onClick={() => {
              setFollowEgo((current) => {
                const next = !current;
                if (next) {
                  centerOnEgo();
                }
                return next;
              });
            }}
          >
            {followButtonActive ? 'Pause Follow' : 'Follow Ego'}
          </button>
          <button className="action-button" type="button" onClick={centerOnEgo}>
            Recenter
          </button>
          <button
            className="action-button action-button--ghost"
            type="button"
            onClick={resetVehicleToMapCenter}
            disabled={!bridgeReady}
          >
            Reset To Map Center
          </button>
        </div>
      </div>
      {createModeEnabled ? (
        <div className="map-overlay map-overlay--bottom-center">
          <div className="map-hotbar">
            <div className="map-hotbar__tools">
              {CREATE_HOTBAR_TOOLS.map((tool) => (
                <button
                  key={tool}
                  className={`map-hotbar__button${editorTool === tool ? ' map-hotbar__button--active' : ''}${tool === 'delete' ? ' map-hotbar__button--danger' : ''}`}
                  type="button"
                  onClick={() => {
                    onEditorToolChange(tool);
                    onInteractionModeChange('editor');
                    setMapStatusMessage(
                      tool === 'delete'
                        ? 'Delete mode armed. Click any saved waypoint or scene prop to remove it.'
                        : `${EDITOR_TOOL_META[tool].label} placement armed.`,
                    );
                  }}
                >
                  <strong>{EDITOR_TOOL_META[tool].shortLabel}</strong>
                  <span>{EDITOR_TOOL_META[tool].label}</span>
                </button>
              ))}
            </div>
            {editorTool === 'traffic_light' || selectedTrafficLight ? (
              <div className="map-hotbar__signal">
                <div className="map-hotbar__signal-copy">
                  <strong>
                    {selectedTrafficLight
                      ? `${selectedTrafficLight.label} Signal`
                      : 'Next Signal'}
                  </strong>
                  <span>
                    The translucent box is the traffic light trigger / vision range.
                  </span>
                </div>
                <div className="map-hotbar__signal-controls">
                  {TRAFFIC_LIGHT_STATES.map((state) => (
                    <button
                      key={state}
                      className={`signal-button signal-button--${state}${
                        trafficLightState === state ? ' signal-button--active' : ''
                      }`}
                      type="button"
                      onClick={() => {
                        setActiveTrafficLightState(state);
                      }}
                    >
                      {state}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="map-hotbar__meta">
              {editorTool === 'delete'
                ? 'Delete mode: click an existing waypoint or prop to remove it.'
                : editorTool === 'stop_sign'
                  ? 'Placement mode: click to place a stop sign. Select any placed prop to move it, and use the rotate handle on selected stop signs.'
                  : editorTool === 'traffic_light'
                    ? 'Placement mode: click to place a traffic light. Select one to move, rotate, or change red/yellow/green state.'
                  : `Placement mode: click on the map to drop a ${EDITOR_TOOL_META[editorTool].label.toLowerCase()}.`}
              {selectedDirectionalObject ? ` Selected: ${selectedDirectionalObject.label}.` : ''}
            </p>
          </div>
        </div>
      ) : null}
      {showMapCommandNote ? (
        <div className="map-overlay map-overlay--bottom-left">
          <p className={`map-status-note${bridgeReady ? '' : ' map-status-note--warning'}`}>
            {mapCommandNote}
          </p>
        </div>
      ) : null}
    </section>
  );
}
