import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiPeer, ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { CatchUpLink, CatchUpMessageRef } from '../../../types/catchUp';
import type { IconName } from '../../../types/icons';
import type { RegularLangKey } from '../../../types/language';

import { getPeerTitle } from '../../../global/helpers/peers';
import { selectChatLastMessageId } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateAtTime } from '../../../util/dates/oldDateFormat';
import { isUserId } from '../../../util/entities/ids';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';
import Island, { IslandTitle } from '@gili/layout/Island';
import Modal, {
  ModalCloseButton,
  ModalFooterActions,
  ModalHeader,
  ModalTitle,
} from '@gili/modal/Modal';

import styles from './CatchUpModal.module.scss';

export type OwnProps = {
  modal: NonNullable<TabState['catchUpModal']>;
  isOpen: boolean;
};

type StateProps = {
  lastMessageId?: number;
  usersById: Record<string, ApiUser>;
  chatsById: Record<string, ApiChat>;
};

type MediaKind = 'photos' | 'videos' | 'voices' | 'files' | 'stickers' | 'polls';

const MEDIA_KINDS: { kind: MediaKind; icon: IconName; labelKey: RegularLangKey }[] = [
  { kind: 'photos', icon: 'camera', labelKey: 'CatchUpPhotos' },
  { kind: 'videos', icon: 'video', labelKey: 'CatchUpVideos' },
  { kind: 'voices', icon: 'microphone', labelKey: 'CatchUpVoices' },
  { kind: 'files', icon: 'document', labelKey: 'CatchUpFiles' },
  { kind: 'stickers', icon: 'stickers', labelKey: 'CatchUpStickers' },
  { kind: 'polls', icon: 'poll', labelKey: 'CatchUpPolls' },
];

const MAX_AVATARS = 5;

