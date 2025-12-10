import { useState, useEffect, useCallback } from 'react';
import MapView from '@/components/MapView';
import Sidebar from '@/components/Sidebar';
import { useWeather } from '@/hooks/useWeather';
import { usePolling, PollingInterval } from '@/hooks/usePolling';
import { useAlerts } from '@/hooks/useAlerts';
import { useRemoteSensing } from '@/hooks/useRemoteSensing';
import { useSentinel2 } from '@/hooks/useSentinel2';

const Index = () => {
  const { weather, loading, fetchWeather } = useWeather();
  const { alerts, removeAlert, clearAlerts } = useAlerts(weather);
  const { remoteSensingData, fetchData: fetchRemoteSensing } = useRemoteSensing();
  const { sentinel2Data, ndviStats, fetchData: fetchSentinel2 } = useSentinel2();
  
  const [interval, setInterval] = useState<PollingInterval>(null);
  const [currentLocation, setCurrentLocation] = useState({ lat: -8.7619, lon: -63.9039 });
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [layers, setLayers] = useState({
    rain: false,
    wind: false,
    temperature: false,
    clouds: false,
    ndvi: false,
    ndmi: false
  });
  const [sentinelFilters, setSentinelFilters] = useState({
    satellite: false,
    ndvi: false,
    ndmi: false,
    ndbi: false,
    heatmap: false
  });
  const [sentinelOpacity, setSentinelOpacity] = useState({
    satellite: 0.85,
    ndvi: 0.75,
    ndmi: 0.75,
    ndbi: 0.75,
    heatmap: 0.7
  });
  const [isDrawingPlot, setIsDrawingPlot] = useState(false);
  const [plotPoints, setPlotPoints] = useState<[number, number][]>([]);
  const [savedPlot, setSavedPlot] = useState<[number, number][]>([]);

  const handleLocationChange = useCallback((lat: number, lon: number) => {
    setCurrentLocation({ lat, lon });
    fetchWeather(lat, lon);
    fetchRemoteSensing(lat, lon);
    fetchSentinel2(lat, lon);
  }, [fetchWeather, fetchRemoteSensing, fetchSentinel2]);

  const handleRefresh = useCallback(() => {
    fetchWeather(currentLocation.lat, currentLocation.lon);
  }, [fetchWeather, currentLocation]);

  const isPolling = usePolling(handleRefresh, interval);

  const handleLayerChange = (layer: keyof typeof layers, value: boolean) => {
    setLayers(prev => ({ ...prev, [layer]: value }));
  };

  const handleSentinelFilterChange = (filter: keyof typeof sentinelFilters, value: boolean) => {
    setSentinelFilters(prev => ({ ...prev, [filter]: value }));
  };

  const handleSentinelOpacityChange = (layer: keyof typeof sentinelOpacity, value: number) => {
    setSentinelOpacity(prev => ({ ...prev, [layer]: value }));
  };

  const handleToggleDrawingPlot = useCallback(() => {
    setIsDrawingPlot(prev => !prev);
  }, []);

  const handleClearPlot = useCallback(() => {
    setPlotPoints([]);
    setSavedPlot([]);
    setIsDrawingPlot(false);
  }, []);

  const handleSavePlot = useCallback(() => {
    if (plotPoints.length >= 3) {
      setSavedPlot(plotPoints);
      setPlotPoints([]);
      setIsDrawingPlot(false);
    }
  }, [plotPoints]);

  // Initial load
  useEffect(() => {
    fetchWeather(currentLocation.lat, currentLocation.lon);
    fetchRemoteSensing(currentLocation.lat, currentLocation.lon);
    fetchSentinel2(currentLocation.lat, currentLocation.lon);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        weather={weather}
        loading={loading}
        remoteSensingData={remoteSensingData}
        sentinel2Data={sentinel2Data}
        interval={interval}
        onIntervalChange={setInterval}
        onRefresh={handleRefresh}
        isPolling={isPolling}
        layers={layers}
        onLayerChange={handleLayerChange}
        sentinelFilters={sentinelFilters}
        sentinelOpacity={sentinelOpacity}
        onSentinelFilterChange={handleSentinelFilterChange}
        onSentinelOpacityChange={handleSentinelOpacityChange}
        showHeatmap={showHeatmap}
        onHeatmapChange={setShowHeatmap}
        isDrawingPlot={isDrawingPlot}
        onToggleDrawingPlot={handleToggleDrawingPlot}
        onClearPlot={handleClearPlot}
        onSavePlot={handleSavePlot}
        plotPointsCount={plotPoints.length}
      />
      
      <main className="flex-1 relative">
        <MapView
          weather={weather}
          sentinel2Data={sentinel2Data}
          onLocationChange={handleLocationChange}
          showHeatmap={showHeatmap}
          layers={layers}
          sentinelFilters={sentinelFilters}
          sentinelOpacity={sentinelOpacity}
          isDrawingPlot={isDrawingPlot}
          onPlotPointsChange={setPlotPoints}
          plotPoints={plotPoints}
          savedPlot={savedPlot}
        />
      </main>
    </div>
  );
};

export default Index;
