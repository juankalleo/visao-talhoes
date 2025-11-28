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

  // Refs to avoid stale closures in map event handlers
  const isDrawingRef = useRef(isDrawingPlot);
  const plotPointsRef = useRef(plotPoints);
  const onPlotPointsChangeRef = useRef(onPlotPointsChange);
  const onLocationChangeRef = useRef(onLocationChange);
  const plotMarkersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => { isDrawingRef.current = isDrawingPlot; }, [isDrawingPlot]);
  useEffect(() => { plotPointsRef.current = plotPoints; }, [plotPoints]);
  useEffect(() => { onPlotPointsChangeRef.current = onPlotPointsChange; }, [onPlotPointsChange]);
  useEffect(() => { onLocationChangeRef.current = onLocationChange; }, [onLocationChange]);

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
      if (onLocationChangeRef.current) {
        onLocationChangeRef.current(initialLat, initialLon);
      }
    });

    // Click to set location or add plot point (reads current refs to avoid stale values)
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      if (isDrawingRef.current && onPlotPointsChangeRef.current) {
        const current = plotPointsRef.current ?? [];
        const newPoints = [...current, [lng, lat] as [number, number]];
        onPlotPointsChangeRef.current(newPoints);
      } else if (onLocationChangeRef.current) {
        onLocationChangeRef.current(lat, lng);
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
  }, []); // run once

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

    // Remove previous markers created by us
    plotMarkersRef.current.forEach(m => m.remove());
    plotMarkersRef.current = [];

    // Add markers for each point
    plotPoints.forEach((point) => {
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
      
      const m = new maplibregl.Marker({ element: el })
        .setLngLat(point)
        .addTo(map.current!);
      plotMarkersRef.current.push(m);
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

  // Image overlay (raster) generated from polygon (optional)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const imageSourceId = 'plot-image-source';
    const imageLayerId = 'plot-image-layer';

    // remove existing
    if (map.current.getLayer(imageLayerId)) map.current.removeLayer(imageLayerId);
    if (map.current.getSource(imageSourceId)) map.current.removeSource(imageSourceId);

    const pointsToUse = savedPlot && savedPlot.length >= 3
      ? savedPlot
      : (plotPoints.length >= 3 ? plotPoints : null);

    if (!pointsToUse) return;

    // bbox with small padding
    const lons = pointsToUse.map(p => p[0]);
    const lats = pointsToUse.map(p => p[1]);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const lonPad = (maxLon - minLon) * 0.12 || 0.0005;
    const latPad = (maxLat - minLat) * 0.12 || 0.0005;
    const bbox = [minLon - lonPad, minLat - latPad, maxLon + lonPad, maxLat + latPad]; // [minLon,minLat,maxLon,maxLat]

    // canvas size (keep reasonable)
    const canvasWidth = 512;
    const bboxLonSpan = bbox[2] - bbox[0];
    const bboxLatSpan = bbox[3] - bbox[1];
    const aspect = bboxLatSpan > 0 ? (bboxLatSpan / bboxLonSpan) : 1;
    const canvasHeight = Math.max(128, Math.round(canvasWidth * aspect));

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // clear and draw transparent background
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // helper: lon/lat -> canvas coords
    const lonToX = (lon: number) => ((lon - bbox[0]) / (bbox[2] - bbox[0])) * canvasWidth;
    const latToY = (lat: number) => canvasHeight - ((lat - bbox[1]) / (bbox[3] - bbox[1])) * canvasHeight;

    // draw filled polygon (translucent)
    ctx.beginPath();
    pointsToUse.forEach((pt, i) => {
      const x = lonToX(pt[0]);
      const y = latToY(pt[1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    // choose fill color (can reuse temperature logic if desired)
    const temp = weather?.temperature ?? 25;
    let fill = 'rgba(34,197,94,0.45)'; // default green
    if (temp >= 35) fill = 'rgba(220,38,38,0.45)';
    else if (temp >= 30) fill = 'rgba(249,115,22,0.45)';
    else if (temp >= 25) fill = 'rgba(234,179,8,0.45)';
    else if (temp >= 20) fill = 'rgba(132,204,22,0.45)';

    ctx.fillStyle = fill;
    ctx.fill();

    // optional outline
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();

    // convert to data URL
    const dataUrl = canvas.toDataURL('image/png');

    // maplibre image source needs 4 corner coordinates [tl,tr,br,bl]
    const coords = [
      [bbox[0], bbox[3]], // top-left (minLon, maxLat)
      [bbox[2], bbox[3]], // top-right (maxLon, maxLat)
      [bbox[2], bbox[1]], // bottom-right (maxLon, minLat)
      [bbox[0], bbox[1]]  // bottom-left (minLon, minLat)
    ] as [[number, number], [number, number], [number, number], [number, number]];

    try {
      map.current.addSource(imageSourceId, {
        type: 'image',
        url: dataUrl,
        coordinates: coords
      });

      map.current.addLayer({
        id: imageLayerId,
        type: 'raster',
        source: imageSourceId,
        paint: {
          'raster-opacity': 0.75
        }
      }, undefined);
    } catch (err) {
      // fail silently if source exists or other issue
      // console.warn(err);
    }

    return () => {
      if (!map.current) return;
      if (map.current.getLayer(imageLayerId)) map.current.removeLayer(imageLayerId);
      if (map.current.getSource(imageSourceId)) map.current.removeSource(imageSourceId);
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
