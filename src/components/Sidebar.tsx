import React, { useState, useEffect } from "react";
import usePolygons, { SavedPlot } from '@/hooks/usePolygons';
import { polygonAreaMeters } from '@/lib/utils';
import { createPlotOnServer } from '@/lib/plots-api';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Menu, 
  X, 
  Home, 
  Bell,
  CloudSun,
  Sun,
  Moon
} from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import WeatherStats from './WeatherStats';
import AlertsPanel from './AlertsPanel';
import IntervalSelector from './IntervalSelector';
import LayerToggle from './LayerToggle';
import PlotDrawer from './PlotDrawer';
import { WeatherData, WeatherAlert } from '@/lib/weather-api';
import { PollingInterval } from '@/hooks/usePolling';

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

  // plotting / heatmap props (optional)
  showHeatmap?: boolean;
  onHeatmapChange?: (value: boolean) => void;

  isDrawingPlot?: boolean;
  onToggleDrawingPlot?: () => void;
  onClearPlot?: () => void;
  onSavePlot?: () => void;
  plotPointsCount?: number;

  // import coordinates -> parent will receive points as [lon, lat][]
  onImportPlotPoints?: (points: [number, number][]) => void;

  // optional handler: center map on lat/lon
  onGoToLocation?: (lat: number, lon: number) => void;

  plotPoints?: [number, number][]; // added: current drawing points (lon, lat)
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
  plotPointsCount,
  onImportPlotPoints,
  onGoToLocation,
  plotPoints = [],
}: SidebarProps) {

  // --- ADDED: estado/handlers para abrir e salvar o modal ---
  const { addPolygon, polygons, updatePolygon, removePolygon } = usePolygons();
  const [showSaveForm, setShowSaveForm] = useState(false);

  // modal initial name (prefill Talhão N)
  const [modalInitialName, setModalInitialName] = useState<string>('');
  // pontos capturados no momento da abertura do modal (garante valor correto no save)
  const [modalCoords, setModalCoords] = useState<[number, number][] | null>(null);

  // Sidebar UI state (fix for "isOpen"/"activeTab" not defined errors)
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('stats');

  const handleOpenSaveForm = () => {
    // set a sensible default name "Talhão N"
    const nextNum = (polygons?.length ?? 0) + 1;
    setModalInitialName(`Talhão ${nextNum}`);
    // try to get latest drawn points from MapView helper (fallback to prop)
    const fromMap = (window as any).__getCurrentPlotPoints ? (window as any).__getCurrentPlotPoints() : null;
    const pts = (fromMap && Array.isArray(fromMap) && fromMap.length > 0) ? fromMap : (plotPoints && plotPoints.length > 0 ? plotPoints : null);
    if (!pts || pts.length < 3) {
      // não abre se não houver pontos suficientes (botão Finalizar só aparece quando há >=3 pontos)
      return;
    }
    setModalCoords(pts);
    setShowSaveForm(true);
  };

  const handleSavePlot = async (payload: { name?: string; area_m2: number; lat: number; lon: number; color: string }) => {
    console.log('[Sidebar] handleSavePlot called', { payload, propPlotPointsLength: plotPoints?.length, modalCoordsLength: modalCoords?.length });
    const pointsToUse = modalCoords ?? plotPoints;
    if (!pointsToUse || pointsToUse.length < 3) {
      setShowSaveForm(false);
      return;
    }

    // compute canonical area & centroid from the exact drawn points
    const computedArea = polygonAreaMeters(pointsToUse);
    const lonAvg = pointsToUse.reduce((s, c) => s + c[0], 0) / pointsToUse.length;
    const latAvg = pointsToUse.reduce((s, c) => s + c[1], 0) / pointsToUse.length;
    const centroid = { lon: lonAvg, lat: latAvg };

    // save polygon shape as drawn (coordinates unchanged)
    const saved = addPolygon(pointsToUse, payload.name ?? modalInitialName, payload.color);

    // prepare metadata patch: area defaults to computedArea unless user changed it,
    // centroid defaults to computed centroid unless user changed it in the form.
    const patch: Partial<SavedPlot> = {};
    if (payload.name && payload.name !== saved.name) patch.name = payload.name;
    if (typeof payload.color === 'string' && payload.color !== saved.color) patch.color = payload.color;
    // use user-entered area if provided (>0), otherwise computed area
    const areaToSave = (typeof payload.area_m2 === 'number' && payload.area_m2 > 0) ? payload.area_m2 : computedArea;
    if (areaToSave !== saved.area_m2) patch.area_m2 = areaToSave;
    const latN = Number(payload.lat);
    const lonN = Number(payload.lon);
    if (!Number.isNaN(latN) && !Number.isNaN(lonN)) {
      // if user provided lat/lon keep it, else use computed centroid
      if (latN !== centroid.lat || lonN !== centroid.lon) patch.centroid = { lon: lonN, lat: latN };
    } else {
      patch.centroid = centroid;
    }
    if (Object.keys(patch).length > 0) {
      try { updatePolygon(saved.id, patch); } catch (e) { /* ignore */ }
    }

    // show saved polygon on map (and popup with area & name)
    const seqNumber = (polygons?.length ?? 0) + 1;
    const toSend = {
      id: saved.id,
      name: payload.name ?? modalInitialName ?? saved.name,
      coordinates: saved.coordinates,
      centroid: (patch.centroid ?? saved.centroid),
      area_m2: (patch.area_m2 ?? saved.area_m2),
      createdAt: saved.createdAt,
      color: patch.color ?? saved.color,
      number: seqNumber
    };

    // try send to server (non-blocking for UX)
    try {
      console.log('[Sidebar] sending plot to server', toSend);
      await createPlotOnServer(toSend);
      toast({ title: 'Talhão salvo', description: 'Talhão registrado no sistema com sucesso.' });
    } catch (err: any) {
      console.warn('[Sidebar] failed to send to server', err);
      toast({ title: 'Salvo localmente', description: 'Talhão salvo localmente. Falha ao enviar ao servidor.' });
    }

    const w = window as any;
    if (typeof w.__showSavedPlot === 'function') {
      try { w.__showSavedPlot({ ...saved, ...(patch as any), number: seqNumber } as SavedPlot); } catch (e) { console.warn(e); }
    }

    if (typeof onClearPlot === 'function') onClearPlot();
    // reset modal coords
    setModalCoords(null);
    setShowSaveForm(false);
  };
  // --- fim adição ---

  // dark mode state persisted in localStorage
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('theme');
      if (val) return val === 'dark';
      // fallback: prefer dark if user OS prefers dark
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch {}
  }, [darkMode]);

  // small responsive toggle button (always rendered, anchored next to the sidebar)
  // position: attached to sidebar when open (left = 320px), near left edge when closed.
  const toggleButtonStyle: React.CSSProperties = {
    left: isOpen ? '320px' : '8px',
  };
  
  const ToggleAttachedButton = (
    <button
      aria-label={isOpen ? 'Fechar sidebar' : 'Abrir sidebar'}
      onClick={() => setIsOpen(v => !v)}
      className="fixed top-12 z-50 flex items-center justify-center w-8 h-10 rounded-r-md shadow-md bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-border focus:outline-none"
      style={{ ...toggleButtonStyle, transition: 'left 200ms ease' }}
    >
      {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  );

  return (
    <>
      {ToggleAttachedButton}
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

            {/* Tabs: Dados / Alertas / Config (restored) */}
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
                    {/*
                      Combine alerts recebidos por props com notificações internas dos talhões.
                      Mapeamos notificações para o formato esperado por AlertsPanel e
                      encaminhamos remoção para o pai (alerts) ou removemos da notificação do talhão.
                    */}
                    {(() => {
                      // map polygon notifications into WeatherAlert-like objects
                      // normalize parent alerts: ensure timestamp is Date
                      const parentAlertsNormalized: WeatherAlert[] = (alerts ?? []).map((a) => ({
                        ...a,
                        timestamp: a.timestamp instanceof Date ? a.timestamp : new Date(String(a.timestamp))
                      }));

                      const plotAlerts: WeatherAlert[] = polygons.flatMap((p) =>
                        (p.notifications ?? []).map((n) => ({
                          id: `plotnotif-${p.id}-${n.id}`,
                          type: 'rain' as const, // map to allowed category
                          severity: 'danger' as const,
                          message: `${n.message} — ${p.name ?? 'Talhão'}`,
                          timestamp: new Date(n.createdAt),
                          // include meta if WeatherAlert accepts extras (cast to any to be safe)
                          ...( { meta: { plotId: p.id } } as any )
                        }))
                      );

                      const combined: WeatherAlert[] = [...parentAlertsNormalized, ...plotAlerts];

                      const handleRemove = (id: string) => {
                        if (id.startsWith('plotnotif-')) {
                          // id format: plotnotif-<plotId>-<notifId>
                          const parts = id.split('-');
                          const plotId = parts[1];
                          const notifId = parts.slice(2).join('-');
                          const p = polygons.find((x) => x.id === plotId);
                          if (!p) return;
                          const remaining = (p.notifications ?? []).filter((n) => n.id !== notifId);
                          try { updatePolygon(plotId, { notifications: remaining }); } catch {}
                          return;
                        }
                        // fallback: delegate to parent
                        try { onRemoveAlert(id); } catch {}
                      };

                      const handleClearAll = () => {
                        // clear parent alerts
                        try { onClearAlerts(); } catch {}
                        // also clear notifications from all polygons (local)
                        polygons.forEach((p) => {
                          try { updatePolygon(p.id, { notifications: [] }); } catch {}
                        });
                      };

                      return (
                        <AlertsPanel
                          alerts={combined}
                          onRemoveAlert={handleRemove}
                          onClearAll={handleClearAll}
                        />
                      );
                    })()}
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

                    {/* Plot drawer + coordinate import — kept inside settings as before */}
                    <div className="p-4 bg-muted/50 border rounded-md">
                      <PlotDrawer
                        isDrawing={isDrawingPlot}
                        onToggleDrawing={onToggleDrawingPlot}
                        onClearPlot={onClearPlot}
                        onSavePlot={handleOpenSaveForm}
                        pointsCount={plotPointsCount}
                      />

                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Demarcar por coordenadas</h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Cole um array JSON de coordenadas [lon, lat] (ex: [[-63.9,-8.76], [-63.91,-8.76], ...])
                        </p>
                        <CoordsAreaCalculator onImport={onImportPlotPoints} />
                        <div className="mt-3">
                          <LocationSearch onGoTo={onGoToLocation} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Talhões Salvos</h4>
                      <div className="space-y-2 max-h-44 overflow-auto pr-2">
                        {polygons.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Nenhum talhão salvo ainda.</div>
                        ) : (
                          polygons.map((p) => (
                            <div key={p.id} className="p-2 border rounded-md bg-background/60 flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-semibold truncate">{p.name ?? 'Talhão'}</div>
                                  {p.number !== undefined && (
                                    <div className="text-xs text-muted-foreground ml-1">#{p.number}</div>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {p.area_m2.toFixed(2)} m² · {(p.area_m2 / 10000).toFixed(4)} ha
                                </div>

                                {/* first notification preview */}
                                {p.notifications && p.notifications.length > 0 && (
                                  <div className="mt-2 text-xs flex items-center gap-2 text-muted-foreground">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <div className="truncate">{p.notifications[0].message}</div>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <button
                                  className="px-2 py-1 text-xs rounded border"
                                  onClick={() => {
                                    const w = window as any;
                                    // ensure plot is rendered / popup shown
                                    try { if (typeof w.__showSavedPlot === 'function') w.__showSavedPlot(p); } catch {}

                                    // Update parent/map state: request parent to fetch/update weather for this plot
                                    if (typeof onGoToLocation === 'function') {
                                      try { onGoToLocation(p.centroid.lat, p.centroid.lon); } catch {}
                                    }

                                    // try typical flyTo helpers (try different argument orders)
                                    try {
                                      if (typeof w.__mapFlyTo === 'function') {
                                        // common signature: (lat, lon)
                                        w.__mapFlyTo(p.centroid.lat, p.centroid.lon);
                                      } else if (typeof w.__mapFlyToLonLat === 'function') {
                                        // alternative: (lon, lat)
                                        w.__mapFlyToLonLat(p.centroid.lon, p.centroid.lat);
                                      } else if (typeof w.__mapFlyToLngLat === 'function') {
                                        w.__mapFlyToLngLat([p.centroid.lon, p.centroid.lat]);
                                      }
                                    } catch (err) { /* ignore */ }

                                    // dispatch a generic event so MapView can listen and flyTo if it prefers event-driven control
                                    try {
                                      window.dispatchEvent(new CustomEvent('semagric:flyToPlot', { detail: { lat: p.centroid.lat, lon: p.centroid.lon, id: p.id } }));
                                    } catch (e) { /* ignore */ }
                                  }}
                                >
                                  Mostrar
                                </button>

                                <button
                                  className="px-2 py-1 text-xs rounded bg-rose-500 text-white"
                                  onClick={() => {
                                    if (confirm('Remover talhão?')) {
                                      try { removePolygon(p.id); } catch {}
                                    }
                                  }}
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                </TabsContent>
              </div>
            </Tabs>

            {/* Footer: dark mode toggle */}
            <div className="p-4 border-t border-border flex items-center gap-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDarkMode(d => !d)}
                  aria-label="Alternar tema"
                  className="p-2 rounded-full bg-muted/60 hover:bg-muted/80 flex items-center justify-center"
                >
                  {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
                <div className="text-sm">
                  <div className="font-medium">{darkMode ? 'Dark' : 'Light'}</div>
                  <div className="text-xs text-muted-foreground">Tema</div>
                </div>
              </div>
            </div>
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

      {/* Save plot modal */}
      <SavePlotModal
        open={showSaveForm}
        onClose={() => { setShowSaveForm(false); setModalCoords(null); }}
        onSave={handleSavePlot}
        coords={modalCoords && modalCoords.length >= 3 ? modalCoords : null}
        defaultName={modalInitialName}
      />
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
    if (typeof onImport === 'function') {
      onImport(parsedCoords);
    }
  };

  return (
    <div>
      <textarea
        className="w-full h-24 p-2 text-sm rounded border resize-none"
        placeholder='[[lon,lat],[lon,lat],...]'
        value={coordsInput}
        onChange={(e) => setCoordsInput(e.target.value)}
      />

      {/* Buttons: responsive grid to avoid overflow */}
      <div className="mt-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button className="w-full" onClick={handleCalculate}>Calcular área</Button>
          <Button variant="ghost" className="w-full" onClick={() => { setCoordsInput(''); setArea(null); setError(null); setParsedCoords(null); }}>
            Limpar
          </Button>
          <Button
            className="w-full"
            onClick={handleImport}
            disabled={!parsedCoords}
          >
            Inserir como pontos
          </Button>
        </div>
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

// New: small component to search by lat/lon and center the map
function LocationSearch({ onGoTo }: { onGoTo?: (lat: number, lon: number) => void }) {
  const [latText, setLatText] = useState('');
  const [lonText, setLonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGo = () => {
    setError(null);
    const lat = Number(latText.replace(',', '.').trim());
    const lon = Number(lonText.replace(',', '.').trim());
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setError('Latitude e longitude devem ser números válidos.');
      return;
    }
    if (lat < -90 || lat > 90) {
      setError('Latitude fora do intervalo (-90..90).');
      return;
    }
    if (lon < -180 || lon > 180) {
      setError('Longitude fora do intervalo (-180..180).');
      return;
    }

    if (typeof onGoTo === 'function') {
      onGoTo(lat, lon);
      return;
    }
    const w = window as any;
    if (typeof w.goToMap === 'function') {
      w.goToMap(lat, lon);
      return;
    }
    if (typeof w.__mapFlyTo === 'function') {
      w.__mapFlyTo(lat, lon);
      return;
    }

    setError('Função de centralizar mapa não encontrada. Abra o console para ver instruções.');
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Procurar localização (lat / lon)</label>
      <div className="flex gap-2">
        <input
          className="w-1/2 p-2 rounded border text-sm"
          placeholder="Latitude (ex: -8.7619)"
          value={latText}
          onChange={(e) => setLatText(e.target.value)}
        />
        <input
          className="w-1/2 p-2 rounded border text-sm"
          placeholder="Longitude (ex: -63.9039)"
          value={lonText}
          onChange={(e) => setLonText(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button onClick={handleGo} className="px-3 py-1 rounded bg-primary text-white text-sm">
          Centralizar
        </button>
        <button
          onClick={() => { setLatText(''); setLonText(''); setError(null); }}
          className="px-3 py-1 rounded border text-sm"
        >
          Limpar
        </button>
      </div>
      {error && <p className="text-sm text-rose-500 mt-1">{error}</p>}
      <p className="text-xs text-muted-foreground mt-1">
        Dica: insira latitude e longitude separadas por ponto (.) ou vírgula (ex: -8.7619, -63.9039).
      </p>
    </div>
  );
}

// New: Save plot form component
function SavePlotForm({ points, onSave, onCancel }: { points: [number, number][]; onSave: (payload: any) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#ff0000');
  const [centroid, setCentroid] = useState<{ lat: number; lon: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (points.length > 0) {
      // set initial centroid based on the provided points
      const lonAvg = points.reduce((s, c) => s + c[0], 0) / points.length;
      const latAvg = points.reduce((s, c) => s + c[1], 0) / points.length;
      setCentroid({ lon: lonAvg, lat: latAvg });
    }
  }, [points]);

  const handleSubmit = () => {
    setError(null);
    if (name.trim().length === 0) {
      setError('Nome é obrigatório.');
      return;
    }
    if (typeof onSave === 'function') {
      onSave({ name, color, area_m2: 0, lat: 0, lon: 0 }); // area/centroid will be updated on the server
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Salvar Talhão</h3>

      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            className="w-full p-2 text-sm rounded border"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do talhão"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cor</label>
          <input
            type="color"
            className="w-full p-0.5 rounded"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>

        {/*
          Show computed area and centroid based on the current points.
          These values are for information only; the user can adjust them later in the settings.
        */}
        <div className="text-sm text-muted-foreground">
          <p>Área aproximada: {(polygonAreaMeters(points) ?? 0).toFixed(2)} m²</p>
          <p>Centróide: {centroid ? `${centroid.lat.toFixed(4)}, ${centroid.lon.toFixed(4)}` : 'Calculando...'}</p>
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSubmit}>Salvar Talhão</Button>
          <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

// New: Save plot modal component
function SavePlotModal({ open, onClose, onSave, coords, defaultName }: { open: boolean; onClose: () => void; onSave: (payload: any) => void; coords: [number, number][] | null; defaultName?: string }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#ff0000');
  const [area, setArea] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName ?? '');
      setColor('#ff0000');
      setError(null);

      if (coords && coords.length > 0) {
        const a = polygonAreaMeters(coords);
        setArea(a);
      } else {
        setArea(null);
      }
    }
  }, [open, coords, defaultName]);

  const handleSubmit = () => {
    setError(null);
    if (name.trim().length === 0) {
      setError('Nome é obrigatório.');
      return;
    }
    if (typeof onSave === 'function') {
      onSave({ name, color, area_m2: area ?? 0, lat: 0, lon: 0 }); // area/centroid will be updated on the server
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-background rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Salvar Talhão</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              className="w-full p-2 text-sm rounded border"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do talhão"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cor</label>
            <input
              type="color"
              className="w-full p-0.5 rounded"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>

          {/*
            Show computed area and centroid based on the current points.
            These values are for information only; the user can adjust them later in the settings.
          */}
          <div className="text-sm text-muted-foreground">
            <p>Área aproximada: {(polygonAreaMeters(coords ?? []) ?? 0).toFixed(2)} m²</p>
            <p>Centróide: {coords && coords.length > 0 ? `${coords[0][1].toFixed(4)}, ${coords[0][0].toFixed(4)}` : 'Calculando...'}</p>
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSubmit}>Salvar Talhão</Button>
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
