import type { OwnProps } from './LanguageModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const LanguageModalAsync = (props: OwnProps) => {
  const LanguageModal = useModuleLoader(Bundles.Extra, 'LanguageModal', !props.modal);
  return LanguageModal ? <LanguageModal {...props} /> : undefined;
};

export default LanguageModalAsync;
