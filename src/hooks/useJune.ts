import { AnalyticsBrowser } from '@june-so/analytics-next';
import { useEffect, useState } from '../lib/teact/teact';

const APP_ENV = process.env.APP_ENV;

export function useJune() {
  const [analytics, setAnalytics] = useState<AnalyticsBrowser | undefined>(undefined);
  type TTrack = (eventName: string) => void;
  const [track, setTrack] = useState<undefined | TTrack>(undefined);

  useEffect(() => {
    const loadAnalytics = () => {
      const response = AnalyticsBrowser.load({
        writeKey: 'vLfuHIHM8CWtzPnZ',
      });
      setAnalytics(response);
      setTrack(() => (eventName: string) => {
        response.track(eventName);
      });
    };
    if (APP_ENV === 'development' || APP_ENV === 'staging') {
      setTrack(() => (eventName: string) => {
        // eslint-disable-next-line no-console
        console.info('[june mock]', eventName);
      });
    } else {
      loadAnalytics();
    }
  }, []);

  return { analytics, track };
}
