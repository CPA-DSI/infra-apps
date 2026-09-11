import { useState, useEffect, useCallback } from 'react';
import { getDailyEmailConfig, getWeeklyEmailConfig, getMonthlyEmailConfig } from '../services/api';

export function useEmailConfigs() {
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, w, m] = await Promise.all([
        getDailyEmailConfig(),
        getWeeklyEmailConfig(),
        getMonthlyEmailConfig(),
      ]);
      setDaily(d || null);
      setWeekly(w || null);
      setMonthly(m || null);
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateConfig = useCallback((type, data) => {
    switch (type) {
      case 'quotidien':
        setDaily(data);
        break;
      case 'hebdomadaire':
        setWeekly(data);
        break;
      case 'mensuelle':
        setMonthly(data);
        break;
      default:
        break;
    }
  }, []);

  return { daily, weekly, monthly, loading, error, refresh, updateConfig };
}
