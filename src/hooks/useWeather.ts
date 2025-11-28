import { useState, useCallback } from 'react';
import { fetchWeatherData, WeatherData } from '@/lib/weather-api';
import { toast } from '@/hooks/use-toast';

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchWeatherData(lat, lon);
      setWeather(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch weather data';
      setError(message);
      toast({
        title: 'Erro ao buscar dados',
        description: message,
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    weather,
    loading,
    error,
    fetchWeather
  };
}
