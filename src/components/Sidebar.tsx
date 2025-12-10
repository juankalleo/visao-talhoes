import React, { useState, useEffect } from "react";
import usePolygons, { SavedPlot } from '@/hooks/usePolygons';
import { polygonAreaMeters } from '@/lib/utils';
import { createPlotOnServer } from '@/lib/plots-api';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Menu, 
  X, 
  CloudSun,
  Sun,
  Moon,
  Leaf
} from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import IntervalSelector from './IntervalSelector';
import LayerToggle from './LayerToggle';
import PlotDrawer from './PlotDrawer';
import RemoteSensingPanel from './RemoteSensingPanel';
import Sentinel2Panel from './Sentinel2Panel';
import SentinelFilters from './SentinelFilters';
import { WeatherData } from '@/lib/weather-api';
import { RemoteSensingData } from '@/lib/remote-sensing-api';
import { Sentinel2Data } from '@/lib/sentinel2-api';
import { PollingInterval } from '@/hooks/usePolling';

interface SidebarProps {
  weather: WeatherData | null;
  loading: boolean;
  remoteSensingData?: RemoteSensingData | null;
  sentinel2Data?: Sentinel2Data | null;
  interval: PollingInterval;
  onIntervalChange: (interval: PollingInterval) => void;
  onRefresh: () => void;
  isPolling: boolean;
  layers: {
    rain: boolean;
    wind: boolean;
    temperature: boolean;
    clouds: boolean;
    ndvi: boolean;
    ndmi: boolean;
  };
  onLayerChange: (layer: keyof SidebarProps['layers'], value: boolean) => void;

  // sentinel filters and opacity control
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
  onSentinelFilterChange?: (filter: keyof NonNullable<SidebarProps['sentinelFilters']>, value: boolean) => void;
  onSentinelOpacityChange?: (layer: keyof NonNullable<SidebarProps['sentinelOpacity']>, value: number) => void;

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
  // allow optional plotId so Sidebar can pass which plot triggered the request
  onGoToLocation?: (lat: number, lon: number, plotId?: string) => void;

  plotPoints?: [number, number][]; // added: current drawing points (lon, lat)

  // id do talhão atualmente selecionado (para destacar / mostrar loading)
  selectedPlotId?: string;
}

