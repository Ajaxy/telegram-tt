import type { OwnProps } from './BrowserCloseConfirmationModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const BrowserCloseConfirmationModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const BrowserCloseConfirmationModal = useModuleLoader(Bundles.Extra, 'BrowserCloseConfirmationModal', !modal);

  return BrowserCloseConfirmationModal ? <BrowserCloseConfirmationModal modal={modal} /> : undefined;
};

export default BrowserCloseConfirmationModalAsync;
