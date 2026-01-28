import { memo, useMemo, useState } from '@teact';
import { getActions, getGlobal } from '../../../../global';

import { TelebizSettingsScreens } from '../../left/types';

import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectChat, selectUser } from '../../../../global/selectors';
import { isUserId } from '../../../../util/entities/ids';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import GroupChatInfo from '../../../../components/common/GroupChatInfo';
import PrivateChatInfo from '../../../../components/common/PrivateChatInfo';
import Button from '../../../../components/ui/Button';
import ListItem from '../../../../components/ui/ListItem';
import Modal from '../../../../components/ui/Modal';
import TelebizTemplatesChatSearch from './TelebizTemplatesChatSearch';

import styles from './TelebizTemplatesChatsModal.module.scss';

type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
  templatesChats: string[];
};

const TelebizTemplatesChatsModal = ({
  isOpen,
  templatesChats,
  onClose,
}: OwnProps) => {
  const lang = useLang();
  const telebizLang = useTelebizLang();

  const { openTelebizSettingsScreen } = getActions();

  const [selectedChatId, setSelectedChatId] = useState<string | undefined>(undefined);

  const handleChatSelect = useLastCallback((chatId: string) => {
    setSelectedChatId(chatId);
  });

  const handleClose = useLastCallback(() => {
    if (selectedChatId) {
      setSelectedChatId(undefined);
      return;
    }

    onClose();
  });

  const handleCloseCompletely = useLastCallback(() => {
    setSelectedChatId(undefined);
    onClose();
  });

  const selectedChatTitle = useMemo(() => {
    if (!selectedChatId) return undefined;

    const global = getGlobal();
    const peer = isUserId(selectedChatId)
      ? selectUser(global, selectedChatId)
      : selectChat(global, selectedChatId);

    return peer ? getPeerTitle(lang, peer) : undefined;
  }, [selectedChatId, lang]);

  const getSelectedChatTitle = () => {
    if (!selectedChatId) return telebizLang('TemplatesChats.Categories');
    return selectedChatTitle;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getSelectedChatTitle()}
      hasCloseButton
      className={styles.modal}
      headerClassName={styles.modalHeader}
      contentClassName={styles.modalContent}
    >
      {selectedChatId ? (
        <TelebizTemplatesChatSearch
          chatId={selectedChatId}
          handleCloseModal={handleCloseCompletely}
        />
      ) : (
        <div className={styles.chatsList}>
          {templatesChats.length > 0 ? templatesChats.map((chatId) => (
            <ListItem
              key={chatId}
              className={styles.settingsFoldersListItem}
              buttonClassName={styles.settingsFoldersListItemButton}
              narrow
              onClick={() => handleChatSelect(chatId)}
            >
              {isUserId(chatId) ? (
                <PrivateChatInfo avatarSize="medium" userId={chatId} noStatusOrTyping />
              ) : (
                <GroupChatInfo avatarSize="medium" chatId={chatId} noStatusOrTyping />
              )}
            </ListItem>
          )) : (
            <div className={styles.noChats}>
              You don&apos;t have any templates chats yet.
              <Button
                isText
                onClick={() => {
                  openTelebizSettingsScreen({
                    screen: TelebizSettingsScreens.TemplatesChats,
                  });
                  handleClose();
                }}
              >
                Add Templates Chats
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default memo(TelebizTemplatesChatsModal);
