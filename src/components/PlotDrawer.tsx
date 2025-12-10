import React from 'react';
import { Pen, Trash2, Check, MapPin } from 'lucide-react';

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
    <div className="liquid-glass p-4 space-y-4 rounded-xl border border-primary/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Demarcar Talhão</h3>
        </div>
        {pointsCount > 0 && (
          <span className="text-xs font-medium bg-primary/20 text-primary px-2 py-1 rounded-full">
            {pointsCount} ponto{pointsCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <button
          onClick={onToggleDrawing}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
            isDrawing
              ? 'bg-primary text-white shadow-lg'
              : 'bg-muted hover:bg-muted/80 border border-border'
          }`}
        >
          <Pen className="w-4 h-4" />
          {isDrawing ? 'Desmarcar no mapa' : 'Marcar pontos no mapa'}
        </button>

        {pointsCount >= 3 && (
          <button
            onClick={onSavePlot}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-md"
            type="button"
          >
            <Check className="w-4 h-4" />
            Finalizar talhão
          </button>
        )}

        {pointsCount > 0 && (
          <button
            onClick={onClearPlot}
            className="w-full border border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2"
            type="button"
          >
            <Trash2 className="w-4 h-4" />
            Limpar pontos
          </button>
        )}
      </div>

      {isDrawing && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 Clique no mapa para adicionar pontos. Mínimo 3 pontos para criar o talhão.
          </p>
        </div>
      )}
    </div>
  );
}
