import { Card } from '@/components/ui/card';
import { Leaf } from 'lucide-react';
import { RemoteSensingData, interpretNDVI, interpretNDMI, getNDVIColor, getNDMIColor } from '@/lib/remote-sensing-api';

interface RemoteSensingPanelProps {
  data: RemoteSensingData | null;
  loading?: boolean;
}

export default function RemoteSensingPanel({ data, loading = false }: RemoteSensingPanelProps) {
  if (loading) {
    return (
      <Card className="liquid-glass p-4 rounded-xl">
        <div className="flex items-center gap-2 text-sm font-medium mb-4">
          <Leaf className="w-4 h-4 text-primary" />
          <span>Índices de Sensoriamento</span>
        </div>
        <div className="text-sm text-muted-foreground">Carregando dados...</div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="liquid-glass p-4 rounded-xl">
        <div className="flex items-center gap-2 text-sm font-medium mb-4">
          <Leaf className="w-4 h-4 text-primary" />
          <span>Índices de Sensoriamento</span>
        </div>
        <div className="text-sm text-muted-foreground">Dados não disponíveis</div>
      </Card>
    );
  }

  return (
    <Card className="liquid-glass p-4 rounded-xl">
      <div className="flex items-center gap-2 text-sm font-medium mb-4">
        <Leaf className="w-4 h-4 text-primary" />
        <span>Índices de Sensoriamento</span>
      </div>

      <div className="space-y-3">
        {/* NDVI */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-normal text-muted-foreground">NDVI (Vegetação)</label>
            <span className="text-sm font-semibold">
              {data.ndvi !== null ? data.ndvi.toFixed(3) : 'N/A'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: data.ndvi !== null ? `${Math.max(0, Math.min(100, (data.ndvi + 1) * 50))}%` : '0%',
                backgroundColor: getNDVIColor(data.ndvi)
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {interpretNDVI(data.ndvi)}
          </p>
        </div>

        {/* NDMI */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-normal text-muted-foreground">NDMI (Umidade)</label>
            <span className="text-sm font-semibold">
              {data.ndmi !== null ? data.ndmi.toFixed(3) : 'N/A'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: data.ndmi !== null ? `${Math.max(0, Math.min(100, (data.ndmi + 1) * 50))}%` : '0%',
                backgroundColor: getNDMIColor(data.ndmi)
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {interpretNDMI(data.ndmi)}
          </p>
        </div>

        {/* Data source */}
        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          Fonte: {data.dataSource}
        </p>
      </div>
    </Card>
  );
}
