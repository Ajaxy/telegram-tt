import { AnalyticsBrowser } from '@june-so/analytics-next';
import { useEffect, useState } from '../lib/teact/teact';

export function useJune() {
  const [analytics, setAnalytics] = useState<AnalyticsBrowser | undefined>(undefined);

  useEffect(() => {
    const loadAnalytics = () => {
      const response = AnalyticsBrowser.load({
        writeKey: 'vLfuHIHM8CWtzPnZ',
      });
      setAnalytics(response);
    };
    loadAnalytics();
  }, []);

  return analytics;
}
