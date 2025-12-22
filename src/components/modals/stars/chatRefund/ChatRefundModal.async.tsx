import type { OwnProps } from './ChatRefundModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const ChatRefundModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const ChatRefundModal = useModuleLoader(Bundles.Stars, 'ChatRefundModal', !modal);

  return ChatRefundModal ? <ChatRefundModal {...props} /> : undefined;
};

export default ChatRefundModalAsync;
