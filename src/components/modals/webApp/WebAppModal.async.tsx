import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './WebAppModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const WebAppModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const WebAppModal = useModuleLoader(Bundles.Extra, 'WebAppModal', !modal?.isModalOpen);

  return WebAppModal ? <WebAppModal {...props} /> : undefined;
};

export default WebAppModalAsync;
