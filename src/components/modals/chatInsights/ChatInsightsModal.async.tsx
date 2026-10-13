import type { OwnProps } from './ChatInsightsModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ChatInsightsModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const ChatInsightsModal = useModuleLoader(Bundles.Extra, 'ChatInsightsModal', !isOpen);

  return ChatInsightsModal ? <ChatInsightsModal {...props} /> : undefined;
};

export default ChatInsightsModalAsync;