const CatchUpModal = ({
  modal,
  isOpen,
  lastMessageId,
  usersById,
  chatsById,
}: OwnProps & StateProps) => {
  const {
    closeCatchUpModal, focusMessage, markMessageListRead, openUrl,
  } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();
  const { summary, isLoading } = modal;

  const getPeer = (peerId: string): ApiPeer | undefined => (
    isUserId(peerId) ? usersById[peerId] : chatsById[peerId]
  );

  const getPeerName = useLastCallback((peerId?: string) => {
    const peer = peerId ? getPeer(peerId) : undefined;
    return (peer && getPeerTitle(lang, peer)) || '';
  });

  const topSenders = useMemo(() => (
    summary?.senders.slice(0, MAX_AVATARS).map((sender) => ({
      ...sender,
      peer: isUserId(sender.peerId) ? usersById[sender.peerId] : chatsById[sender.peerId],
    })) || []
  ), [summary, usersById, chatsById]);

  const handleClose = useLastCallback(() => {
    closeCatchUpModal();
  });

  const handleJump = useLastCallback((messageId: number) => {
    closeCatchUpModal();
    focusMessage({ chatId: modal.chatId, messageId });
  });

  const handleMarkRead = useLastCallback(() => {
    if (summary) {
      markMessageListRead({ maxId: Math.max(summary.firstUnreadId, lastMessageId || 0) });
    }
    closeCatchUpModal();
  });

  const header = useMemo(() => (
    <ModalHeader>
      <ModalCloseButton />
      <ModalTitle>{lang('CatchUpTitle')}</ModalTitle>
    </ModalHeader>
  ), [lang]);

  const footer = useMemo(() => (
    <ModalFooterActions className={styles.footer}>
      <Button isText size="smaller" color="primary" fluid onClick={handleMarkRead}>
        {lang('CatchUpMarkRead')}
      </Button>
      <Button
        size="smaller"
        color="primary"
        fluid
        disabled={!summary?.firstUnreadId}
        onClick={() => summary && handleJump(summary.firstUnreadId)}
      >
        {lang('CatchUpJumpToFirst')}
      </Button>
    </ModalFooterActions>
  ), [lang, summary]);

  function renderRef(ref: CatchUpMessageRef) {
    const peer = ref.senderId ? getPeer(ref.senderId) : undefined;
    return (
      <div key={ref.messageId} className={styles.item} onClick={() => handleJump(ref.messageId)}>
        {peer && <Avatar peer={peer} size="small" />}
        <div className={styles.itemBody}>
          <div className={styles.itemTitle}>{getPeerName(ref.senderId)}</div>
          <div className={styles.itemText}>{ref.text || lang('CatchUpMediaMessage')}</div>
        </div>
        <Icon name="next" className={styles.itemArrow} />
      </div>
    );
  }

  function renderLink(link: CatchUpLink) {
    return (
      <div key={`${link.messageId}-${link.url}`} className={styles.item} onClick={() => openUrl({ url: link.url })}>
        <div className={styles.linkIcon}><Icon name="link" /></div>
        <div className={styles.itemBody}>
          <div className={styles.itemTitle}>{link.title || link.domain}</div>
          <div className={styles.itemText}>{link.title ? link.domain : link.url}</div>
        </div>
        <Button
          round
          size="tiny"
          color="translucent"
          ariaLabel={lang('CatchUpJump')}
          onClick={(e) => {
            e.stopPropagation();
            handleJump(link.messageId);
          }}
        >
          <Icon name="next" />
        </Button>
      </div>
    );
  }

  function renderSection(titleKey: RegularLangKey, count: number, items: CatchUpMessageRef[]) {
    if (!items.length) return undefined;
    return (
      <>
        <IslandTitle>{`${lang(titleKey)} · ${count}`}</IslandTitle>
        <Island>{items.map(renderRef)}</Island>
      </>
    );
  }

  const mediaKinds = summary ? MEDIA_KINDS.filter(({ kind }) => summary.media[kind] > 0) : [];

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      stickyFooter={summary ? footer : undefined}
      width="slim"
      height="tall"
      onClose={handleClose}
    >
      {isLoading && (
        <div className={styles.loading}>
          <Spinner color="blue" />
          <div className={styles.loadingText}>{lang('CatchUpLoading')}</div>
        </div>
      )}

      {summary && (
        <>
          <div className={styles.hero}>
            <div className={styles.avatars}>
              {topSenders.map(({ peerId, peer }, index) => (
                peer ? (
                  <Avatar
                    key={peerId}
                    peer={peer}
                    size="medium"
                    className={buildClassName(styles.avatar, index > 0 && styles.avatarStacked)}
                  />
                ) : undefined
              ))}
            </div>
            <div className={styles.heroTitle}>
              {lang('CatchUpMessagesFrom', {
                count: summary.totalMessages,
                people: lang('CatchUpPeople', { count: summary.senders.length }, {
                  pluralValue: summary.senders.length,
                }),
              }, { pluralValue: summary.totalMessages })}
            </div>
            {Boolean(summary.firstDate) && (
              <div className={styles.heroSubtitle}>
                {lang('CatchUpSince', { date: formatDateAtTime(oldLang, summary.firstDate * 1000) })}
              </div>
            )}
            {!summary.isComplete && (
              <div className={styles.heroNote}>{lang('CatchUpPartial')}</div>
            )}
          </div>

          {mediaKinds.length > 0 && (
            <div className={styles.grid}>
              {mediaKinds.map(({ kind, icon, labelKey }) => (
                <div
                  key={kind}
                  className={styles.gridItem}
                  onClick={() => handleJump(summary.media.firstMessageIdByKind[kind]!)}
                >
                  <Icon name={icon} className={styles.gridIcon} />
                  <div className={styles.gridValue}>{summary.media[kind]}</div>
                  <div className={styles.gridLabel}>{lang(labelKey)}</div>
                </div>
              ))}
            </div>
          )}

          {renderSection('CatchUpMentions', summary.mentions.length, summary.mentions)}
          {renderSection('CatchUpReplies', summary.replies.length, summary.replies)}
          {renderSection('CatchUpQuestions', summary.questions.length, summary.questions)}
          {renderSection('CatchUpPinned', summary.pinned.length, summary.pinned)}
          {summary.links.length > 0 && (
            <>
              <IslandTitle>{`${lang('CatchUpLinks')} · ${summary.links.length}`}</IslandTitle>
              <Island>{summary.links.map(renderLink)}</Island>
            </>
          )}
        </>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    return {
      lastMessageId: selectChatLastMessageId(global, modal.chatId),
      usersById: global.users.byId,
      chatsById: global.chats.byId,
    };
  },
)(CatchUpModal));
