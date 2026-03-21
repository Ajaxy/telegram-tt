import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import RecipientPicker from '../../common/RecipientPicker';

export type OwnProps = {
  modal?: boolean;
};

const QuickChatPickerModal = ({
  modal,
}: OwnProps) => {
  const { closeQuickChatPicker, openChat } = getActions();

  const lang = useLang();
  const isOpen = Boolean(modal);

  const handleSelectRecipient = useLastCallback((peerId: string) => {
    openChat({ id: peerId, shouldReplaceHistory: true });
    closeQuickChatPicker();
  });

  return (
    <RecipientPicker
      isOpen={isOpen}
      searchPlaceholder={lang('Search')}
      onSelectRecipient={handleSelectRecipient}
      onClose={closeQuickChatPicker}
    />
  );
};

export default memo(QuickChatPickerModal);
