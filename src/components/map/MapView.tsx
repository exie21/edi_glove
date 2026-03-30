import { useEffect, useRef, useState } from 'react';
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type Marker,
  type StyleSpecification,
} from 'maplibre-gl';

import { lineFeatureCollection, pointFeatureCollection } from '../../lib/geojson';
import {
  MAP_PRESETS,
  type MapPresetKey,
} from '../../lib/mapPresets';
import type {
  BridgeGoal,
  BridgeState,
  GoalPayload,
  ResetVehiclePayload,
} from '../../types/bridge';
import type { OverlayVisibility } from '../../types/ui';

const FOLLOW_EGO_MIN_DELTA_DEG = 1e-6;
const MIN_MAP_ZOOM = 12;
const MAX_MAP_ZOOM = 20;

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
        minzoom: MIN_MAP_ZOOM,
        maxzoom: MAX_MAP_ZOOM,
        attribution: 'Esri',
      },
    },
    layers: [
      {
        id: 'esri_satellite',
        type: 'raster',
        source: 'esri_satellite',
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

interface MapViewProps {
  bridgeState: BridgeState | null;
  connectionStatus: 'loading' | 'connected' | 'error';
  bridgeReady: boolean;
  mapPresetKey: MapPresetKey;
  onMapPresetChange: (preset: MapPresetKey) => void;
  overlayVisibility: OverlayVisibility;
  onGoalPick: (goal: GoalPayload) => Promise<void>;
  onResetVehicle: (payload: ResetVehiclePayload) => Promise<void>;
}

export function MapView({
  bridgeState,
  connectionStatus,
  bridgeReady,
  mapPresetKey,
  onMapPresetChange,
  overlayVisibility,
  onGoalPick,
  onResetVehicle,
}: MapViewProps) {
  const [followEgo, setFollowEgo] = useState(true);
  const [previewGoal, setPreviewGoal] = useState<BridgeGoal | null>(null);
  const [mapStatusMessage, setMapStatusMessage] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapReadyRef = useRef(false);
  const egoMarkerRef = useRef<Marker | null>(null);
  const initialCameraSetRef = useRef(false);
  const lastFollowCenterRef = useRef<{ lat: number; lon: number } | null>(null);
  const latestBridgeStateRef = useRef<BridgeState | null>(bridgeState);
  const latestBridgeReadyRef = useRef(bridgeReady);
  const latestGoalHandlerRef = useRef(onGoalPick);
  const latestOverlayVisibilityRef = useRef(overlayVisibility);
  const activePreset = MAP_PRESETS[mapPresetKey];

  latestBridgeStateRef.current = bridgeState;
  latestBridgeReadyRef.current = bridgeReady;
  latestGoalHandlerRef.current = onGoalPick;
  latestOverlayVisibilityRef.current = overlayVisibility;

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
      minZoom: MIN_MAP_ZOOM,
      maxZoom: MAX_MAP_ZOOM,
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

      map.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route-source',
        paint: {
          'line-color': '#ffb24d',
          'line-width': 5,
          'line-opacity': 0.9,
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
        id: 'goal-layer',
        type: 'circle',
        source: 'goal-source',
        paint: {
          'circle-radius': 8,
          'circle-color': '#ffe28a',
          'circle-stroke-color': '#201304',
          'circle-stroke-width': 2,
        },
      });

      syncOverlayLayerVisibility(map, latestOverlayVisibilityRef.current);
    });

    map.on('click', (event) => {
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

    routeSource?.setData(lineFeatureCollection(bridgeState.route.points));
    trajectorySource?.setData(lineFeatureCollection(bridgeState.reference_trajectory.points));
    predictedSource?.setData(lineFeatureCollection(bridgeState.predicted_path.points));
    debugSource?.setData(lineFeatureCollection(bridgeState.debug_reference_path.points));
    goalSource?.setData(pointFeatureCollection(bridgeState.goal_status.goal ?? previewGoal));

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
  }, [bridgeState, followEgo, previewGoal]);

  useEffect(() => {
    const map = mapRef.current;
    const goalSource = map?.getSource('goal-source') as GeoJSONSource | undefined;
    if (!goalSource) {
      return;
    }
    goalSource.setData(pointFeatureCollection(bridgeState?.goal_status.goal ?? previewGoal));
  }, [bridgeState?.goal_status.goal, previewGoal]);

  useEffect(() => {
    const markerElement = egoMarkerRef.current?.getElement();
    if (!markerElement) {
      return;
    }
    markerElement.classList.toggle('ego-marker--inactive', !bridgeState);
  }, [bridgeState]);

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

    const targetCenter = bridgeState
      ? [bridgeState.ego.longitude_deg, bridgeState.ego.latitude_deg] as [number, number]
      : [activePreset.center.lon, activePreset.center.lat] as [number, number];

    mapRef.current.easeTo({
      center: targetCenter,
      zoom: Math.max(mapRef.current.getZoom(), bridgeState ? 18 : activePreset.zoom),
      pitch: activePreset.pitch,
      duration: 700,
    });
    if (bridgeState) {
      lastFollowCenterRef.current = {
        lat: bridgeState.ego.latitude_deg,
        lon: bridgeState.ego.longitude_deg,
      };
    }
  };

  const resetVehicleToMapCenter = () => {
    if (!mapRef.current) {
      return;
    }
    const center = mapRef.current.getCenter();
    void onResetVehicle({
      latitude_deg: center.lat,
      longitude_deg: center.lng,
      speed_mps: 0,
      heading_deg: bridgeState?.ego.heading_deg ?? 90,
    });
  };

  const mapHint = bridgeReady
    ? 'Click anywhere on the map to send a goal through the bridge.'
    : 'Bridge offline. Click anywhere to preview a goal while the rest of the UI stays browseable.';

  const mapCommandNote = mapStatusMessage ?? (
    bridgeReady
      ? 'Live controls are enabled. Use Recenter to jump back to ego and Reset To Map Center to teleport the fake vehicle.'
      : 'Recenter still works in offline mode. Follow Ego and vehicle reset will enable once live ego state is available.'
  );
  const followButtonActive = followEgo && Boolean(bridgeState);

  return (
    <section className="map-shell">
      <div ref={mapContainerRef} className="map-canvas" />
      <div className="map-overlay map-overlay--top-left">
        <div className="map-brand">
          <span className="map-brand__kicker">Standalone Sandbox</span>
          <strong className="map-brand__title">Ediglove</strong>
          <span className={`status-pill status-pill--${connectionStatus}`}>
            {connectionStatus}
          </span>
        </div>
        <div className="map-switcher">
          {(['mcity', 'columbus'] as const).map((presetKey) => {
            const preset = MAP_PRESETS[presetKey];
            const active = presetKey === mapPresetKey;
            return (
              <button
                key={preset.key}
                className={`map-switcher__button${active ? ' map-switcher__button--active' : ''}`}
                type="button"
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
        <p className="map-hint">
          {mapHint}
        </p>
      </div>
      <div className="map-overlay map-overlay--top-right">
        <div className="button-stack">
          <button
            className={`action-button${followButtonActive ? ' action-button--active' : ''}`}
            type="button"
            disabled={!bridgeState}
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
      <div className="map-overlay map-overlay--bottom-left">
        <p className={`map-status-note${bridgeReady ? '' : ' map-status-note--warning'}`}>
          {mapCommandNote}
        </p>
      </div>
    </section>
  );
}
