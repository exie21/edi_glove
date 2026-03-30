import { useEffect, useRef, useState } from 'react';
import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Map as MapLibreMap,
  type Marker,
  type StyleSpecification,
} from 'maplibre-gl';

import { lineFeatureCollection, pointFeatureCollection } from '../../lib/geojson';
import {
  MAP_PRESETS,
  type MapPresetKey,
} from '../../lib/mapPresets';
import { waypointFeatureCollection } from '../../lib/waypoints';
import type {
  BridgeGoal,
  BridgeState,
  GoalPayload,
  ResetVehiclePayload,
} from '../../types/bridge';
import type {
  MapClickMode,
  OverlayVisibility,
  Waypoint,
} from '../../types/ui';

const FOLLOW_EGO_MIN_DELTA_DEG = 1e-6;
const MAX_SOURCE_ZOOM = 19;

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

interface MapViewProps {
  bridgeState: BridgeState | null;
  connectionStatus: 'loading' | 'connected' | 'error';
  bridgeReady: boolean;
  mapPresetKey: MapPresetKey;
  onMapPresetChange: (preset: MapPresetKey) => void;
  clickMode: MapClickMode;
  onClickModeChange: (mode: MapClickMode) => void;
  waypoints: Waypoint[];
  onAddWaypoint: (latitude_deg: number, longitude_deg: number) => void;
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
  clickMode,
  onClickModeChange,
  waypoints,
  onAddWaypoint,
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
  const latestClickModeRef = useRef<MapClickMode>(clickMode);
  const latestGoalHandlerRef = useRef(onGoalPick);
  const latestAddWaypointRef = useRef(onAddWaypoint);
  const latestOverlayVisibilityRef = useRef(overlayVisibility);
  const latestWaypointsRef = useRef(waypoints);
  const activePreset = MAP_PRESETS[mapPresetKey];
  const hasLiveBridgeState = bridgeReady && Boolean(bridgeState);
  const followButtonActive = followEgo && hasLiveBridgeState;

  const activateWaypointGoal = (waypoint: Waypoint) => {
    const waypointLabel = waypoint.label ?? 'Waypoint';
    const goal: BridgeGoal = {
      goal_lat: waypoint.latitude_deg,
      goal_lon: waypoint.longitude_deg,
      goal_heading: latestBridgeStateRef.current?.ego.heading_deg ?? 0,
    };

    setPreviewGoal(goal);

    if (!latestBridgeReadyRef.current) {
      setMapStatusMessage(`${waypointLabel} selected as a local goal preview.`);
      return;
    }

    setMapStatusMessage(`Routing to ${waypointLabel}...`);
    void latestGoalHandlerRef.current(goal)
      .then(() => {
        setMapStatusMessage(`${waypointLabel} sent as the active goal.`);
      })
      .catch((error) => {
        setMapStatusMessage(
          error instanceof Error ? error.message : `Routing to ${waypointLabel} failed.`,
        );
      });
  };

  latestBridgeStateRef.current = bridgeState;
  latestBridgeReadyRef.current = bridgeReady;
  latestClickModeRef.current = clickMode;
  latestGoalHandlerRef.current = onGoalPick;
  latestAddWaypointRef.current = onAddWaypoint;
  latestOverlayVisibilityRef.current = overlayVisibility;
  latestWaypointsRef.current = waypoints;

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
          activateWaypointGoal(waypoint);
          return;
        }
      }

      if (latestClickModeRef.current === 'waypoint') {
        latestAddWaypointRef.current(event.lngLat.lat, event.lngLat.lng);
        setMapStatusMessage('Waypoint added to the map.');
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
      map.off('mouseenter', 'waypoint-layer', setWaypointCursor);
      map.off('mouseleave', 'waypoint-layer', clearWaypointCursor);
      map.off('mouseenter', 'waypoint-label-layer', setWaypointCursor);
      map.off('mouseleave', 'waypoint-label-layer', clearWaypointCursor);
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

    routeSource?.setData(lineFeatureCollection(bridgeState.route.points));
    trajectorySource?.setData(lineFeatureCollection(bridgeState.reference_trajectory.points));
    predictedSource?.setData(lineFeatureCollection(bridgeState.predicted_path.points));
    debugSource?.setData(lineFeatureCollection(bridgeState.debug_reference_path.points));
    goalSource?.setData(pointFeatureCollection(bridgeState.goal_status.goal ?? previewGoal));
    waypointSource?.setData(waypointFeatureCollection(waypoints));

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
  }, [bridgeState, followEgo, previewGoal, waypoints]);

  useEffect(() => {
    const map = mapRef.current;
    const goalSource = map?.getSource('goal-source') as GeoJSONSource | undefined;
    const waypointSource = map?.getSource('waypoints-source') as GeoJSONSource | undefined;
    if (!goalSource) {
      return;
    }
    goalSource.setData(pointFeatureCollection(bridgeState?.goal_status.goal ?? previewGoal));
    waypointSource?.setData(waypointFeatureCollection(waypoints));
  }, [bridgeState?.goal_status.goal, previewGoal, waypoints]);

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

  const mapHint = bridgeReady
    ? `Bridge connected on ${activePreset.label}. ${
        clickMode === 'waypoint'
          ? 'Click blank map space to save a labeled waypoint. Click any saved waypoint later to route there from the current ego pose.'
          : 'Click anywhere to send a goal through the bridge.'
      }`
    : bridgeState
      ? clickMode === 'waypoint'
        ? 'Bridge disconnected. Last known ego telemetry is still on screen, and waypoint clicks only update the local draft or preview.'
        : 'Bridge disconnected. Last known telemetry is still on screen, and map clicks only preview a goal locally.'
    : clickMode === 'waypoint'
      ? 'Bridge offline. Click anywhere to drop labeled waypoints on the map.'
      : 'Bridge offline. Click anywhere to preview a goal while the rest of the UI stays browseable.';

  const mapCommandNote = mapStatusMessage ?? (
    clickMode === 'waypoint'
      ? 'Waypoint mode is active. Blank-map clicks save reusable labels like A, B, and C. Clicking an existing waypoint pin sends that saved point as the next goal.'
      : bridgeReady
      ? 'Live controls are enabled. Use Recenter to jump back to ego and Reset To Map Center to teleport the fake vehicle.'
      : 'Recenter still works in offline mode. Follow Ego and vehicle reset will enable once live ego state is available.'
  );
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
            className={`map-mode-switcher__button${clickMode === 'goal' ? ' map-mode-switcher__button--active' : ''}`}
            type="button"
            onClick={() => {
              onClickModeChange('goal');
            }}
          >
            Goal Mode
          </button>
          <button
            className={`map-mode-switcher__button${clickMode === 'waypoint' ? ' map-mode-switcher__button--active' : ''}`}
            type="button"
            onClick={() => {
              onClickModeChange('waypoint');
            }}
          >
            Waypoint Mode
          </button>
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
      <div className="map-overlay map-overlay--bottom-left">
        <p className={`map-status-note${bridgeReady ? '' : ' map-status-note--warning'}`}>
          {mapCommandNote}
        </p>
      </div>
    </section>
  );
}
