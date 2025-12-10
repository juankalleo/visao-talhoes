import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Filter, Eye, EyeOff } from 'lucide-react';

interface SentinelFiltersProps {
  filters: {
    satellite: boolean;
    ndvi: boolean;
    ndmi: boolean;
    ndbi: boolean;
    heatmap: boolean;
  };
  opacity: {
    satellite: number;
    ndvi: number;
    ndmi: number;
    ndbi: number;
    heatmap: number;
  };
  onFilterChange: (filter: keyof SentinelFiltersProps['filters'], value: boolean) => void;
  onOpacityChange: (layer: keyof SentinelFiltersProps['opacity'], value: number) => void;
}

export default function SentinelFilters({
  filters,
  opacity,
  onFilterChange,
  onOpacityChange
}: SentinelFiltersProps) {
  const filterOptions = [
    {
      key: 'satellite' as const,
      label: '🛰️ Satélite',
      description: 'Imagem RGB en tempo real (Copernicus)',
      color: 'text-blue-500'
    },
    {
      key: 'ndvi' as const,
      label: '🌱 NDVI',
      description: 'Verde=Vegetação, Amarelo=Transição, Vermelho=Sem Veg',
      color: 'text-green-500'
    },
    {
      key: 'ndmi' as const,
      label: '💧 NDMI',
      description: 'Marrom=Seco, Ciano=Moderado, Verde=Úmido',
      color: 'text-cyan-500'
    },
    {
      key: 'ndbi' as const,
      label: '🏗️ NDBI',
      description: 'Cinza=Rural, Preto=Urbano/Construído',
      color: 'text-amber-500'
    },
    {
      key: 'heatmap' as const,
      label: '🔥 Mapa de Calor',
      description: 'Intensidade Térmica do Terreno',
      color: 'text-red-500'
    }
  ];

  return (
    <Card className="liquid-glass p-4 rounded-xl">
      <div className="flex items-center gap-2 text-sm font-medium mb-4">
        <Filter className="w-4 h-4 text-primary" />
        <span>Filtros de Visualização</span>
      </div>

      <div className="space-y-4">
        {filterOptions.map((option) => (
          <div key={option.key} className="space-y-3 pb-3 border-b border-border last:border-0 last:pb-0">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 flex-1`}>
                  <span className={option.color}>{option.label.split(' ')[0]}</span>
                  <div className="flex-1">
                    <label className="text-sm font-medium cursor-pointer">
                      {option.label.substring(2)}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              </div>
              <Switch
                checked={filters[option.key]}
                onCheckedChange={(checked) => onFilterChange(option.key, checked)}
              />
            </div>

            {/* Opacity Slider */}
            {filters[option.key] && (
              <div className="flex items-center gap-3 px-2">
                <EyeOff className="w-3 h-3 text-muted-foreground" />
                <Slider
                  value={[opacity[option.key] * 100]}
                  onValueChange={(value) => onOpacityChange(option.key, value[0] / 100)}
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <Eye className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-semibold min-w-[30px]">
                  {Math.round(opacity[option.key] * 100)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground pt-3 border-t border-border mt-3">
        💡 Dica: Use múltiplos filtros para comparações visuais
      </p>
    </Card>
  );
}
