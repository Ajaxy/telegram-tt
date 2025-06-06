import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './ChatFolderModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ChatFolderModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ChatFolderModal = useModuleLoader(Bundles.Extra, 'ChatFolderModal', !isOpen);

  return ChatFolderModal ? <ChatFolderModal {...props} /> : undefined;
};

export default ChatFolderModalAsync;
