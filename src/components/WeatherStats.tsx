import { motion } from 'framer-motion';
import { WeatherData } from '@/lib/weather-api';
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Gauge, 
  CloudRain, 
  Sun,
  Cloud
} from 'lucide-react';
import { Card } from '@/components/ui/card';

interface WeatherStatsProps {
  weather: WeatherData | null;
  loading: boolean;
}

export default function WeatherStats({ weather, loading }: WeatherStatsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(7)].map((_, i) => (
          <Card key={i} className="glass p-4 animate-pulse">
            <div className="h-16 bg-muted rounded" />
          </Card>
        ))}
      </div>
    );
  }

  if (!weather) {
    return (
      <Card className="glass p-6 text-center">
        <p className="text-muted-foreground">
          Clique no mapa para selecionar uma localização
        </p>
      </Card>
    );
  }

  const stats = [
    {
      icon: Thermometer,
      label: 'Temperatura',
      value: `${weather.temperature.toFixed(1)}°C`,
      color: 'text-warning'
    },
    {
      icon: Droplets,
      label: 'Umidade',
      value: `${weather.humidity}%`,
      color: 'text-primary'
    },
    {
      icon: Gauge,
      label: 'Pressão',
      value: `${weather.pressure.toFixed(0)} hPa`,
      color: 'text-foreground'
    },
    {
      icon: Wind,
      label: 'Vento',
      value: `${weather.windSpeed.toFixed(1)} km/h`,
      color: 'text-accent'
    },
    {
      icon: CloudRain,
      label: 'Precipitação',
      value: `${weather.precipitation.toFixed(1)} mm`,
      color: 'text-primary'
    },
    {
      icon: Sun,
      label: 'Índice UV',
      value: weather.uvIndex.toFixed(1),
      color: 'text-warning'
    },
    {
      icon: Cloud,
      label: 'Nuvens',
      value: `${weather.cloudCover}%`,
      color: 'text-muted-foreground'
    }
  ];

  return (
    <div className="space-y-3">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className="glass p-4 hover:bg-card/80 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-secondary/50 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-semibold">{stat.value}</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}

      <Card className="glass p-4 mt-4">
        <p className="text-xs text-muted-foreground text-center">
          Última atualização: {weather.timestamp.toLocaleTimeString('pt-BR')}
        </p>
      </Card>
    </div>
  );
}
