import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './SuggestMessageModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SuggestMessageModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const SuggestMessageModal = useModuleLoader(Bundles.Extra, 'SuggestMessageModal', !modal);

  return SuggestMessageModal ? <SuggestMessageModal {...props} /> : undefined;
};

export default SuggestMessageModalAsync;
