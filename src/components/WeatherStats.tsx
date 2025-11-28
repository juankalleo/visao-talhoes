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
          <Card key={i} className="liquid-glass p-4 animate-pulse rounded-xl">
            <div className="h-16 bg-muted/30 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  if (!weather) {
    return (
      <Card className="liquid-glass p-6 text-center rounded-xl">
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
          <Card className="liquid-glass liquid-glass-hover p-4 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <motion.div 
                  className={`p-2.5 rounded-xl bg-gradient-to-br from-white/20 to-white/5 ${stat.color}`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <stat.icon className="w-5 h-5" />
                </motion.div>
                <div>
                  <p className="text-xs text-muted-foreground/80 font-medium tracking-wide uppercase">{stat.label}</p>
                  <p className="text-2xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="liquid-glass p-4 mt-4 rounded-xl">
          <p className="text-xs text-muted-foreground/70 text-center font-medium">
            Última atualização: {weather.timestamp.toLocaleTimeString('pt-BR')}
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
