import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, Clock } from 'lucide-react';
import { PollingInterval } from '@/hooks/usePolling';

interface IntervalSelectorProps {
  interval: PollingInterval;
  onIntervalChange: (interval: PollingInterval) => void;
  onRefresh: () => void;
  isPolling: boolean;
}

export default function IntervalSelector({
  interval,
  onIntervalChange,
  onRefresh,
  isPolling
}: IntervalSelectorProps) {
  const intervals: { value: PollingInterval; label: string }[] = [
    { value: 5000, label: '5s' },
    { value: 30000, label: '30s' },
    { value: 60000, label: '60s' },
    { value: null, label: 'Manual' }
  ];

  return (
    <Card className="liquid-glass p-4 rounded-xl">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="w-4 h-4 text-primary" />
          <span>Intervalo de Atualização</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {intervals.map((item) => (
            <Button
              key={item.label}
              variant={interval === item.value ? 'default' : 'secondary'}
              size="sm"
              onClick={() => onIntervalChange(item.value)}
              className="text-xs"
            >
              {item.label}
            </Button>
          ))}
        </div>

        <Button
          onClick={onRefresh}
          className="w-full"
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
          Atualizar Agora
        </Button>
      </div>
    </Card>
  );
}
