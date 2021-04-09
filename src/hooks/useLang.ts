import { useEffect } from '../lib/teact/teact';

import { ApiMediaFormat } from '../api/types';

import * as langProvider from '../util/langProvider';
import useForceUpdate from './useForceUpdate';

export type LangFn = typeof langProvider.getTranslation;

export default <T extends ApiMediaFormat = ApiMediaFormat.BlobUrl>(): LangFn => {
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    return langProvider.addCallback(forceUpdate);
  }, [forceUpdate]);

  return langProvider.getTranslation;
};
