import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

import { lineFeatureCollection, pointFeatureCollection } from '../../lib/geojson';
import type { BridgeState, GoalPayload, ResetVehiclePayload } from '../../types/bridge';

const DEFAULT_CENTER = {
  lat: Number(import.meta.env.VITE_DEFAULT_CENTER_LAT ?? 42.3008428),
  lon: Number(import.meta.env.VITE_DEFAULT_CENTER_LON ?? -83.6982926),
};

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

interface MapViewProps {
  bridgeState: BridgeState | null;
  connectionStatus: 'loading' | 'connected' | 'error';
  onGoalPick: (goal: GoalPayload) => Promise<void>;
  onResetVehicle: (payload: ResetVehiclePayload) => Promise<void>;
}

export function MapView({
  bridgeState,
  connectionStatus,
  onGoalPick,
  onResetVehicle,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapReadyRef = useRef(false);
  const egoMarkerRef = useRef<maplibregl.Marker | null>(null);
  const initialCameraSetRef = useRef(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: buildSatelliteStyle() as maplibregl.StyleSpecification,
      center: [DEFAULT_CENTER.lon, DEFAULT_CENTER.lat],
      zoom: 17.4,
      pitch: 48,
      bearing: 0,
      antialias: true,
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
      .setLngLat([DEFAULT_CENTER.lon, DEFAULT_CENTER.lat])
      .addTo(map);

    map.on('load', () => {
      mapReadyRef.current = true;

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
    });

    map.on('click', (event) => {
      const heading = bridgeState?.ego.heading_deg ?? 0;
      void onGoalPick({
        goal_lat: event.lngLat.lat,
        goal_lon: event.lngLat.lng,
        goal_heading: heading,
      });
    });

    mapRef.current = map;

    return () => {
      egoMarkerRef.current?.remove();
      egoMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
      initialCameraSetRef.current = false;
    };
  }, [bridgeState?.ego.heading_deg, onGoalPick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !bridgeState) {
      return;
    }

    const routeSource = map.getSource('route-source') as maplibregl.GeoJSONSource | undefined;
    const trajectorySource = map.getSource('trajectory-source') as maplibregl.GeoJSONSource | undefined;
    const predictedSource = map.getSource('predicted-source') as maplibregl.GeoJSONSource | undefined;
    const debugSource = map.getSource('debug-source') as maplibregl.GeoJSONSource | undefined;
    const goalSource = map.getSource('goal-source') as maplibregl.GeoJSONSource | undefined;

    routeSource?.setData(lineFeatureCollection(bridgeState.route.points));
    trajectorySource?.setData(lineFeatureCollection(bridgeState.reference_trajectory.points));
    predictedSource?.setData(lineFeatureCollection(bridgeState.predicted_path.points));
    debugSource?.setData(lineFeatureCollection(bridgeState.debug_reference_path.points));
    goalSource?.setData(pointFeatureCollection(bridgeState.goal_status.goal));

    egoMarkerRef.current
      ?.setLngLat([bridgeState.ego.longitude_deg, bridgeState.ego.latitude_deg])
      .setRotation(bridgeState.ego.heading_deg);

    if (!initialCameraSetRef.current) {
      map.jumpTo({
        center: [bridgeState.ego.longitude_deg, bridgeState.ego.latitude_deg],
        zoom: 18,
        pitch: 52,
      });
      initialCameraSetRef.current = true;
    }
  }, [bridgeState]);

  const centerOnEgo = () => {
    if (!mapRef.current || !bridgeState) {
      return;
    }
    mapRef.current.easeTo({
      center: [bridgeState.ego.longitude_deg, bridgeState.ego.latitude_deg],
      zoom: Math.max(mapRef.current.getZoom(), 18),
      duration: 700,
    });
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
        <p className="map-hint">
          Click anywhere on the map to send a goal through the bridge.
        </p>
      </div>
      <div className="map-overlay map-overlay--top-right">
        <div className="button-stack">
          <button className="action-button" type="button" onClick={centerOnEgo}>
            Center Ego
          </button>
          <button
            className="action-button action-button--ghost"
            type="button"
            onClick={resetVehicleToMapCenter}
          >
            Reset To Map Center
          </button>
        </div>
      </div>
    </section>
  );
}

