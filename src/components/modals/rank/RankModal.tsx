import { memo, useMemo } from '@teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiChatMember, ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getPeerTitle } from '../../../global/helpers/peers';
import {
  selectCanEditOwnRank, selectCanEditRank, selectChat, selectChatFullInfo, selectUser,
} from '../../../global/selectors';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import PreviewBlock from '../../common/PreviewBlock';
import RankBadge from '../../common/RankBadge';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import Skeleton from '../../ui/placeholder/Skeleton';

import styles from './RankModal.module.scss';

export type OwnProps = {
  modal: TabState['rankModal'];
};

type StateProps = {
  user?: ApiUser;
  chat?: ApiChat;
  canEditRank?: boolean;
  canEditOwnRank?: boolean;
  currentUserMember?: ApiChatMember;
};

const PLACEHOLDER_ID = 'placeholder';

const RankModal = ({
  modal, user, chat, canEditRank, canEditOwnRank, currentUserMember,
}: OwnProps & StateProps) => {
  const { closeRankModal, openEditRankModal } = getActions();

  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const isOwn = renderingModal?.userId === currentUserMember?.userId;

  const handleClose = useLastCallback(() => {
    closeRankModal();
  });

  const handleActionClick = useLastCallback(() => {
    if (!renderingModal) return;
    if (canEditRank) {
      openEditRankModal(renderingModal);
    } else if (canEditOwnRank && currentUserMember) {
      openEditRankModal({
        chatId: renderingModal.chatId,
        userId: currentUserMember.userId,
        isAdmin: currentUserMember.isAdmin,
        isOwner: currentUserMember.isOwner,
        rank: currentUserMember.rank,
      });
    }

    closeRankModal();
  });

  const mainButtonText = useMemo(() => {
    if (canEditRank) return isOwn ? lang('RankModalEditMy') : lang('RankModalEdit');
    if (canEditOwnRank) return lang('RankModalEditMy');
    return lang('ButtonUnderstood');
  }, [canEditRank, canEditOwnRank, isOwn, lang]);

  if (!renderingModal) return undefined;

  const { userId, chatId, isAdmin, isOwner, rank } = renderingModal;

  return (
    <Modal
      isOpen={isOpen}
      className={styles.root}
      contentClassName={styles.content}
      hasAbsoluteCloseButton
      onClose={handleClose}
    >
      <div className={styles.body}>
        <div className={styles.topIcon}>
          <Icon name="user-tag" />
        </div>
        <div>
          <h3 className={styles.previewTitle}>
            {lang(
              isOwner ? 'RankModalOwnerTagTitle' : isAdmin ? 'RankModalAdminTagTitle' : 'RankModalMemberTagTitle',
            )}
          </h3>
          <div className={styles.previewText}>
            {lang(
              isOwner ? 'RankModalOwnerText' : isAdmin ? 'RankModalAdminText' : 'RankModalMemberText',
              {
                tag: <RankBadge chatId={chatId} userId={userId} isAdmin={isAdmin} isOwner={isOwner} rank={rank} />,
                author: user && getPeerTitle(lang, user),
                group: chat && getPeerTitle(lang, chat),
              },
              { withNodes: true, withMarkdown: true },
            )}
          </div>
        </div>
        <div className={styles.previewGrid}>
          <PreviewBlock contentClassName={styles.previewBlockContent}>
            <PreviewBlock.Message
              className={styles.previewMessage}
              badge={(
                <RankBadge
                  chatId={PLACEHOLDER_ID}
                  userId={PLACEHOLDER_ID}
                  className={styles.previewRankBadge}
                  rank={lang('RankMemberTag')}
                />
              )}
            >
              {renderPreviewContent()}
            </PreviewBlock.Message>
          </PreviewBlock>
          <PreviewBlock contentClassName={styles.previewBlockContent}>
            <PreviewBlock.Message
              className={styles.previewMessage}
              badge={(
                <RankBadge
                  className={styles.previewRankBadge}
                  chatId={PLACEHOLDER_ID}
                  userId={PLACEHOLDER_ID}
                  isAdmin
                  rank={lang('RankAdminTag')}
                />
              )}
            >
              {renderPreviewContent()}
            </PreviewBlock.Message>
          </PreviewBlock>
        </div>
        <div className={styles.footer}>
          <Button
            iconName={!canEditRank ? 'understood' : undefined}
            iconClassName={styles.understoodIcon}
            onClick={handleActionClick}
          >
            {mainButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

function renderPreviewContent() {
  return (
    <>
      <span className={styles.previewLine}>
        <Skeleton variant="rounded-rect" width={168} height={10} inline />
      </span>
      <span className={styles.previewMetaLine}>
        <Skeleton variant="rounded-rect" width={104} height={10} inline />
        <PreviewBlock.Message.Time>9:37</PreviewBlock.Message.Time>
      </span>
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const chatFullInfo = modal?.chatId ? selectChatFullInfo(global, modal.chatId) : undefined;
    const currentUserMember = chatFullInfo?.adminMembersById?.[global.currentUserId!]
      || chatFullInfo?.members?.find((member) => member.userId === global.currentUserId);
    return {
      user: modal?.userId ? selectUser(global, modal.userId) : undefined,
      chat: modal?.chatId ? selectChat(global, modal.chatId) : undefined,
      canEditRank: modal && selectCanEditRank(global, {
        chatId: modal.chatId,
        userId: modal.userId,
        isAdmin: modal.isAdmin,
        isOwner: modal.isOwner,
      }),
      canEditOwnRank: modal && selectCanEditOwnRank(global, modal.chatId),
      currentUserMember,
    };
  },
)(RankModal));
