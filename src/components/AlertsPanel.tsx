import { motion, AnimatePresence } from 'framer-motion';
import { WeatherAlert, getAlertColor } from '@/lib/weather-api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AlertsPanelProps {
  alerts: WeatherAlert[];
  onRemoveAlert: (id: string) => void;
  onClearAll: () => void;
}

export default function AlertsPanel({ 
  alerts, 
  onRemoveAlert,
  onClearAll 
}: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <Card className="glass p-6 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-muted-foreground">Nenhum alerta no momento</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <span className="font-semibold">Alertas Ativos</span>
          <Badge variant="secondary">{alerts.length}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Limpar
        </Button>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <AnimatePresence mode="popLayout">
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: -100 }}
              transition={{ duration: 0.2 }}
              className="mb-2"
            >
              <Card 
                className="glass p-4 border-l-4"
                style={{ 
                  borderLeftColor: getAlertColor(alert.type)
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant={alert.severity === 'danger' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {alert.severity === 'danger' ? 'PERIGO' : 'AVISO'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium mb-1">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onRemoveAlert(alert.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
