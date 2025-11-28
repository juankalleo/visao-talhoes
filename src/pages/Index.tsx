import { useState, useEffect, useCallback } from 'react';
import MapView from '@/components/MapView';
import Sidebar from '@/components/Sidebar';
import { useWeather } from '@/hooks/useWeather';
import { usePolling, PollingInterval } from '@/hooks/usePolling';
import { useAlerts } from '@/hooks/useAlerts';

const Index = () => {
  const { weather, loading, fetchWeather } = useWeather();
  const { alerts, removeAlert, clearAlerts } = useAlerts(weather);
  
  const [interval, setInterval] = useState<PollingInterval>(null);
  const [currentLocation, setCurrentLocation] = useState({ lat: -8.7619, lon: -63.9039 });
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [layers, setLayers] = useState({
    rain: false,
    wind: false,
    temperature: false,
    clouds: false
  });

  const handleLocationChange = useCallback((lat: number, lon: number) => {
    setCurrentLocation({ lat, lon });
    fetchWeather(lat, lon);
  }, [fetchWeather]);

  const handleRefresh = useCallback(() => {
    fetchWeather(currentLocation.lat, currentLocation.lon);
  }, [fetchWeather, currentLocation]);

  const isPolling = usePolling(handleRefresh, interval);

  const handleLayerChange = (layer: keyof typeof layers, value: boolean) => {
    setLayers(prev => ({ ...prev, [layer]: value }));
  };

  // Initial load
  useEffect(() => {
    fetchWeather(currentLocation.lat, currentLocation.lon);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        weather={weather}
        loading={loading}
        alerts={alerts}
        onRemoveAlert={removeAlert}
        onClearAlerts={clearAlerts}
        interval={interval}
        onIntervalChange={setInterval}
        onRefresh={handleRefresh}
        isPolling={isPolling}
        layers={layers}
        onLayerChange={handleLayerChange}
        showHeatmap={showHeatmap}
        onHeatmapChange={setShowHeatmap}
      />
      
      <main className="flex-1 relative">
        <MapView
          weather={weather}
          onLocationChange={handleLocationChange}
          showHeatmap={showHeatmap}
          layers={layers}
        />
      </main>
    </div>
  );
};

export default Index;
