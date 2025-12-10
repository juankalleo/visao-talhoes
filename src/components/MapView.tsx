import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl'; // se já importou, ignore
import 'maplibre-gl/dist/maplibre-gl.css';
import { WeatherData } from '@/lib/weather-api';
import { Sentinel2Data } from '@/lib/sentinel2-api';
import usePolygons, { SavedPlot } from '@/hooks/usePolygons'; // optional import for type only
import { transformMapLibreTiles } from '@/lib/tileInterceptor';
import { getApiUrl } from '@/lib/utils';

interface MapViewProps {
  weather: WeatherData | null;
  sentinel2Data?: Sentinel2Data | null;
  onLocationChange?: (lat: number, lon: number) => void;
  showHeatmap?: boolean;
  layers?: {
    rain: boolean;
    wind: boolean;
    temperature: boolean;
    clouds: boolean;
  };
  sentinelFilters?: {
    satellite: boolean;
    ndvi: boolean;
    ndmi: boolean;
    ndbi: boolean;
    heatmap: boolean;
  };
  sentinelOpacity?: {
    satellite: number;
    ndvi: number;
    ndmi: number;
    ndbi: number;
    heatmap: number;
  };
  isDrawingPlot?: boolean;
  onPlotPointsChange?: (points: [number, number][]) => void;
  plotPoints?: [number, number][];
  savedPlot?: [number, number][];
}

