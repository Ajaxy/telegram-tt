import type { OwnProps } from './MuteChatModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const MuteChatModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const MuteChatModal = useModuleLoader(Bundles.Extra, 'MuteChatModal', !isOpen);

  return MuteChatModal ? <MuteChatModal {...props} /> : undefined;
};

export default MuteChatModalAsync;
