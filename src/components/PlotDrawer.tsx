import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Save } from 'lucide-react';

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
        <Button
          onClick={onToggleDrawing}
          variant={isDrawing ? "default" : "outline"}
          className="w-full justify-start gap-2"
          size="sm"
        >
          <Pencil className="h-4 w-4" />
          {isDrawing ? 'Desmarcar no mapa' : 'Marcar pontos no mapa'}
        </Button>

        {pointsCount >= 3 && (
          <Button
            onClick={onSavePlot}
            variant="outline"
            className="w-full justify-start gap-2"
            size="sm"
          >
            <Save className="h-4 w-4" />
            Finalizar talhão
          </Button>
        )}

        {pointsCount > 0 && (
          <Button
            onClick={onClearPlot}
            variant="outline"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            size="sm"
          >
            <Trash2 className="h-4 w-4" />
            Limpar pontos
          </Button>
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
