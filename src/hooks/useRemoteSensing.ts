import { useState, useCallback } from 'react';
import { fetchRemoteSensingData, RemoteSensingData } from '@/lib/remote-sensing-api';

export function useRemoteSensing() {
  const [remoteSensingData, setRemoteSensingData] = useState<RemoteSensingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (latitude: number, longitude: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRemoteSensingData(latitude, longitude);
      setRemoteSensingData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados de sensoriamento');
      setRemoteSensingData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    remoteSensingData,
    loading,
    error,
    fetchData
  };
}
