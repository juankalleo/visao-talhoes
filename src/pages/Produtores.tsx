import React, { useState, useEffect, useMemo, useRef } from "react";
import usePolygons from "../hooks/usePolygons";
import { useWeather } from "../hooks/useWeather";
import "./Produtores.css";

function generateHistoryFromNow(base: number | undefined, points = 24, variance = 2) {
  const b = typeof base === "number" ? base : 20;
  const now = Date.now();
  const step = 60 * 60 * 1000; // 1 hour
  return new Array(points).fill(0).map((_, i) => ({
    ts: now - (points - 1 - i) * step,
    value: +(b + (Math.sin(i / 3) * variance) + (Math.random() - 0.5) * variance).toFixed(2),
  }));
}

function Sparkline({ data, color = "#0b5cff", height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length === 0) return null;
  const w = 200;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  const area = `M0,${h} L${points} L${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="sparkline">
      <path d={area} fill={color} fillOpacity={0.08} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function generateForecast(currentTemp: number | undefined, currentHumidity: number | undefined, days = 7) {
  const baseT = typeof currentTemp === "number" ? currentTemp : 22;
  const baseH = typeof currentHumidity === "number" ? currentHumidity : 60;
  return new Array(days).fill(0).map((_, i) => {
    const dayOffset = i;
    const max = +(baseT + Math.round(Math.sin(i + 1) * 3 + Math.random() * 3)).toFixed(1);
    const min = +(max - (2 + Math.random() * 4)).toFixed(1);
    const rainProb = Math.max(0, Math.min(100, Math.round(baseH / 2 + Math.random() * 50 - i * 3)));
    return {
      date: Date.now() + dayOffset * 24 * 60 * 60 * 1000,
      max,
      min,
      rainProb,
    };
  });
}

function dayLabel(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export default function Produtores() {
  const { polygons } = usePolygons();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPlot = useMemo(() => polygons.find((p) => p.id === selectedId) ?? null, [polygons, selectedId]);

  const { weather, loading, fetchWeather } = useWeather();

  // derive priority helper (returns key + label)
  const derivePriority = (n: any): { key: 'alta' | 'medio' | 'baixa'; label: string } => {
    if (!n) return { key: 'baixa', label: 'Baixa' };
    const raw = (n.priority || n.level || n.severity || n.type || '').toString().toLowerCase();
    if (typeof n.severity === 'number') {
      if (n.severity >= 7) return { key: 'alta', label: 'Alta' };
      if (n.severity >= 4) return { key: 'medio', label: 'Médio' };
      return { key: 'baixa', label: 'Baixa' };
    }
    if (raw.includes('high') || raw.includes('alta') || raw.includes('critical') || raw.includes('urgent')) return { key: 'alta', label: 'Alta' };
    if (raw.includes('med') || raw.includes('médio') || raw.includes('moderate') || raw.includes('medium')) return { key: 'medio', label: 'Médio' };
    return { key: 'baixa', label: 'Baixa' };
  };

  // polling state: null = off, otherwise milliseconds
  const [pollIntervalMs, setPollIntervalMs] = useState<number | null>(null);
  const pollRef = useRef<number | null>(null);
  
  // local dark mode just for this page (doesn't touch global document classes)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem("produtores:theme") === "dark"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("produtores:theme", darkMode ? "dark" : "light"); } catch {}
  }, [darkMode]);

  useEffect(() => {
    if (!selectedId && polygons.length > 0) setSelectedId(polygons[0].id);
  }, [polygons, selectedId]);

  useEffect(() => {
    if (selectedPlot) {
      fetchWeather(selectedPlot.centroid.lat, selectedPlot.centroid.lon).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlot?.id]);

  // polling effect: when pollIntervalMs changes, (re)start polling for selectedPlot
  useEffect(() => {
    // clear existing
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (pollIntervalMs && selectedPlot) {
      // immediate fetch then schedule
      fetchWeather(selectedPlot.centroid.lat, selectedPlot.centroid.lon).catch(() => {});
      const id = window.setInterval(() => {
        try {
          fetchWeather(selectedPlot.centroid.lat, selectedPlot.centroid.lon).catch(() => {});
        } catch {}
      }, pollIntervalMs);
      pollRef.current = id;
    }

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pollIntervalMs, selectedPlot?.id]);

  // helper to set interval via select value
  const handleSetInterval = (v: string) => {
    if (v === "off") setPollIntervalMs(null);
    else setPollIntervalMs(Number(v));
  };

  const tempHistory = useMemo(() => generateHistoryFromNow((weather as any)?.temperature, 24, 3).map((d) => d.value), [weather]);
  const humHistory = useMemo(() => generateHistoryFromNow((weather as any)?.humidity, 24, 6).map((d) => d.value), [weather]);

  const forecast = useMemo(() => generateForecast((weather as any)?.temperature, (weather as any)?.humidity, 7), [weather]);

  return (
    <div className={`prod-page ${darkMode ? "dark" : ""}`}>
      <aside className="prod-aside">
        <div className="prod-aside-header">
          <h2>Produtores — Talhões</h2>
          <div className="muted">Total: {polygons.length}</div>
        </div>

        <div className="prod-list">
          {polygons.length === 0 && <div className="muted">Nenhum talhão salvo</div>}
          {polygons.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              className={`prod-item ${selectedId === p.id ? "selected" : ""}`}
              onClick={() => setSelectedId(p.id)}
              onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(p.id); }}
            >
              <div className="prod-item-left">
                <div className="prod-name">{p.name ?? "Sem nome"}</div>
                <div className="prod-meta">
                  {(p.area_m2 ?? 0).toFixed(0)} m² · {(p.area_m2 ?? 0) / 10000 >= 0 ? ((p.area_m2 ?? 0) / 10000).toFixed(3) : "0.000"} ha
                </div>
              </div>

              <div className="prod-item-right">
                <div className="small muted">{p.centroid.lat.toFixed(4)}</div>
                <div className="small muted">{p.centroid.lon.toFixed(4)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="prod-aside-footer">
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button" onClick={() => { setSelectedId(polygons.length ? polygons[0].id : null); }}>
              Selecionar primeiro
            </button>
            <button
              className="button"
              onClick={() => setDarkMode((d) => !d)}
              title="Alternar tema (apenas nesta página)"
            >
              {darkMode ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </aside>

      <main className="prod-main">
        {!selectedPlot ? (
          <div className="empty">Selecione um talhão à esquerda para ver estatísticas</div>
        ) : (
          <>
            <header className="prod-main-header">
              <div>
                <h3 className="prod-title">{selectedPlot.name ?? "Talhão"}</h3>
                <div className="muted">Criado: {new Date(selectedPlot.createdAt).toLocaleString()}</div>
              </div>

              <div className="prod-controls">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="button btn-primary" onClick={() => fetchWeather(selectedPlot.centroid.lat, selectedPlot.centroid.lon)}>
                    {loading ? "Atualizando..." : "Atualizar dados climáticos"}
                  </button>

                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                    <span className="muted small">Auto-refresh</span>
                    <select
                      value={pollIntervalMs ?? "off"}
                      onChange={(e) => handleSetInterval(e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)" }}
                    >
                      <option value="off">Off</option>
                      <option value="15000">15s</option>
                      <option value="30000">30s</option>
                      <option value="60000">1m</option>
                    </select>
                  </label>
                </div>
              </div>
            </header>

            <section className="prod-grid">
              <div className="card">
                <h4>Resumo</h4>
                <p>ID: {selectedPlot.id}</p>
                <p>Área: {(selectedPlot.area_m2 ?? 0).toFixed(2)} m²</p>
                <p>Hectares: {((selectedPlot.area_m2 ?? 0) / 10000).toFixed(4)} ha</p>
                <p>Centro: {selectedPlot.centroid.lat.toFixed(6)}, {selectedPlot.centroid.lon.toFixed(6)}</p>
              </div>

              <div className="card">
                <h4>Clima atual</h4>
                {weather ? (
                  <>
                    <div className="stat-row">
                      <div>
                        <div className="stat-value">{typeof (weather as any).temperature === "number" ? `${(weather as any).temperature.toFixed(1)} °C` : "-"}</div>
                        <div className="muted small">Temperatura</div>
                      </div>
                      <div>
                        <div className="stat-value">{typeof (weather as any).humidity === "number" ? `${(weather as any).humidity}%` : "-"}</div>
                        <div className="muted small">Umidade</div>
                      </div>
                      <div>
                        <div className="stat-value">{typeof (weather as any).windSpeed === "number" ? `${(weather as any).windSpeed} m/s` : "-"}</div>
                        <div className="muted small">Vento</div>
                      </div>
                    </div>

                    <div className="sparkline-row">
                      <div>
                        <div className="muted small">Últimas 24h — Temperatura</div>
                        <Sparkline data={tempHistory} color="#ef4444" height={48} />
                      </div>
                      <div>
                        <div className="muted small">Últimas 24h — Umidade</div>
                        <Sparkline data={humHistory} color="#0b5cff" height={48} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="muted">Nenhum dado climático carregado.</div>
                )}
              </div>

              <div className="card">
                <h4>Notificações / Estatísticas</h4>
                <p>Número de notificações: {selectedPlot.notifications?.length ?? 0}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="color-swatch" style={{ background: selectedPlot.color ?? "#22c55e" }} />
                    <div className="muted small">Cor do talhão</div>
                  </div>

                  {/* aggregated priority (highest among notifications) */}
                  <div>
                    {(() => {
                      const nots = selectedPlot.notifications ?? [];
                      const highest = nots.reduce<{ key: string; rank: number } | null>((acc, ni) => {
                        const p = derivePriority(ni);
                        const rank = p.key === 'alta' ? 3 : p.key === 'medio' ? 2 : 1;
                        if (!acc || rank > acc.rank) return { key: p.key, rank };
                        return acc;
                      }, null);
                      const label = highest ? (highest.key === 'alta' ? 'Alta' : highest.key === 'medio' ? 'Médio' : 'Baixa') : 'Baixa';
                      const cls = highest ? `priority-${highest.key}` : 'priority-baixa';
                      return <span className={`priority-badge ${cls}`}>{label}</span>;
                    })()}
                  </div>
                </div>

                {/* list notifications with description and priority */}
                {Array.isArray(selectedPlot.notifications) && selectedPlot.notifications.length > 0 && (
                  <div className="notif-list" style={{ marginTop: 12 }}>
                    {selectedPlot.notifications.map((n: any, i: number) => {
                      const p = derivePriority(n);
                      const desc = n.description || n.message || n.title || "Sem descrição";
                      return (
                        <div className="notif-item" key={i}>
                          <div style={{ minWidth: 88 }}>
                            <span className={`priority-badge priority-${p.key}`}>{p.label}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14 }}>{desc}</div>
                            <div className="muted small" style={{ marginTop: 4 }}>
                              {n.timestamp ? new Date(n.timestamp).toLocaleString() : (n.date ? new Date(n.date).toLocaleString() : '')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="card">
                <h4>Histórico simplificado</h4>
                <div className="muted small">Exemplo de média diária (últimos 7 dias)</div>
                <div className="hist-bars">
                  {new Array(7).fill(0).map((_, i) => {
                    const v = 18 + Math.round(Math.sin(i + 1) * 3 + Math.random() * 2);
                    return <div key={i} className="hist-bar" title={`${v} °C`} style={{ height: `${40 + v * 2}px` }} />;
                  })}
                </div>
              </div>

              {/* Forecast card spans full width visually (grid handles responsive) */}
              <div className="card forecast-card" style={{ gridColumn: "1 / -1" }}>
                <h4>Previsão (7 dias) — Calor & Chuva</h4>
                <div className="forecast-grid">
                  {forecast.map((f) => {
                    const rainClass = f.rainProb >= 60 ? "rain-high" : (f.rainProb >= 30 ? "rain-med" : "rain-low");
                    return (
                      <div key={f.date} className={`forecast-item ${rainClass}`}>
                        <div className="forecast-day">{dayLabel(f.date)}</div>
                        <div className="forecast-temps">
                          <span className="forecast-max">{f.max}°</span>
                          <span className="forecast-min">{f.min}°</span>
                        </div>
                        <div className="forecast-rain">{f.rainProb}% ☔</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}