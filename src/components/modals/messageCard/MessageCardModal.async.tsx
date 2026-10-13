import type { OwnProps } from './MessageCardModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MessageCardModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const MessageCardModal = useModuleLoader(Bundles.Extra, 'MessageCardModal', !isOpen);

  return MessageCardModal ? <MessageCardModal {...props} /> : undefined;
};

export default MessageCardModalAsync;
