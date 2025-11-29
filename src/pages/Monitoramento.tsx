import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MapView from "@/components/MapView";
import usePolygons, { SavedPlot } from "@/hooks/usePolygons";
import { PollingInterval } from "@/hooks/usePolling";
import { WeatherData, WeatherAlert } from "@/lib/weather-api";

export default function Monitoramento() {
  const { polygons } = usePolygons();
  const [isDrawingPlot, setIsDrawingPlot] = useState(false);
  const [plotPoints, setPlotPoints] = useState<[number, number][]>([]);

  // mock states required by Sidebar (replace with your real data where appropriate)
  const [weather] = useState<WeatherData | null>(null);
  const [loading] = useState(false);
  const [interval] = useState<PollingInterval>(null);

  // Alerts state (use WeatherAlert so AlertsPanel receives correct type)
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);

  useEffect(() => {
    if (polygons && polygons.length > 0) {
      const p = polygons[0] as SavedPlot;
      const demo: WeatherAlert = {
        id: `demo-${p.id}`,
        type: "rain", // categoria genérica
        severity: "danger", // vermelho
        message: "Chuva nas próximas 6 horas",
        timestamp: new Date().toISOString(),
        // se WeatherAlert tem outros campos opcionais, deixe-os indefinidos
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

  return (
    <div className="w-full h-screen flex">
      <aside className="z-40">
        <Sidebar
          weather={weather}
          loading={loading}
          alerts={alerts}
          onRemoveAlert={handleRemoveAlert}
          onClearAlerts={handleClearAlerts}
          interval={interval}
          onIntervalChange={() => {}}
          onRefresh={() => {}}
          isPolling={false}
          layers={{ rain: false, wind: false, temperature: false, clouds: false }}
          onLayerChange={() => {}}
          showHeatmap={false}
          onHeatmapChange={() => {}}
          isDrawingPlot={isDrawingPlot}
          onToggleDrawingPlot={toggleDrawing}
          onClearPlot={clearPlot}
          plotPointsCount={plotPoints.length}
          plotPoints={plotPoints}
          onImportPlotPoints={(p) => {
            setPlotPoints(p);
            setIsDrawingPlot(true);
          }}
          onGoToLocation={() => {}}
        />
      </aside>

      <main className="flex-1 relative">
        <MapView
          weather={weather}
          onLocationChange={() => {}}
          showHeatmap={false}
          layers={{ rain: false, wind: false, temperature: false, clouds: false }}
          isDrawingPlot={isDrawingPlot}
          onPlotPointsChange={handlePlotPointsChange}
          plotPoints={plotPoints}
        />
      </main>
    </div>
  );
}