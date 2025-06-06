import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './MuteChatModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const MuteChatModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const MuteChatModal = useModuleLoader(Bundles.Extra, 'MuteChatModal', !isOpen);

  return MuteChatModal ? <MuteChatModal {...props} /> : undefined;
};

export default MuteChatModalAsync;
