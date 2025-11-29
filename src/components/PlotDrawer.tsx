import React from 'react';

interface PlotDrawerProps {
  isDrawing: boolean;
  onToggleDrawing: () => void;
  onClearPlot: () => void;
  onSavePlot: () => void;
  pointsCount: number;
}

export default function PlotDrawer({
  isDrawing,
  onToggleDrawing,
  onClearPlot,
  onSavePlot,
  pointsCount
}: PlotDrawerProps) {
  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Demarcar Talhão</h3>
        {pointsCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {pointsCount} ponto{pointsCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <button
          onClick={onToggleDrawing}
          className={`w-full justify-start gap-2 inline-flex items-center px-3 py-2 rounded ${isDrawing ? 'bg-primary text-white' : 'border'}`}
        >
          {/* ícone omitido para simplicidade */}
          {isDrawing ? 'Desmarcar no mapa' : 'Marcar pontos no mapa'}
        </button>

        {pointsCount >= 3 && (
          <button
            onClick={onSavePlot}
            className="w-full bg-emerald-500 text-white px-3 py-2 rounded"
            type="button"
          >
            Finalizar talhão
          </button>
        )}

        {pointsCount > 0 && (
          <button
            onClick={onClearPlot}
            className="w-full border px-3 py-2 rounded"
            type="button"
          >
            Limpar pontos
          </button>
        )}
      </div>

      {isDrawing && (
        <p className="text-xs text-muted-foreground">
          Clique no mapa para adicionar pontos. Mínimo 3 pontos para criar o talhão.
        </p>
      )}
    </div>
  );
}
