import type { OwnProps } from './ChatLanguageModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ChatLanguageModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const ChatLanguageModal = useModuleLoader(Bundles.Extra, 'ChatLanguageModal', !isOpen);

  return ChatLanguageModal ? <ChatLanguageModal {...props} /> : undefined;
};

export default ChatLanguageModalAsync;
