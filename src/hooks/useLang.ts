import * as langProvider from '../util/langProvider';
import useForceUpdate from './useForceUpdate';
import useOnChange from './useOnChange';

export type LangFn = typeof langProvider.getTranslation;

export default (): LangFn => {
  const forceUpdate = useForceUpdate();

  useOnChange(() => {
    return langProvider.addCallback(forceUpdate);
  }, [forceUpdate]);

  return langProvider.getTranslation;
};
