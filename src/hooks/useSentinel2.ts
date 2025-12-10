import { useState, useCallback } from 'react';
import {
  fetchSentinel2Data,
  fetchNDVIStatistics,
  fetchNDVITimeSeries,
  Sentinel2Data,
  Sentinel2StatisticsResponse,
} from '@/lib/sentinel2-api';

export function useSentinel2() {
  const [sentinel2Data, setSentinel2Data] = useState<Sentinel2Data | null>(null);
  const [ndviStats, setNdviStats] = useState<Sentinel2StatisticsResponse | null>(null);
  const [timeSeries, setTimeSeries] = useState<Array<{ date: Date; ndvi: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (latitude: number, longitude: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSentinel2Data(latitude, longitude);
      setSentinel2Data(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados Sentinel-2');
      setSentinel2Data(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatsForPolygon = useCallback(async (coordinates: [number, number][]) => {
    setLoading(true);
    setError(null);
    try {
      const stats = await fetchNDVIStatistics(coordinates);
      setNdviStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar estatísticas NDVI');
      setNdviStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTimeSeries = useCallback(
    async (
      latitude: number,
      longitude: number,
      startDate: Date,
      endDate: Date,
      interval: 'daily' | 'weekly' | 'monthly' = 'monthly'
    ) => {
      setLoading(true);
      setError(null);
      try {
        const series = await fetchNDVITimeSeries(latitude, longitude, startDate, endDate, interval);
        setTimeSeries(series);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar série temporal NDVI');
        setTimeSeries([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    sentinel2Data,
    ndviStats,
    timeSeries,
    loading,
    error,
    fetchData,
    fetchStatsForPolygon,
    fetchTimeSeries,
  };
}
