import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MapView from "@/components/MapView";
import usePolygons, { SavedPlot } from "@/hooks/usePolygons";
import { PollingInterval } from "@/hooks/usePolling";
import { WeatherData, WeatherAlert } from "@/lib/weather-api";
import { useWeather } from '@/hooks/useWeather';

export default function Monitoramento() {
  const { polygons } = usePolygons();
  const [isDrawingPlot, setIsDrawingPlot] = useState(false);
  const [plotPoints, setPlotPoints] = useState<[number, number][]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);

  const { weather, loading, fetchWeather } = useWeather();
  const [interval] = useState<PollingInterval>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);

  const [sentinelFilters, setSentinelFilters] = useState({
    satellite: true,
    ndvi: false,
    ndmi: false,
    ndbi: false,
    heatmap: false,
  });

  const [sentinelOpacity, setSentinelOpacity] = useState({
    satellite: 0.85,
    ndvi: 0.75,
    ndmi: 0.75,
    ndbi: 0.75,
    heatmap: 0.7,
  });

  useEffect(() => {
    if (polygons && polygons.length > 0) {
      const p = polygons[0] as SavedPlot;
      const demo: WeatherAlert = {
        id: `demo-${p.id}`,
        type: "rain",
        severity: "danger",
        message: "Chuva nas próximas 6 horas",
        timestamp: new Date().toISOString(),
      } as unknown as WeatherAlert;

      setAlerts((prev) => {
        if (prev.find((a) => a.id === demo.id)) return prev;
        return [demo, ...prev];
      });
    }
  }, [polygons]);

  const toggleDrawing = () => {
    setIsDrawingPlot((v) => !v);
  };

  const handlePlotPointsChange = (points: [number, number][]) => {
    setPlotPoints(points);
  };

  const clearPlot = () => {
    setPlotPoints([]);
    setIsDrawingPlot(false);
  };

  const handleRemoveAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleClearAlerts = () => {
    setAlerts([]);
  };

  const handleSentinelFilterChange = (filter: keyof typeof sentinelFilters, value: boolean) => {
    setSentinelFilters((prev) => ({
      ...prev,
      [filter]: value,
    }));
  };

  const handleSentinelOpacityChange = (layer: keyof typeof sentinelOpacity, value: number) => {
    setSentinelOpacity((prev) => ({
      ...prev,
      [layer]: value,
    }));
  };

  return (
    <div className="w-full h-screen flex">
      <aside className="z-40">
        <Sidebar
          weather={weather}
          loading={loading}
          interval={interval}
          onIntervalChange={() => {}}
          onRefresh={() => {}}
          isPolling={false}
          layers={{ rain: false, wind: false, temperature: false, clouds: false, ndvi: false, ndmi: false }}
          onLayerChange={() => {}}
          sentinelFilters={sentinelFilters}
          sentinelOpacity={sentinelOpacity}
          onSentinelFilterChange={handleSentinelFilterChange}
          onSentinelOpacityChange={handleSentinelOpacityChange}
          showHeatmap={false}
          onHeatmapChange={() => {}}
          isDrawingPlot={isDrawingPlot}
          onToggleDrawingPlot={toggleDrawing}
          onClearPlot={clearPlot}
          plotPointsCount={plotPoints.length}
          onImportPlotPoints={(p) => {
            setPlotPoints(p);
            setIsDrawingPlot(true);
          }}
          onGoToLocation={async (lat, lon, plotId?: string) => {
            try {
              if (plotId) setSelectedPlotId(plotId);
              await fetchWeather(lat, lon);
            } catch (err) {
              console.error("Error fetching weather:", err);
            }
          }}
        />
      </aside>

      <main className="flex-1 relative">
        <MapView
          weather={weather}
          onLocationChange={(lat, lon) => { try { fetchWeather(lat, lon); } catch {} }}
          showHeatmap={false}
          layers={{ rain: false, wind: false, temperature: false, clouds: false }}
          sentinelFilters={sentinelFilters}
          sentinelOpacity={sentinelOpacity}
          isDrawingPlot={isDrawingPlot}
          onPlotPointsChange={handlePlotPointsChange}
          plotPoints={plotPoints}
        />
      </main>
    </div>
  );
}