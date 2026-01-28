import {
  memo, useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type { ApiChat, ApiMessage, ApiPeer } from '../../../../api/types';

import { getCanPostInChat } from '../../../../global/helpers';
import { selectChat, selectPeer } from '../../../../global/selectors';
import { selectIsTelebizBulkSendActive } from '../../../global/selectors/bulkSend';
import { selectIsTelebizTemplatesChat } from '../../../global/selectors/templatesChats';
import buildClassName from '../../../../util/buildClassName';
import { canUseMessageForBulkSend } from '../../../util/messageTemplate';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';
import PeerPicker from '../../../../components/common/pickers/PeerPicker';
import Button from '../../../../components/ui/Button';
import RangeSlider from '../../../../components/ui/RangeSlider';
import TemplateMessageSelector from './TemplateMessageSelector';

import styles from './TelebizBulkSend.module.scss';

type OwnProps = {
  chatId: string;
};

type StateProps = {
  chat?: ApiChat;
  peer?: ApiPeer;
  isTemplatesChat: boolean;
  allChatIds: string[];
  isBulkSendActive: boolean;
};

const DEFAULT_DELAY_SECONDS = 3;
const MIN_DELAY_SECONDS = 1;
const MAX_DELAY_SECONDS = 30;

const TelebizBulkSend = ({
  chatId,
  chat,
  peer,
  isTemplatesChat,
  allChatIds,
  isBulkSendActive,
}: OwnProps & StateProps) => {
  const lang = useTelebizLang();
  const { showNotification, startTelebizBulkSend } = getActions();

  const [selectedMessage, setSelectedMessage] = useState<ApiMessage | undefined>();
  const [albumMessages, setAlbumMessages] = useState<ApiMessage[] | undefined>();
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [delaySeconds, setDelaySeconds] = useState(DEFAULT_DELAY_SECONDS);
  const [isSelectorOpen, openSelector, closeSelector] = useFlag(false);
  const [filterValue, setFilterValue] = useState('');

  // Filter chats: exclude template chat, filter by search, and only include chats where user can post
  const selectableChatIds = useMemo(() => {
    const global = getGlobal();
    const searchLower = filterValue.toLowerCase();

    return allChatIds.filter((id) => {
      // Exclude current template chat
      if (id === chatId) return false;

      const chatItem = selectChat(global, id);
      if (!chatItem) return false;

      // Only include chats where user can send messages
      if (!getCanPostInChat(chatItem)) return false;

      // Apply search filter
      if (searchLower && !chatItem.title?.toLowerCase().includes(searchLower)) {
        return false;
      }

      return true;
    });
  }, [allChatIds, chatId, filterValue]);

  // Reset state when chat changes
  useEffect(() => {
    setSelectedMessage(undefined);
    setAlbumMessages(undefined);
    setSelectedChatIds([]);
    setFilterValue('');
    closeSelector();
  }, [chatId, closeSelector]);

  const handleMessageSelect = useLastCallback((message: ApiMessage, album?: ApiMessage[]) => {
    if (!canUseMessageForBulkSend(message)) {
      showNotification({ message: lang('TemplatesChats.UnsupportedMessageType') });
      return;
    }
    setSelectedMessage(message);
    setAlbumMessages(album);
    closeSelector();
  });

  const handleSelectorClose = useLastCallback(() => {
    closeSelector();
  });

  const handleStartBulkSend = useLastCallback(() => {
    if (!selectedMessage || !chat || selectedChatIds.length === 0) return;

    // Get message IDs to forward (album or single)
    const messageIds = albumMessages
      ? albumMessages.map((m) => m.id)
      : [selectedMessage.id];

    // Start bulk send via global action
    startTelebizBulkSend({
      sourceChatId: chatId,
      messageIds,
      targetChatIds: selectedChatIds,
      delayMs: delaySeconds * 1000,
    });

    // Reset local selection state after starting
    setSelectedMessage(undefined);
    setAlbumMessages(undefined);
    setSelectedChatIds([]);
  });

  const renderDelayValue = useLastCallback((value: number) => {
    return `${value}s`;
  });

  if (!isTemplatesChat) {
    return (
      <div className={buildClassName(styles.root, 'settings-content custom-scroll')}>
        <div className={styles.completed}>
          <Icon name="document" className={styles.completedIcon} />
          <h3 className={styles.completedTitle}>{lang('BulkSend.NotTemplatesChat')}</h3>
          <p className={styles.completedText}>{lang('BulkSend.NotTemplatesChatDescription')}</p>
        </div>
      </div>
    );
  }

  // Show message selector
  if (isSelectorOpen && chat && peer) {
    return (
      <TemplateMessageSelector
        chat={chat}
        peer={peer}
        onSelect={handleMessageSelect}
        onClose={handleSelectorClose}
      />
    );
  }

  // Main campaign setup UI
  return (
    <div className={buildClassName(styles.root, 'settings-content custom-scroll')}>
      {/* Message Selection */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{lang('BulkSend.SelectMessage')}</div>
        {selectedMessage ? (
          <div className={styles.messagePreview} onClick={openSelector}>
            <div className={styles.messagePreviewContent}>
              <Icon name="document" className={styles.messageIcon} />
              <div className={styles.messageText}>
                <p>{selectedMessage.content.text?.text || lang('BulkSend.MediaMessage')}</p>
                <span>{lang('BulkSend.TapToChange')}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.selectMessage} onClick={openSelector}>
            <Icon name="add" />
            <span>{lang('BulkSend.ChooseMessage')}</span>
          </div>
        )}
      </div>

      {/* Chat Selection */}
      <div className={buildClassName(styles.section, styles.chatPicker)}>
        <div className={styles.sectionTitle}>
          {lang('BulkSend.SelectChats', { count: String(selectedChatIds.length) })}
        </div>
        <div className={styles.chatPickerContainer}>
          <PeerPicker
            itemIds={selectableChatIds}
            selectedIds={selectedChatIds}
            allowMultiple
            itemInputType="checkbox"
            isSearchable
            filterValue={filterValue}
            filterPlaceholder={lang('BulkSend.SearchChats')}
            onFilterChange={setFilterValue}
            onSelectedIdsChange={setSelectedChatIds}
            withStatus
          />
        </div>
      </div>

      {/* Delay Configuration */}
      <div className={styles.delaySection}>
        <div className={styles.delayLabel}>
          <span>{lang('BulkSend.DelayBetween')}</span>
          <strong>
            {delaySeconds}
            s
          </strong>
        </div>
        <RangeSlider
          min={MIN_DELAY_SECONDS}
          max={MAX_DELAY_SECONDS}
          value={delaySeconds}
          onChange={setDelaySeconds}
          renderValue={renderDelayValue}
        />
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Button
          onClick={handleStartBulkSend}
          disabled={!selectedMessage || selectedChatIds.length === 0 || isBulkSendActive}
          size="smaller"
          isShiny
        >
          {isBulkSendActive
            ? lang('BulkSend.Sending')
            : lang('BulkSend.StartSend', { count: String(selectedChatIds.length) })}
        </Button>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const chat = selectChat(global, chatId);
    const peer = selectPeer(global, chatId);
    const isTemplatesChat = selectIsTelebizTemplatesChat(global, chatId);
    const isBulkSendActive = selectIsTelebizBulkSendActive(global);

    // Get all chat IDs from the chat list
    const allChatIds = global.chats.listIds.active || [];

    return {
      chat,
      peer,
      isTemplatesChat,
      allChatIds,
      isBulkSendActive,
    };
  },
)(TelebizBulkSend));
