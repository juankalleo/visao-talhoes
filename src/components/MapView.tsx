import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { WeatherData } from '@/lib/weather-api';

interface MapViewProps {
  weather: WeatherData | null;
  onLocationChange?: (lat: number, lon: number) => void;
  showHeatmap?: boolean;
  layers?: {
    rain: boolean;
    wind: boolean;
    temperature: boolean;
    clouds: boolean;
  };
  isDrawingPlot?: boolean;
  onPlotPointsChange?: (points: [number, number][]) => void;
  plotPoints?: [number, number][];
  savedPlot?: [number, number][];
}

export default function MapView({ 
  weather, 
  onLocationChange,
  showHeatmap = false,
  layers = { rain: false, wind: false, temperature: false, clouds: false },
  isDrawingPlot = false,
  onPlotPointsChange,
  plotPoints = [],
  savedPlot
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Porto Velho - Estrada de Ferro Madeira-Mamoré
    const initialLat = -8.7619;
    const initialLon = -63.9039;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [initialLon, initialLat],
      zoom: 13,
      pitch: 45,
      bearing: 0
    });

    // Add navigation controls
    map.current.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true
      }),
      'top-right'
    );

    // Add scale control
    map.current.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: 'metric'
      }),
      'bottom-right'
    );

    map.current.on('load', () => {
      setMapLoaded(true);
      if (onLocationChange) {
        onLocationChange(initialLat, initialLon);
      }
    });

    // Click to set location or add plot point
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      
      if (isDrawingPlot && onPlotPointsChange) {
        // Add point to plot
        const newPoints = [...plotPoints, [lng, lat] as [number, number]];
        onPlotPointsChange(newPoints);
      } else if (onLocationChange) {
        onLocationChange(lat, lng);
      }
    });

    return () => {
      if (marker.current) {
        marker.current.remove();
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [onLocationChange]);

  // Update marker
  useEffect(() => {
    if (!map.current || !weather) return;

    if (marker.current) {
      marker.current.remove();
    }

    const el = document.createElement('div');
    el.className = 'weather-marker';
    el.style.cssText = `
      width: 40px;
      height: 40px;
      background: hsl(var(--primary));
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: transform 0.2s;
    `;
    el.textContent = `${Math.round(weather.temperature)}°`;
    el.onmouseenter = () => el.style.transform = 'scale(1.1)';
    el.onmouseleave = () => el.style.transform = 'scale(1)';

    marker.current = new maplibregl.Marker({ element: el })
      .setLngLat([weather.location.lon, weather.location.lat])
      .addTo(map.current);

    map.current.flyTo({
      center: [weather.location.lon, weather.location.lat],
      zoom: 13,
      duration: 1500,
      essential: true
    });
  }, [weather]);

  // Heatmap layer
  useEffect(() => {
    if (!map.current || !mapLoaded || !showHeatmap || !weather) return;

    const sourceId = 'heatmap-source';
    const layerId = 'heatmap-layer';

    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    // Generate heatmap points around current location
    const points: GeoJSON.Feature[] = [];
    const baseTemp = weather.temperature;
    
    for (let i = 0; i < 100; i++) {
      const offsetLat = (Math.random() - 0.5) * 0.1;
      const offsetLon = (Math.random() - 0.5) * 0.1;
      const tempVariation = (Math.random() - 0.5) * 10;
      
      points.push({
        type: 'Feature',
        properties: {
          temperature: baseTemp + tempVariation
        },
        geometry: {
          type: 'Point',
          coordinates: [
            weather.location.lon + offsetLon,
            weather.location.lat + offsetLat
          ]
        }
      });
    }

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: points
      }
    });

    map.current.addLayer({
      id: layerId,
      type: 'heatmap',
      source: sourceId,
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'temperature'],
          0, 0,
          40, 1
        ],
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 1,
          15, 3
        ],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(33,102,172,0)',
          0.2, 'rgb(103,169,207)',
          0.4, 'rgb(209,229,240)',
          0.6, 'rgb(253,219,199)',
          0.8, 'rgb(239,138,98)',
          1, 'rgb(178,24,43)'
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 2,
          15, 20
        ],
        'heatmap-opacity': 0.7
      }
    });

    return () => {
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    };
  }, [showHeatmap, weather, mapLoaded]);

  // Draw plot markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.plot-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add markers for each point
    plotPoints.forEach((point, index) => {
      const el = document.createElement('div');
      el.className = 'plot-marker';
      el.style.cssText = `
        width: 12px;
        height: 12px;
        background: hsl(var(--primary));
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        z-index: 1000;
      `;
      
      new maplibregl.Marker({ element: el })
        .setLngLat(point)
        .addTo(map.current!);
    });
  }, [plotPoints, mapLoaded]);

  // Draw plot polygon
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'plot-polygon-source';
    const layerId = 'plot-polygon-layer';
    const lineLayerId = 'plot-line-layer';

    // Remove existing layers
    if (map.current.getLayer(lineLayerId)) {
      map.current.removeLayer(lineLayerId);
    }
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    const pointsToUse = savedPlot || (plotPoints.length >= 3 ? plotPoints : null);

    if (!pointsToUse || pointsToUse.length < 3) return;

    // Calculate color based on temperature
    const getColorForTemperature = (temp: number) => {
      if (temp >= 35) return 'rgba(220, 38, 38, 0.4)'; // Red
      if (temp >= 30) return 'rgba(249, 115, 22, 0.4)'; // Orange
      if (temp >= 25) return 'rgba(234, 179, 8, 0.4)'; // Yellow
      if (temp >= 20) return 'rgba(132, 204, 22, 0.4)'; // Light green
      return 'rgba(34, 197, 94, 0.4)'; // Green
    };

    const temperature = weather?.temperature || 25;
    const fillColor = getColorForTemperature(temperature);

    // Close the polygon
    const coordinates = [...pointsToUse, pointsToUse[0]];

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        }
      }
    });

    // Add fill layer
    map.current.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': fillColor,
        'fill-opacity': 0.6
      }
    });

    // Add outline layer
    map.current.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#ffffff',
        'line-width': 2,
        'line-opacity': 0.8
      }
    });

    return () => {
      if (map.current?.getLayer(lineLayerId)) {
        map.current.removeLayer(lineLayerId);
      }
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    };
  }, [plotPoints, savedPlot, weather, mapLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Overlay gradient */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/5 via-transparent to-background/10" />
    </div>
  );
}
