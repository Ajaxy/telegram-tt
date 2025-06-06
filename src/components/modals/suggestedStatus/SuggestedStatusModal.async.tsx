import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './SuggestedStatusModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SuggestedStatusModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const SuggestedStatusModal = useModuleLoader(Bundles.Extra, 'SuggestedStatusModal', !modal);

  return SuggestedStatusModal ? <SuggestedStatusModal {...props} /> : undefined;
};

export default SuggestedStatusModalAsync;
