import type { OwnProps } from './BrowserModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const BrowserModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const BrowserModal = useModuleLoader(Bundles.Extra, 'BrowserModal', !modal?.isModalOpen);

  return BrowserModal ? <BrowserModal {...props} /> : undefined;
};

export default BrowserModalAsync;
