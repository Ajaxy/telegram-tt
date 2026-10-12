import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiMessage, ApiPeer } from '../../../api/types';
import type { TabState } from '../../../global/types';
import { ApiMediaFormat } from '../../../api/types';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import {
  getChatAvatarHash,
  getMainUsername,
  getPeerColorKey,
} from '../../../global/helpers';
import { getPeerTitle } from '../../../global/helpers/peers';
import {
  selectChat, selectChatMessage, selectIsChatWithSelf, selectSender,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { copyBlobToClipboard } from '../../../util/clipboard';
import { formatTime } from '../../../util/dates/oldDateFormat';
import download from '../../../util/download';
import { getFirstLetters } from '../../../util/textFormat';
import {
  canvasToBlob,
  MESSAGE_CARD_THEMES,
  type MessageCardTheme,
  renderMessageCard,
} from './renderMessageCard';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';
import Modal, {
  ModalCloseButton,
  ModalFooterActions,
  ModalHeader,
  ModalTitle,
} from '@gili/modal/Modal';
import SwitchField from '@gili/templates/SwitchField';

import styles from './MessageCardModal.module.scss';

export type OwnProps = {
  modal: NonNullable<TabState['messageCardModal']>;
  isOpen: boolean;
};

type StateProps = {
  message?: ApiMessage;
  sender?: ApiPeer;
  chat?: ApiChat;
  isChatWithSelf?: boolean;
};

const FILE_NAME = 'telegram-message.png';
const DEFAULT_FONT_FAMILY = 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
// Mirrors the default palette in `util/theme.ts`, used until server colors are applied
const DEFAULT_PEER_COLORS = ['#D45246', '#F68136', '#6C61DF', '#46BA43', '#5CAFFA', '#408ACF', '#D95574'];
const DEFAULT_THEME = MESSAGE_CARD_THEMES[0];

const MessageCardModal = ({
  modal,
  isOpen,
  message,
  sender,
  chat,
  isChatWithSelf,
}: OwnProps & StateProps) => {
  const { closeMessageCardModal, openChatWithDraft, showNotification } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();

  const [theme, setTheme] = useState<MessageCardTheme>(DEFAULT_THEME);
  const [shouldShowSender, setShouldShowSender] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const canvasRef = useRef<HTMLCanvasElement>();

  const avatarHash = sender ? getChatAvatarHash(sender, 'big') : undefined;
  const avatarUrl = useMedia(avatarHash, !isOpen, ApiMediaFormat.BlobUrl);

  const text = message?.content.text?.text;
  const time = message ? formatTime(oldLang, message.date * 1000) : '';
  const senderName = sender ? getPeerTitle(lang, sender) : undefined;
  const senderColorKey = sender ? getPeerColorKey(sender, true) : undefined;
  const footer = useMemo(() => buildFooter(lang, isChatWithSelf ? sender : chat), [chat, sender, isChatWithSelf, lang]);

  useEffect(() => {
    if (!isOpen || !text) return;

    let isCancelled = false;
    requestMeasure(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const fontFamily = rootStyle.getPropertyValue('--font-family').trim() || DEFAULT_FONT_FAMILY;
      const senderColor = getPeerColorHex(rootStyle, senderColorKey);

      renderMessageCard({
        text,
        time,
        theme,
        fontFamily,
        senderName: shouldShowSender ? senderName : undefined,
        senderColor,
        senderInitials: senderName ? getFirstLetters(senderName, 2) : undefined,
        avatarUrl,
        footer,
      }).then((canvas) => {
        if (isCancelled) return;
        canvasRef.current = canvas;
        setPreviewUrl(canvas.toDataURL('image/png'));
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, text, time, theme, shouldShowSender, senderName, senderColorKey, avatarUrl, footer]);

  const handleClose = useLastCallback(() => {
    closeMessageCardModal();
  });

  const handleSave = useLastCallback(() => {
    if (!previewUrl) return;
    download(previewUrl, FILE_NAME);
  });

  const handleCopy = useLastCallback(async () => {
    if (!canvasRef.current) return;
    const blob = await canvasToBlob(canvasRef.current);
    await copyBlobToClipboard(blob);
    showNotification({ message: lang('MessageCardCopiedToast') });
  });

  const handleSend = useLastCallback(async () => {
    if (!canvasRef.current) return;
    const blob = await canvasToBlob(canvasRef.current);
    if (!blob) return;
    const file = new File([blob], FILE_NAME, { type: 'image/png' });
    closeMessageCardModal();
    openChatWithDraft({ text: { text: '' }, files: [file] });
  });

  const header = useMemo(() => (
    <ModalHeader>
      <ModalCloseButton />
      <ModalTitle>{lang('MessageCardTitle')}</ModalTitle>
    </ModalHeader>
  ), [lang]);

  const footerActions = useMemo(() => (
    <ModalFooterActions className={styles.footer}>
      <Button isText size="smaller" color="primary" fluid onClick={handleCopy}>
        {lang('MessageCardCopy')}
      </Button>
      <Button isText size="smaller" color="primary" fluid onClick={handleSave}>
        {lang('MessageCardSave')}
      </Button>
      <Button size="smaller" color="primary" fluid onClick={handleSend}>
        {lang('MessageCardSend')}
      </Button>
    </ModalFooterActions>
  ), [lang]);

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      stickyFooter={footerActions}
      width="regular"
      onClose={handleClose}
    >
      <div className={styles.preview}>
        {previewUrl && <img className={styles.previewImage} src={previewUrl} alt="" draggable={false} />}
      </div>
      <div className={styles.themes}>
        {MESSAGE_CARD_THEMES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={buildClassName(styles.swatch, item.key === theme.key && styles.swatchActive)}
            style={`background: linear-gradient(135deg, ${item.gradient[0]}, ${item.gradient[1]})`}
            aria-label={item.key}
            onClick={() => setTheme(item)}
          />
        ))}
      </div>
      {sender && (
        <SwitchField
          label={lang('MessageCardShowSender')}
          checked={shouldShowSender}
          onChange={setShouldShowSender}
        />
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const message = selectChatMessage(global, modal.chatId, modal.messageId);

    return {
      message,
      sender: message ? selectSender(global, message) : undefined,
      chat: selectChat(global, modal.chatId),
      isChatWithSelf: selectIsChatWithSelf(global, modal.chatId),
    };
  },
)(MessageCardModal));

function getPeerColorHex(rootStyle: CSSStyleDeclaration, colorKey: number | undefined) {
  if (colorKey === undefined) return undefined;
  const value = rootStyle.getPropertyValue(`--color-peer-${colorKey}`).trim();
  return value || DEFAULT_PEER_COLORS[colorKey % DEFAULT_PEER_COLORS.length];
}

function buildFooter(lang: ReturnType<typeof useLang>, peer?: ApiPeer) {
  if (!peer) return undefined;

  const username = getMainUsername(peer);
  return username ? `@${username}` : getPeerTitle(lang, peer);
}