export default function MapView({ 
  weather,
  sentinel2Data,
  onLocationChange,
  showHeatmap = false,
  layers = { rain: false, wind: false, temperature: false, clouds: false },
  sentinelFilters = { satellite: false, ndvi: false, ndmi: false, ndbi: false, heatmap: false },
  sentinelOpacity = { satellite: 0.85, ndvi: 0.75, ndmi: 0.75, ndbi: 0.75, heatmap: 0.7 },
  isDrawingPlot = false,
  onPlotPointsChange,
  plotPoints = [],
  savedPlot
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [satVisible, setSatVisible] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now()); // Força tiles a recarregar a cada 5 min

  // Refs to avoid stale closures in map event handlers
  const isDrawingRef = useRef(isDrawingPlot);
  const plotPointsRef = useRef(plotPoints);
  const onPlotPointsChangeRef = useRef(onPlotPointsChange);
  const onLocationChangeRef = useRef(onLocationChange);
  const plotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const clickHandlerRef = useRef<((e: any) => void) | null>(null);

  // Atualiza cache buster a cada 5 minutos para forçar tiles atualizadas
  useEffect(() => {
    const interval = setInterval(() => {
      setCacheBuster(Date.now());
      // Também força refresh do mapa
      if (map.current) {
        map.current.triggerRepaint();
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, []);

  useEffect(() => { isDrawingRef.current = isDrawingPlot; }, [isDrawingPlot]);
  useEffect(() => { plotPointsRef.current = plotPoints; }, [plotPoints]);
  useEffect(() => { onPlotPointsChangeRef.current = onPlotPointsChange; }, [onPlotPointsChange]);
  useEffect(() => { onLocationChangeRef.current = onLocationChange; }, [onLocationChange]);

  // Atualiza tiles quando cacheBuster muda (a cada 5 minutos)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    try {
      const apiUrl = getApiUrl();
      
      const sourceIds = ['sentinel2-tiles', 'ndvi-tiles', 'ndmi-tiles', 'ndbi-tiles'];
      sourceIds.forEach(sourceId => {
        if (map.current?.getSource(sourceId)) {
          // Force reload by updating the source with new cache buster
          const source = map.current.getSource(sourceId) as maplibregl.RasterTileSource;
          if (source) {
            const tileUrl = 
              sourceId === 'sentinel2-tiles' ? `${apiUrl}/sentinel2/satellite-tiles/{z}/{x}/{y}.jpg?t=${cacheBuster}` :
              sourceId === 'ndvi-tiles' ? `${apiUrl}/sentinel2/ndvi-tiles/{z}/{x}/{y}.png?t=${cacheBuster}` :
              sourceId === 'ndmi-tiles' ? `${apiUrl}/sentinel2/ndmi-tiles/{z}/{x}/{y}.png?t=${cacheBuster}` :
              `${apiUrl}/sentinel2/ndbi-tiles/{z}/{x}/{y}.png?t=${cacheBuster}`;
            
            source.setTiles([tileUrl]);
          }
        }
      });
      map.current?.triggerRepaint();
      console.log('🔄 Cache buster updated - forcing tile refresh');
    } catch (err) {
      console.warn('Failed to update tiles with cache buster:', err);
    }
  }, [cacheBuster, mapLoaded]);

  // Initialize map
useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initialLat = -10.2926;
    const initialLon = -65.2979;
    const apiUrl = getApiUrl();

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
          },
          'sentinel2-tiles': {
            type: 'raster',
            tiles: [
              `${apiUrl}/sentinel2/satellite-tiles/{z}/{x}/{y}.jpg?t=${cacheBuster}`
            ],
            tileSize: 256,
            attribution: '© Copernicus Sentinel-2 (Imagem Atual)'
          },
          'ndvi-tiles': {
            type: 'raster',
            tiles: [
              `${apiUrl}/sentinel2/ndvi-tiles/{z}/{x}/{y}.png?t=${cacheBuster}`
            ],
            tileSize: 256,
            attribution: '© NDVI - Vegetação (Verde=Saudável, Vermelho=Sem Veg)'
          },
          'ndmi-tiles': {
            type: 'raster',
            tiles: [
              `${apiUrl}/sentinel2/ndmi-tiles/{z}/{x}/{y}.png?t=${cacheBuster}`
            ],
            tileSize: 256,
            attribution: '© NDMI - Umidade (Azul=Seco, Verde=Úmido)'
          },
          'ndbi-tiles': {
            type: 'raster',
            tiles: [
              `${apiUrl}/sentinel2/ndbi-tiles/{z}/{x}/{y}.png?t=${cacheBuster}`
            ],
            tileSize: 256,
            attribution: '© NDBI - Construção (Cinza=Urbano, Escuro=Construído)'
          },
          'heatmap-tiles': {
            type: 'raster',
            tiles: [
              'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© Stadia Maps'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          },
          {
            id: 'sentinel2-layer',
            type: 'raster',
            source: 'sentinel2-tiles',
            minzoom: 0,
            maxzoom: 19,
            paint: {
              'raster-opacity': 0
            }
          },
          {
            id: 'ndvi-layer',
            type: 'raster',
            source: 'ndvi-tiles',
            minzoom: 0,
            maxzoom: 19,
            paint: {
              'raster-opacity': 0
            }
          },
          {
            id: 'ndmi-layer',
            type: 'raster',
            source: 'ndmi-tiles',
            minzoom: 0,
            maxzoom: 19,
            paint: {
              'raster-opacity': 0
            }
          },
          {
            id: 'ndbi-layer',
            type: 'raster',
            source: 'ndbi-tiles',
            minzoom: 0,
            maxzoom: 19,
            paint: {
              'raster-opacity': 0
            }
          },
          {
            id: 'heatmap-layer',
            type: 'raster',
            source: 'heatmap-tiles',
            minzoom: 0,
            maxzoom: 19,
            paint: {
              'raster-opacity': 0
            }
          }
        ]
      },
      center: [initialLon, initialLat],
      zoom: 13,
      pitch: 45,
      bearing: 0
    });

    map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-right');

    // prepare click handler but attach only after 'load'
    const clickHandler = (e: any) => {
      try {
        const { lng, lat } = e.lngLat;
        console.debug('[MapView] click', { isDrawing: isDrawingRef.current, lng, lat });
        if (isDrawingRef.current && onPlotPointsChangeRef.current) {
          const current = plotPointsRef.current ?? [];
          const newPoints = [...current, [lng, lat] as [number, number]];
          onPlotPointsChangeRef.current(newPoints);
          console.debug('[MapView] added plot point, new length', newPoints.length);
        }
      } catch (err) {
        console.warn('[MapView] clickHandler error', err);
      }
    };
    clickHandlerRef.current = clickHandler;

    map.current.on('load', () => {
      setMapLoaded(true);
      if (onLocationChangeRef.current) {
        onLocationChangeRef.current(initialLat, initialLon);
      }

      // attach click handler after load to be safe
      try {
        map.current?.on('click', clickHandler);
        console.debug('[MapView] click handler attached after load');
      } catch (e) {
        console.warn('[MapView] failed to attach click handler', e);
      }

      // expose helper to read current drawing points (used by Sidebar)
      (window as any).__getCurrentPlotPoints = () => {
        try {
          return (plotPointsRef.current ?? []).slice();
        } catch {
          return [];
        }
      };
      console.debug('[MapView] __getCurrentPlotPoints exposed');
    });

    // expose programmatic flyTo helper and listen for semagric:flyToPlot events
    (window as any).__mapFlyTo = (lat: number, lon: number, zoom = 16) => {
      try {
        console.debug('[MapView] __mapFlyTo called', { lat, lon, zoom });
        if (!map.current) return;
        map.current.flyTo({ center: [lon, lat], zoom, essential: true });
      } catch (err) {
        console.warn('[MapView] __mapFlyTo error', err);
      }
    };

    const flyHandler = (ev: any) => {
      try {
        const { lat, lon, zoom } = ev.detail || {};
        console.debug('[MapView] semagric:flyToPlot event', ev.detail);
        if (typeof lat !== 'number' || typeof lon !== 'number') return;
        (window as any).__mapFlyTo(lat, lon, typeof zoom === 'number' ? zoom : 16);
      } catch (err) {
        console.warn('[MapView] flyHandler error', err);
      }
    };
    window.addEventListener('semagric:flyToPlot', flyHandler);

    return () => {
      try {
        if (map.current && clickHandlerRef.current) {
          map.current.off('click', clickHandlerRef.current);
        }
      } catch (e) { console.warn('[MapView] cleanup click off error', e); }
      try { delete (window as any).__mapFlyTo; } catch {}
      try { delete (window as any).__getCurrentPlotPoints; } catch {}
      window.removeEventListener('semagric:flyToPlot', flyHandler);
    };
  }, []);

  // Update marker (removed - no marker display needed)
  useEffect(() => {
    if (!map.current || !weather) return;

    // Remove existing marker if any
    if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }

    // Only fly to location without showing marker
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
        cursor: grab;
        z-index: 1000;
        display: block;
      `;

      // ensure no visible label: remove text, title and any data attribute
      el.textContent = '';
      el.innerHTML = '';
      el.removeAttribute('title');
      el.removeAttribute('data-index');
      el.setAttribute('aria-hidden', 'true');

      // extra safety: hide any text rendered by CSS by forcing font-size/line-height to zero
      el.style.fontSize = '0px';
      el.style.lineHeight = '0';

      const m = new maplibregl.Marker({ element: el, anchor: 'center', draggable: true })
        .setLngLat(point)
        .addTo(map.current!);

      // Add drag end listener to update the point
      m.on('dragend', () => {
        const newLngLat = m.getLngLat();
        const newPoints = plotPoints.map((p, i) => 
          i === index ? [newLngLat.lng, newLngLat.lat] as [number, number] : p
        );
        if (onPlotPointsChangeRef.current) {
          onPlotPointsChangeRef.current(newPoints);
        }
      });

      // Change cursor style on drag
      m.on('dragstart', () => {
        el.style.cursor = 'grabbing';
      });

      m.on('dragend', () => {
        el.style.cursor = 'grab';
      });

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

  // Satellite imagery layer (optional)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const satSourceId = 'esri-world-imagery';
    const satLayerId = 'esri-world-imagery-layer';

    // add source if missing
    if (!map.current.getSource(satSourceId)) {
      map.current.addSource(satSourceId, {
        type: 'raster',
        tiles: [
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'Esri World Imagery'
      });
    }

    // add layer if missing (start hidden)
    if (!map.current.getLayer(satLayerId)) {
      map.current.addLayer({
        id: satLayerId,
        type: 'raster',
        source: satSourceId,
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 1.0 }
      }, undefined);
    }

    // toggle helper for quick testing in console
    (window as any).toggleSatellite = (show: boolean) => {
      try {
        if (!map.current) return;
        const layerExists = !!map.current.getLayer(satLayerId);
        if (!layerExists) return;
        map.current.setLayoutProperty(satLayerId, 'visibility', show ? 'visible' : 'none');
      } catch (e) { /* ignore */ }
    };

    return () => {
      try {
        if (map.current?.getLayer(satLayerId)) map.current.removeLayer(satLayerId);
        if (map.current?.getSource(satSourceId)) map.current.removeSource(satSourceId);
      } catch {}
      delete (window as any).toggleSatellite;
    };
  }, [mapLoaded]);

  // toggle visibility when state changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const osmLayerId = 'osm-tiles-layer';
    const satLayerId = 'esri-world-imagery-layer';
    try {
      if (map.current.getLayer(satLayerId)) {
        map.current.setLayoutProperty(satLayerId, 'visibility', satVisible ? 'visible' : 'none');
      }
      if (map.current.getLayer(osmLayerId)) {
        map.current.setLayoutProperty(osmLayerId, 'visibility', satVisible ? 'none' : 'visible');
      }
    } catch (e) {
      // ignore errors when layers not present yet
    }
  }, [satVisible, mapLoaded]);

  // map control UI (OSM / Satélite)
  useEffect(() => {
    if (!mapContainer.current || !map.current || !mapLoaded) return;

    const ctrl = document.createElement('div');
    ctrl.className = 'map-base-toggle';
    ctrl.style.cssText = `
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 1000;
      display: flex;
      gap: 6px;
      background: rgba(255,255,255,0.9);
      padding: 6px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      font-size: 13px;
    `;

    const btnOSM = document.createElement('button');
    btnOSM.textContent = 'OSM';
    btnOSM.style.cssText = `
      padding: 6px 10px;
      border-radius: 6px;
      border: 0;
      background: ${satVisible ? 'transparent' : '#0ea5a4'};
      color: ${satVisible ? '#111' : '#fff'};
      cursor: pointer;
    `;

    const btnSat = document.createElement('button');
    btnSat.textContent = 'Satélite';
    btnSat.style.cssText = `
      padding: 6px 10px;
      border-radius: 6px;
      border: 0;
      background: ${satVisible ? '#0ea5a4' : 'transparent'};
      color: ${satVisible ? '#fff' : '#111'};
      cursor: pointer;
    `;

    const updateStyles = () => {
      btnOSM.style.background = satVisible ? 'transparent' : '#0ea5a4';
      btnOSM.style.color = satVisible ? '#111' : '#fff';
      btnSat.style.background = satVisible ? '#0ea5a4' : 'transparent';
      btnSat.style.color = satVisible ? '#fff' : '#111';
    };

    btnOSM.onclick = () => {
      setSatVisible(false);
      updateStyles();
    };
    btnSat.onclick = () => {
      setSatVisible(true);
      updateStyles();
    };

    ctrl.appendChild(btnOSM);
    ctrl.appendChild(btnSat);
    mapContainer.current.appendChild(ctrl);

    return () => {
      try { ctrl.remove(); } catch {}
    };
  }, [mapLoaded, satVisible]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const STORAGE_KEY = 'semagric:polygons:v1';
    const createdIds = new Set<string>();

    const createImageOverlayFor = (points: [number, number][], idSuffix: string, color?: string) => {
      if (!map.current) return;
      const imageSourceId = `saved-plot-image-src-${idSuffix}`;
      const imageLayerId = `saved-plot-image-layer-${idSuffix}`;

      // if exists, skip
      if (map.current.getSource(imageSourceId) || map.current.getLayer(imageLayerId)) return;

      // compute bbox
      const lons = points.map(p => p[0]);
      const lats = points.map(p => p[1]);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const lonPad = (maxLon - minLon) * 0.12 || 0.0005;
      const latPad = (maxLat - minLat) * 0.12 || 0.0005;
      const bbox = [minLon - lonPad, minLat - latPad, maxLon + lonPad, maxLat + latPad];

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

      const lonToX = (lon: number) => ((lon - bbox[0]) / (bbox[2] - bbox[0])) * canvasWidth;
      const latToY = (lat: number) => canvasHeight - ((lat - bbox[1]) / (bbox[3] - bbox[1])) * canvasHeight;

      // draw polygon
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.beginPath();
      points.forEach((pt, i) => {
        const x = lonToX(pt[0]);
        const y = latToY(pt[1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();

      // pick color or default
      ctx.fillStyle = color ?? 'rgba(34,197,94,0.45)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();

      const dataUrl = canvas.toDataURL('image/png');

      const coords = [
        [bbox[0], bbox[3]],
        [bbox[2], bbox[3]],
        [bbox[2], bbox[1]],
        [bbox[0], bbox[1]]
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
          paint: { 'raster-opacity': 0.75 }
        }, undefined);
      } catch (err) {
        // ignore if already exists
      }
    };

    const addSavedPlotToMap = (p: SavedPlot) => {
      if (!map.current) return;
      const sourceId = `saved-plot-src-${p.id}`;
      const fillId = `saved-plot-fill-${p.id}`;
      const lineId = `saved-plot-line-${p.id}`;

      // avoid duplicate
      if (map.current.getSource(sourceId) || map.current.getLayer(fillId) || map.current.getLayer(lineId)) {
        return;
      }

      const coordsClosed = [...p.coordinates, p.coordinates[0]];

      try {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [coordsClosed]
            }
          }
        });

        map.current.addLayer({
          id: fillId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': p.color ?? '#22c55e',
            'fill-opacity': 0.45
          }
        });

        map.current.addLayer({
          id: lineId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#ffffff',
            'line-width': 2,
            'line-opacity': 0.85
          }
        });

        // create popup showing name, area (m²), hectares and notification (compact + transparent background)
        const ha = (p.area_m2 ?? 0) / 10000;
        const titleSafe = String(p.name ?? 'Talhão').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const notif = (p.notifications && p.notifications.length > 0) ? p.notifications[0].message : 'notificação de demonstração';
        const popupHtml = `
          <div class="sg-popup">
            <div class="sg-popup-row-top">
              <div class="sg-popup-title">${titleSafe}</div>
              <div class="sg-popup-badge">#${(p.number ?? '')}</div>
            </div>

            <div class="sg-popup-row"><span class="label">Área</span><span class="value">${(p.area_m2 ?? 0).toFixed(2)} m²</span></div>
            <div class="sg-popup-row"><span class="label">Hectares</span><span class="value">${ha.toFixed(4)} ha</span></div>

            <div class="sg-popup-notif">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:8px;flex:0 0 14px;">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div class="sg-popup-notif-text">${String(notif).replace(/</g,'&lt;')}</div>
            </div>
          </div>

          <style>
            /* popup core */
            .sg-popup{
              font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial;
              min-width:110px; max-width:220px; padding:6px; border-radius:8px;
              background: rgba(255,255,255,0.85); color:#0b1220;
              box-shadow: 0 6px 18px rgba(2,6,23,0.12); font-size:12px; line-height:1.15;
              display:flex; flex-direction:column; gap:6px;
            }
            .sg-popup-row-top{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
            .sg-popup-title{ font-weight:700; font-size:13px; color:inherit; }
            .sg-popup-badge{ font-size:11px; background:rgba(0,0,0,0.06); padding:4px 6px; border-radius:6px; color:#0b1220; }
            .sg-popup-row{ display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; color:#475569; }
            .sg-popup-row .value{ font-weight:700; color:#071029; }
            .sg-popup-notif{ display:flex; align-items:center; gap:8px; padding-top:2px; color:#92400e; font-size:12px; }
            .sg-popup-notif-text{ opacity:0.95; color:#92400e; font-weight:500; }
            .sg-popup svg { color: #f59e0b; } /* amber icon */

            /* make outer maplibre popup wrapper content transparent to remove white backing */
            .sg-popup-wrapper .maplibregl-popup-content, .sg-popup-wrapper .mapboxgl-popup-content {
              background: transparent !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
            /* hide the default popup triangle/tip */
            .sg-popup-wrapper .maplibregl-popup-tip, .sg-popup-wrapper .mapboxgl-popup-tip {
              display: none !important;
            }

            /* dark mode */
            .dark .sg-popup{
              background: rgba(8,10,14,0.9); color:#e6eef8; box-shadow: 0 6px 18px rgba(2,6,23,0.6);
            }
            .dark .sg-popup-row, .dark .sg-popup-notif{ color:#cbd5e1; }
            .dark .sg-popup-row .value{ color:#f1f5f9; } /* bright color for values in dark mode */
            .dark .sg-popup-notif-text{ color:#fde68a; } /* lighter amber on dark */
            .dark .sg-popup-badge{ background: rgba(255,255,255,0.03); color:#e6eef8; }
          </style>
        `;
        // pass a wrapper classname so CSS above targets the library DOM structure
        new maplibregl.Popup({ offset: [0, -12], closeButton: true, closeOnClick: false, className: 'sg-popup-wrapper' })
          .setLngLat([p.centroid.lon, p.centroid.lat])
          .setHTML(popupHtml)
          .addTo(map.current);

        // create a raster/image overlay copy for visual persistence (unique per saved plot)
        try { createImageOverlayFor(p.coordinates, p.id, p.color); } catch {}

        createdIds.add(p.id);
      } catch (e) {
        // ignore errors (e.g. duplicate layers)
        // console.warn(e);
      }
    };

    // Load saved polygons from localStorage and render them
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const list: SavedPlot[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((p) => {
            if (p && p.id && Array.isArray(p.coordinates) && p.coordinates.length >= 3) {
              addSavedPlotToMap(p);
            }
          });
        }
      }
    } catch (e) {
      // ignore parse errors
    }

    // Expose helper so Sidebar (or others) can ask to draw a single saved plot immediately
    (window as any).__showSavedPlot = (p: SavedPlot) => {
      try {
        if (!p || !p.id) return;
        addSavedPlotToMap(p);
      } catch (_) {}
    };

    // cleanup: remove only layers/sources created for saved plots when MapView unmounts
    return () => {
      try {
        createdIds.forEach((id) => {
          const sourceId = `saved-plot-src-${id}`;
          const fillId = `saved-plot-fill-${id}`;
          const lineId = `saved-plot-line-${id}`;
          const imgSrc = `saved-plot-image-src-${id}`;
          const imgLayer = `saved-plot-image-layer-${id}`;

          try { if (map.current?.getLayer(lineId)) map.current.removeLayer(lineId); } catch {}
          try { if (map.current?.getLayer(fillId)) map.current.removeLayer(fillId); } catch {}
          try { if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId); } catch {}

          try { if (map.current?.getLayer(imgLayer)) map.current.removeLayer(imgLayer); } catch {}
          try { if (map.current?.getSource(imgSrc)) map.current.removeSource(imgSrc); } catch {}
        });
      } catch {}
      try { delete (window as any).__showSavedPlot; } catch {}
    };
  }, [mapLoaded]);

  useEffect(() => {
    const handler = (ev: any) => {
      try {
        const { lat, lon } = ev.detail || {};
        if (!map.current || typeof lat !== 'number' || typeof lon !== 'number') return;
        map.current.flyTo({ center: [lon, lat], zoom: Math.max(map.current.getZoom(), 16), essential: true });
      } catch {}
    };
    window.addEventListener('semagric:flyToPlot', handler);
    return () => window.removeEventListener('semagric:flyToPlot', handler);
  }, []);

  // Control sentinel2 layers based on sentinelFilters and sentinelOpacity props
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    console.log('Updating sentinel layers:', { sentinelFilters, sentinelOpacity });

    // Define layer configurations: [layerId, enabled, opacity]
    const layerConfigs = [
      ['sentinel2-layer', sentinelFilters.satellite, sentinelOpacity.satellite],
      ['ndvi-layer', sentinelFilters.ndvi, sentinelOpacity.ndvi],
      ['ndmi-layer', sentinelFilters.ndmi, sentinelOpacity.ndmi],
      ['ndbi-layer', sentinelFilters.ndbi, sentinelOpacity.ndbi],
      ['heatmap-layer', sentinelFilters.heatmap, sentinelOpacity.heatmap]
    ] as const;

    layerConfigs.forEach(([layerId, isEnabled, opacity]) => {
      try {
        const layer = map.current?.getLayer(layerId);
        if (!layer) {
          console.debug(`Layer ${layerId} not found on map`);
          return;
        }
        
        // Set visibility
        map.current.setLayoutProperty(
          layerId,
          'visibility',
          isEnabled ? 'visible' : 'none'
        );

        // Set opacity (0-1 range)
        const normalizedOpacity = Math.max(0, Math.min(1, opacity));
        map.current.setPaintProperty(
          layerId,
          'raster-opacity',
          normalizedOpacity
        );
        
        console.log(`Layer ${layerId}: visible=${isEnabled}, opacity=${normalizedOpacity}`);
      } catch (e) {
        // Layer might not exist yet, ignore
        console.warn(`Error updating layer ${layerId}:`, e);
      }
    });
  }, [sentinelFilters, sentinelOpacity, mapLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Sentinel-2 Data Date Display */}
      {sentinel2Data && sentinel2Data.acquisitionDate && (
        <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded shadow-lg font-medium">
            🛰️ Sentinel-2: {new Date(sentinel2Data.acquisitionDate).toLocaleDateString('pt-BR')}
          </div>
        </div>
      )}

      {/* Overlay gradient (temporarily transparent for debugging) */}
      <div className="absolute inset-0 pointer-events-none bg-none" />
    </div>
  );
}