export default function Sidebar({
  weather,
  loading,
  remoteSensingData,
  sentinel2Data,
  interval,
  onIntervalChange,
  onRefresh,
  isPolling,
  layers,
  onLayerChange,
  sentinelFilters,
  sentinelOpacity,
  onSentinelFilterChange,
  onSentinelOpacityChange,
  showHeatmap,
  onHeatmapChange,
  isDrawingPlot,
  onToggleDrawingPlot,
  onClearPlot,
  plotPointsCount,
  onImportPlotPoints,
  onGoToLocation,
  plotPoints = [],
  selectedPlotId,
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
  const [activeTab, setActiveTab] = useState<string>('settings');
  const [showCoordsInput, setShowCoordsInput] = useState<boolean>(false);
  const [showLocationSearch, setShowLocationSearch] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showSentinel2, setShowSentinel2] = useState<boolean>(false);
  const [showRemoteSensing, setShowRemoteSensing] = useState<boolean>(false);
  const [showInterval, setShowInterval] = useState<boolean>(false);
  const [showSavedPlots, setShowSavedPlots] = useState<boolean>(false);

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

  
  return (
    <>
      {/* Toggle button - attached to sidebar */}
      <motion.button
        aria-label={isOpen ? 'Fechar sidebar' : 'Abrir sidebar'}
        onClick={() => setIsOpen(v => !v)}
        animate={{ left: isOpen ? '320px' : '0px' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-10 h-10 rounded-r-lg shadow-lg bg-primary text-white hover:bg-primary/90 transition-all"
      >
        {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </motion.button>

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
            <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                    <Leaf className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">SEMAGRIC</h1>
                    <span className="text-xs font-medium text-primary">Talhões</span>
                  </div>
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
              <p className="text-xs font-medium text-muted-foreground bg-primary/10 px-3 py-2 rounded-lg">
                Monitoramento de talhões em tempo real
              </p>
            </div>

            {/* Tabs: apenas Config */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                  <div className="h-full overflow-y-auto hide-scrollbar p-4 space-y-4">
                    {/* Plot drawer - first section */}
                    <div className="p-4 bg-muted/50 border rounded-md">
                      <PlotDrawer
                        isDrawing={isDrawingPlot}
                        onToggleDrawing={onToggleDrawingPlot}
                        onClearPlot={onClearPlot}
                        onSavePlot={handleOpenSaveForm}
                        pointsCount={plotPointsCount}
                      />
                    </div>

                    {/* Talhões Salvos - Button with Collapse */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowSavedPlots(!showSavedPlots)}
                        className="w-full px-4 py-2 rounded-lg font-medium text-sm transition-all bg-primary text-white shadow-md hover:shadow-lg flex items-center justify-between"
                      >
                        <span>Talhões Salvos {polygons.length > 0 && `(${polygons.length})`}</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${showSavedPlots ? 'rotate-90' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showSavedPlots && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-2 max-h-52 overflow-auto pr-2">
                              {polygons.length === 0 ? (
                                <div className="text-xs text-muted-foreground p-3 text-center bg-muted/30 rounded-lg">
                                  Nenhum talhão salvo ainda.
                                </div>
                              ) : (
                                polygons.map((p) => (
                                  <div key={p.id} className="p-3 border border-primary/20 rounded-lg bg-gradient-to-br from-primary/5 to-primary/0 hover:border-primary/40 transition-all">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <div 
                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: p.color || '#10b981' }}
                                          ></div>
                                          <div className="text-sm font-semibold truncate text-foreground">{p.name ?? 'Talhão'}</div>
                                          {p.number !== undefined && (
                                            <div className="text-xs text-muted-foreground">#{p.number}</div>
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground ml-3">
                                          {p.area_m2.toFixed(2)} m² · {(p.area_m2 / 10000).toFixed(4)} ha
                                        </div>
                                        
                                        <div className="text-xs text-muted-foreground ml-3 mt-1">
                                          📍 {p.centroid.lat.toFixed(4)}°, {p.centroid.lon.toFixed(4)}°
                                        </div>

                                        {/* first notification preview */}
                                        {p.notifications && p.notifications.length > 0 && (
                                          <div className="mt-2 text-xs flex items-center gap-2 text-amber-600 dark:text-amber-400 ml-3">
                                            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                            <div className="truncate">{p.notifications[0].message}</div>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <button
                                          className="px-2 py-1 text-xs rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-medium"
                                          onClick={() => {
                                            const w = window as any;
                                            // ensure plot is rendered / popup shown
                                            try { if (typeof w.__showSavedPlot === 'function') w.__showSavedPlot(p); } catch {}

                                            // Update parent/map state: request parent to fetch/update weather for this plot
                                            if (typeof onGoToLocation === 'function') {
                                              try { onGoToLocation(p.centroid.lat, p.centroid.lon, p.id); } catch {}
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
                                          Ver
                                        </button>

                                        <button
                                          className="px-2 py-1 text-xs rounded-md bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 transition-colors font-medium"
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
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Filtros de Visualização - Button with Collapse */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full px-4 py-2 rounded-lg font-medium text-sm transition-all bg-primary text-white shadow-md hover:shadow-lg flex items-center justify-between"
                      >
                        <span>Filtros de Visualização</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-90' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showFilters && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            {sentinelFilters && onSentinelFilterChange && onSentinelOpacityChange && (
                              <SentinelFilters
                                filters={sentinelFilters}
                                opacity={sentinelOpacity || {
                                  satellite: 0.85,
                                  ndvi: 0.75,
                                  ndmi: 0.75,
                                  ndbi: 0.75,
                                  heatmap: 0.7
                                }}
                                onFilterChange={(filter, value) => {
                                  onSentinelFilterChange(filter, value);
                                }}
                                onOpacityChange={(layer, value) => {
                                  onSentinelOpacityChange(layer, value);
                                }}
                              />
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Intervalo de Atualização - Button with Collapse */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowInterval(!showInterval)}
                        className="w-full px-4 py-2 rounded-lg font-medium text-sm transition-all bg-primary text-white shadow-md hover:shadow-lg flex items-center justify-between"
                      >
                        <span>Intervalo de Atualização</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${showInterval ? 'rotate-90' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showInterval && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 bg-muted/50 border rounded-md">
                              <IntervalSelector
                                interval={interval}
                                onIntervalChange={onIntervalChange}
                                onRefresh={onRefresh}
                                isPolling={isPolling}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Índices de Sensoriamento - Button with Collapse */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowRemoteSensing(!showRemoteSensing)}
                        className="w-full px-4 py-2 rounded-lg font-medium text-sm transition-all bg-primary text-white shadow-md hover:shadow-lg flex items-center justify-between"
                      >
                        <span>Índices de Sensoriamento</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${showRemoteSensing ? 'rotate-90' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showRemoteSensing && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <RemoteSensingPanel
                              data={remoteSensingData || null}
                              loading={loading}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Sentinel-2 NDVI (Real Time) - Button with Collapse */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowSentinel2(!showSentinel2)}
                        className="w-full px-4 py-2 rounded-lg font-medium text-sm transition-all bg-primary text-white shadow-md hover:shadow-lg flex items-center justify-between"
                      >
                        <span>Sentinel-2 NDVI</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${showSentinel2 ? 'rotate-90' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showSentinel2 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <Sentinel2Panel
                              data={sentinel2Data || null}
                              loading={loading}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Demarcar por coordenadas - Button with Collapse */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowCoordsInput(!showCoordsInput)}
                        className="w-full px-4 py-2 rounded-lg font-medium text-sm transition-all bg-primary text-white shadow-md hover:shadow-lg flex items-center justify-between"
                      >
                        <span>Demarcar por Coordenadas</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${showCoordsInput ? 'rotate-90' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showCoordsInput && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 bg-muted/50 border rounded-md">
                              <p className="text-xs text-muted-foreground mb-2">
                                Cole um array JSON de coordenadas [lon, lat] (ex: [[-63.9,-8.76], [-63.91,-8.76], ...])
                              </p>
                              <CoordsAreaCalculator onImport={onImportPlotPoints} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Procurar localização - Button with Collapse */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowLocationSearch(!showLocationSearch)}
                        className="w-full px-4 py-2 rounded-lg font-medium text-sm transition-all bg-primary text-white shadow-md hover:shadow-lg flex items-center justify-between"
                      >
                        <span>Procurar Localização</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${showLocationSearch ? 'rotate-90' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showLocationSearch && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 bg-muted/50 border rounded-md">
                              <LocationSearch onGoTo={onGoToLocation} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>
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

// New: Save plot modal component
function SavePlotModal({
  open,
  onClose,
  onSave,
  coords,
  defaultName
}: {
  open: boolean;
  onClose: () => void;
  onSave: (val: { name?: string; area_m2: number; lat: number; lon: number; color: string }) => void;
  coords: [number, number][] | null;
  defaultName?: string;
}) {
  const [name, setName] = useState('');
  const [area, setArea] = useState<number>(0);
  const [lat, setLat] = useState<string>('');
  const [lon, setLon] = useState<string>('');
  const [color, setColor] = useState<string>('#22c55e');
  const [opacity, setOpacity] = useState<number>(0.45);

  useEffect(() => {
    if (!open) return;
    if (defaultName) setName(defaultName);
    if (!coords || coords.length === 0) return;
    const a = polygonAreaMeters(coords);
    setArea(Math.round(a * 100) / 100); // keep two decimals
    const lonAvg = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const latAvg = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    setLat(String(latAvg));
    setLon(String(lonAvg));
  }, [open, coords, defaultName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 rounded-2xl shadow-xl border border-border">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Salvar Talhão</h3>
              <p className="text-xs text-muted-foreground mt-1">Revise e salve as informações do talhão.</p>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="ml-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Nome do talhão</label>
              <input
                className="w-full p-2 text-sm rounded border border-border bg-white/60 dark:bg-slate-800 text-black dark:text-white"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do talhão"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Área (m²)</label>
                <input
                  type="number"
                  className="w-full p-2 rounded-md border border-border bg-white/60 dark:bg-slate-800 text-black dark:text-white"
                  value={area}
                  onChange={(e) => setArea(Number(e.target.value))}
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--muted, #6b7280)' }}
                >
                  Hectares: {((area ?? 0) / 10000).toFixed(4)} ha
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Cor do talhão</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 p-0 border-0 bg-transparent cursor-pointer"
                    aria-label="Cor do talhão"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-2">Opacidade: {(opacity * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Transparente</span>
                <span>Opaco</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Latitude (centro)</label>
                <input
                  className="w-full p-2 rounded-md border border-border bg-white/60 dark:bg-slate-800 text-black dark:text-white"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Longitude (centro)</label>
                <input
                  className="w-full p-2 rounded-md border border-border bg-white/60 dark:bg-slate-800 text-black dark:text-white"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button className="px-4 py-2 rounded-md border text-sm" onClick={onClose}>Cancelar</button>
            <button
              className="px-4 py-2 rounded-md bg-primary text-white text-sm"
              onClick={() => {
                const latN = Number(String(lat).replace(',', '.'));
                const lonN = Number(String(lon).replace(',', '.'));
                onSave({ name, area_m2: Math.max(0, Number(area)), lat: latN, lon: lonN, color });
              }}
            >
              Salvar talhão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
