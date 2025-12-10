import { Card } from '@/components/ui/card';
import { Satellite, TrendingUp } from 'lucide-react';
import { Sentinel2Data, Sentinel2StatisticsResponse, getNDVIHealthStatus } from '@/lib/sentinel2-api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Sentinel2PanelProps {
  data: Sentinel2Data | null;
  stats?: Sentinel2StatisticsResponse | null;
  loading?: boolean;
}

export default function Sentinel2Panel({ data, stats, loading = false }: Sentinel2PanelProps) {
  if (loading) {
    return (
      <Card className="liquid-glass p-4 rounded-xl">
        <div className="flex items-center gap-2 text-sm font-medium mb-4">
          <Satellite className="w-4 h-4 text-primary" />
          <span>Sentinel-2 NDVI</span>
        </div>
        <div className="text-sm text-muted-foreground">Carregando dados do satélite...</div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="liquid-glass p-4 rounded-xl">
        <div className="flex items-center gap-2 text-sm font-medium mb-4">
          <Satellite className="w-4 h-4 text-primary" />
          <span>Sentinel-2 NDVI</span>
        </div>
        <div className="text-sm text-muted-foreground">Dados não disponíveis</div>
      </Card>
    );
  }

  const healthStatus = getNDVIHealthStatus(data.ndvi);

  return (
    <Card className="liquid-glass p-4 rounded-xl">
      <div className="flex items-center gap-2 text-sm font-medium mb-4">
        <Satellite className="w-4 h-4 text-primary" />
        <span>Sentinel-2 NDVI (Real Time)</span>
      </div>

      <div className="space-y-4">
        {/* NDVI Health Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-normal text-muted-foreground">Status de Saúde</label>
            <span className="text-sm font-semibold">{healthStatus.status}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${healthStatus.percentage}%`,
                backgroundColor: healthStatus.color,
              }}
            />
          </div>
        </div>

        {/* NDVI Value */}
        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
          <span className="text-xs text-muted-foreground">Índice NDVI</span>
          <span className="text-lg font-bold">
            {data.ndvi !== null ? data.ndvi.toFixed(3) : 'N/A'}
          </span>
        </div>

        {/* Cloud Cover */}
        {data.cloudCover !== undefined && (
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
            <span className="text-xs text-muted-foreground">Cobertura de Nuvens</span>
            <span className="text-sm font-semibold">{data.cloudCover.toFixed(1)}%</span>
          </div>
        )}

        {/* Acquisition Date */}
        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
          <span className="text-xs text-muted-foreground">Data da Aquisição</span>
          <span className="text-xs font-semibold">
            {format(new Date(data.acquisitionDate), 'dd/MM/yyyy', { locale: ptBR })}
          </span>
        </div>

        {/* NDMI */}
        {data.ndmi !== null && (
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
            <span className="text-xs text-muted-foreground">NDMI (Umidade)</span>
            <span className="text-sm font-semibold">{data.ndmi.toFixed(3)}</span>
          </div>
        )}

        {/* Statistics (if available) */}
        {stats && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Estatísticas da Área</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Média:</span>
                <span className="font-semibold">{stats.mean.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mediana:</span>
                <span className="font-semibold">{stats.median.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desvio Padrão:</span>
                <span className="font-semibold">{stats.std.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min - Max:</span>
                <span className="font-semibold">
                  {stats.min.toFixed(3)} - {stats.max.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Data Source */}
        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          🛰️ {data.dataSource}
        </p>
      </div>
    </Card>
  );
}
