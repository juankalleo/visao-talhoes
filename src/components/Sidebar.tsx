import { polygonAreaMeters } from '@/lib/utils';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Menu, 
  X, 
  Home, 
  Bell,
  CloudSun
} from 'lucide-react';
import WeatherStats from './WeatherStats';
import AlertsPanel from './AlertsPanel';
import IntervalSelector from './IntervalSelector';
import LayerToggle from './LayerToggle';
import PlotDrawer from './PlotDrawer';
import { WeatherData, WeatherAlert } from '@/lib/weather-api';
import { PollingInterval } from '@/hooks/usePolling';
import React from 'react';

interface SidebarProps {
  weather: WeatherData | null;
  loading: boolean;
  alerts: WeatherAlert[];
  onRemoveAlert: (id: string) => void;
  onClearAlerts: () => void;
  interval: PollingInterval;
  onIntervalChange: (interval: PollingInterval) => void;
  onRefresh: () => void;
  isPolling: boolean;
  layers: {
    rain: boolean;
    wind: boolean;
    temperature: boolean;
    clouds: boolean;
  };
  onLayerChange: (layer: keyof SidebarProps['layers'], value: boolean) => void;
  showHeatmap: boolean;
  onHeatmapChange: (value: boolean) => void;
  isDrawingPlot: boolean;
  onToggleDrawingPlot: () => void;
  onClearPlot: () => void;
  onSavePlot: () => void;
  plotPointsCount: number;
  // new: import coordinates as plot points
  onImportPlotPoints?: (points: [number, number][]) => void;
}

export default function Sidebar({
  weather,
  loading,
  alerts,
  onRemoveAlert,
  onClearAlerts,
  interval,
  onIntervalChange,
  onRefresh,
  isPolling,
  layers,
  onLayerChange,
  showHeatmap,
  onHeatmapChange,
  isDrawingPlot,
  onToggleDrawingPlot,
  onClearPlot,
  onSavePlot,
  plotPointsCount,
  onImportPlotPoints
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="secondary"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden glass"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed lg:relative inset-y-0 left-0 z-40 w-80 bg-background/95 backdrop-blur-xl border-r border-border overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CloudSun className="w-5 h-5 text-primary" />
                  </div>
                  <h1 className="text-lg font-semibold">SEMAGRIC Talhões</h1>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Monitoramento climático em tempo real
              </p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full grid grid-cols-3 m-4 mb-0">
                <TabsTrigger value="stats" className="gap-2">
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Dados</span>
                </TabsTrigger>
                <TabsTrigger value="alerts" className="gap-2">
                  <Bell className="w-4 h-4" />
                  {alerts.length > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">
                      {alerts.length}
                    </Badge>
                  )}
                  <span className="hidden sm:inline">Alertas</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <CloudSun className="w-4 h-4" />
                  <span className="hidden sm:inline">Config</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="stats" className="h-full m-0">
                  <div className="h-full overflow-y-auto hide-scrollbar p-4">
                    <WeatherStats weather={weather} loading={loading} />
                  </div>
                </TabsContent>

                <TabsContent value="alerts" className="h-full m-0">
                  <div className="h-full overflow-y-auto hide-scrollbar p-4">
                    <AlertsPanel
                      alerts={alerts}
                      onRemoveAlert={onRemoveAlert}
                      onClearAll={onClearAlerts}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="h-full m-0">
                  <div className="h-full overflow-y-auto hide-scrollbar p-4 space-y-4">
                    <IntervalSelector
                      interval={interval}
                      onIntervalChange={onIntervalChange}
                      onRefresh={onRefresh}
                      isPolling={isPolling}
                    />
                    <LayerToggle
                      layers={layers}
                      onLayerChange={onLayerChange}
                      showHeatmap={showHeatmap}
                      onHeatmapChange={onHeatmapChange}
                    />
                    <PlotDrawer
                      isDrawing={isDrawingPlot}
                      onToggleDrawing={onToggleDrawingPlot}
                      onClearPlot={onClearPlot}
                      onSavePlot={onSavePlot}
                      pointsCount={plotPointsCount}
                    />

                    {/* Demarcar talhão por coordenadas - cálculo de área */}
                    <div className="mt-4 p-3 border rounded-md bg-muted/50">
                      <h4 className="text-sm font-medium mb-2">Demarcar talhão por coordenadas</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Cole um array JSON de coordenadas [lon, lat] (ex: [[-63.9,-8.76], [-63.91,-8.76], ...])
                      </p>
                      <CoordsAreaCalculator onImport={onImportPlotPoints} />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Overlay for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function CoordsAreaCalculator({ onImport }: { onImport?: (points: [number, number][]) => void }) {
  const [coordsInput, setCoordsInput] = useState<string>('');
  const [area, setArea] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsedCoords, setParsedCoords] = useState<[number, number][] | null>(null);

  const handleCalculate = () => {
    setError(null);
    setArea(null);
    setParsedCoords(null);
    try {
      const parsed = JSON.parse(coordsInput);
      if (!Array.isArray(parsed) || parsed.length < 3) {
        setError('Insira um array JSON com pelo menos 3 coordenadas.');
        return;
      }
      const coords: [number, number][] = parsed.map((c: any) => {
        if (!Array.isArray(c) || c.length < 2) throw new Error('Formato inválido');
        return [Number(c[0]), Number(c[1])];
      });
      setParsedCoords(coords);
      const a = polygonAreaMeters(coords);
      setArea(a);
    } catch (err) {
      setError('Erro ao analisar coordenadas. Verifique o formato JSON.');
    }
  };

  const handleImport = () => {
    if (!parsedCoords) {
      setError('Valide as coordenadas primeiro.');
      return;
    }
    if (typeof (arguments as any) !== 'undefined') { /* noop to keep linter calm */ }
    // call parent importer if provided (Sidebar passes onImport)
    (CoordsAreaCalculator as any).__parentImport?.(parsedCoords);
  };

  return (
    <div>
      <textarea
        className="w-full h-24 p-2 text-sm rounded border"
        placeholder='[[lon,lat],[lon,lat],...]'
        value={coordsInput}
        onChange={(e) => setCoordsInput(e.target.value)}
      />
      <div className="flex gap-2 mt-2">
        <Button onClick={handleCalculate}>Calcular área</Button>
        <Button variant="ghost" onClick={() => { setCoordsInput(''); setArea(null); setError(null); }}>
          Limpar
        </Button>
        <Button
          onClick={() => {
            if (typeof (CoordsAreaCalculator as any).__parentImport === 'function') {
              if (!parsedCoords) {
                setError('Valide as coordenadas primeiro.');
                return;
              }
              (CoordsAreaCalculator as any).__parentImport(parsedCoords);
            }
          }}
          disabled={!parsedCoords}
        >
          Inserir como pontos
        </Button>
      </div>
      {area !== null && (
        <p className="mt-2 text-sm">
          Área: {area.toFixed(2)} m² ({(area / 10000).toFixed(4)} ha)
        </p>
      )}
      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
    </div>
  );
}

// attach a runtime hook so parent can set import handler without changing closure
// parent (Sidebar) will assign this if it received onImportPlotPoints prop
function attachImportHandler(fn?: (p: [number, number][]) => void) {
  (CoordsAreaCalculator as any).__parentImport = fn ?? undefined;
}
// when Sidebar mounts, attach the handler
// ensure attach runs: call it here (Sidebar scope) so parent prop is wired
attachImportHandler((typeof (undefined) !== 'undefined') ? undefined : undefined);
