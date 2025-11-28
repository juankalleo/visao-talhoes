export interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  cloudCover: number;
  uvIndex: number;
  timestamp: Date;
  location: {
    lat: number;
    lon: number;
  };
}

export interface WeatherAlert {
  id: string;
  type: 'heat' | 'wind' | 'dry' | 'rain';
  severity: 'warning' | 'danger';
  message: string;
  timestamp: Date;
}

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1';

export async function fetchWeatherData(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation',
      'cloud_cover',
      'uv_index'
    ].join(','),
    timezone: 'auto'
  });

  const response = await fetch(`${OPEN_METEO_BASE}/forecast?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }

  const data = await response.json();
  const current = data.current;

  return {
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    pressure: current.surface_pressure,
    windSpeed: current.wind_speed_10m,
    windDirection: current.wind_direction_10m,
    precipitation: current.precipitation || 0,
    cloudCover: current.cloud_cover,
    uvIndex: current.uv_index || 0,
    timestamp: new Date(current.time),
    location: { lat: latitude, lon: longitude }
  };
}

export function checkAlerts(weather: WeatherData): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  // Heat alert
  if (weather.temperature >= 35) {
    alerts.push({
      id: `heat-${Date.now()}`,
      type: 'heat',
      severity: 'danger',
      message: `Calor extremo: ${weather.temperature.toFixed(1)}°C`,
      timestamp: new Date()
    });
  }

  // Wind alert
  if (weather.windSpeed >= 50) {
    alerts.push({
      id: `wind-${Date.now()}`,
      type: 'wind',
      severity: 'danger',
      message: `Vento forte: ${weather.windSpeed.toFixed(1)} km/h`,
      timestamp: new Date()
    });
  }

  // Dry air alert
  if (weather.humidity <= 30) {
    alerts.push({
      id: `dry-${Date.now()}`,
      type: 'dry',
      severity: 'warning',
      message: `Ar muito seco: ${weather.humidity}%`,
      timestamp: new Date()
    });
  }

  // Heavy rain alert
  if (weather.precipitation >= 2) {
    alerts.push({
      id: `rain-${Date.now()}`,
      type: 'rain',
      severity: 'warning',
      message: `Chuva intensa: ${weather.precipitation.toFixed(1)} mm`,
      timestamp: new Date()
    });
  }

  return alerts;
}

export function getAlertColor(type: WeatherAlert['type']): string {
  const colors = {
    heat: 'hsl(var(--warning))',
    wind: 'hsl(var(--primary))',
    dry: 'hsl(var(--warning))',
    rain: 'hsl(var(--primary))'
  };
  return colors[type];
}
