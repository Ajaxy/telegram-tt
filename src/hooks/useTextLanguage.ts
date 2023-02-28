import { detectLanguage } from '../util/languageDetection';
import useAsync from './useAsync';

export default function useTextLanguage(text?: string) {
  const language = useAsync(() => (text ? detectLanguage(text) : Promise.resolve(undefined)), [text], undefined);
  return language;
}
