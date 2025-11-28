import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Layers } from 'lucide-react';

interface LayerToggleProps {
  layers: {
    rain: boolean;
    wind: boolean;
    temperature: boolean;
    clouds: boolean;
  };
  onLayerChange: (layer: keyof LayerToggleProps['layers'], value: boolean) => void;
  showHeatmap: boolean;
  onHeatmapChange: (value: boolean) => void;
}

export default function LayerToggle({ 
  layers, 
  onLayerChange,
  showHeatmap,
  onHeatmapChange
}: LayerToggleProps) {
  const layerConfig = [
    { key: 'temperature' as const, label: 'Temperatura' },
    { key: 'rain' as const, label: 'Chuva' },
    { key: 'wind' as const, label: 'Vento' },
    { key: 'clouds' as const, label: 'Nuvens' }
  ];

  return (
    <Card className="glass p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="w-4 h-4" />
          <span>Camadas do Mapa</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="heatmap" className="text-sm font-normal cursor-pointer">
              Mapa de Calor
            </Label>
            <Switch
              id="heatmap"
              checked={showHeatmap}
              onCheckedChange={onHeatmapChange}
            />
          </div>

          {layerConfig.map((layer) => (
            <div key={layer.key} className="flex items-center justify-between">
              <Label 
                htmlFor={layer.key} 
                className="text-sm font-normal cursor-pointer text-muted-foreground"
              >
                {layer.label}
              </Label>
              <Switch
                id={layer.key}
                checked={layers[layer.key]}
                onCheckedChange={(value) => onLayerChange(layer.key, value)}
                disabled
              />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          * Camadas adicionais em breve
        </p>
      </div>
    </Card>
  );
}
