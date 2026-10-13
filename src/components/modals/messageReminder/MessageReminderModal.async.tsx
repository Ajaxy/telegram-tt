import type { OwnProps } from './MessageReminderModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MessageReminderModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const MessageReminderModal = useModuleLoader(Bundles.Extra, 'MessageReminderModal', !isOpen);

  return MessageReminderModal ? <MessageReminderModal {...props} /> : undefined;
};

export default MessageReminderModalAsync;
