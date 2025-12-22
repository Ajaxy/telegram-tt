import type { OwnProps } from './ChatInviteModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ChatInviteModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const ChatInviteModal = useModuleLoader(Bundles.Extra, 'ChatInviteModal', !modal);

  return ChatInviteModal ? <ChatInviteModal {...props} /> : undefined;
};

export default ChatInviteModalAsync;
