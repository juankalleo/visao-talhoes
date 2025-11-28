import { useState, useEffect } from 'react';
import { WeatherAlert, checkAlerts, WeatherData } from '@/lib/weather-api';

const ALERTS_STORAGE_KEY = 'weather-alerts';

export function useAlerts(weather: WeatherData | null) {
  const [alerts, setAlerts] = useState<WeatherAlert[]>(() => {
    const stored = localStorage.getItem(ALERTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    if (!weather) return;

    const newAlerts = checkAlerts(weather);
    
    if (newAlerts.length > 0) {
      setAlerts(prev => {
        const updated = [...newAlerts, ...prev].slice(0, 50);
        localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [weather]);

  const clearAlerts = () => {
    setAlerts([]);
    localStorage.removeItem(ALERTS_STORAGE_KEY);
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => {
      const updated = prev.filter(alert => alert.id !== id);
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return {
    alerts,
    clearAlerts,
    removeAlert,
    unreadCount: alerts.length
  };
}
