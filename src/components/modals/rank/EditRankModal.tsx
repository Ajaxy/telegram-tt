import { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getUserFirstOrLastName } from '../../../global/helpers';
import { getPeerTitle } from '../../../global/helpers/peers';
import { selectCanEditRank, selectChat, selectUser } from '../../../global/selectors';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import PreviewBlock from '../../common/PreviewBlock';
import RankBadge from '../../common/RankBadge';
import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Modal from '../../ui/Modal';
import Skeleton from '../../ui/placeholder/Skeleton';

import styles from './EditRankModal.module.scss';

export type OwnProps = {
  modal: TabState['editRankModal'];
};

type StateProps = {
  user?: ApiUser;
  chat?: ApiChat;
  canEditRank?: boolean;
  isOwn?: boolean;
};

const MAX_RANK_LENGTH = 16;
const PREVIEW_TIME = '9:37';

const EditRankModal = ({
  modal, user, chat, canEditRank, isOwn,
}: OwnProps & StateProps) => {
  const { closeEditRankModal, editChatParticipantRank } = getActions();

  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const [rank, setRank] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setRank((renderingModal?.rank || '').slice(0, MAX_RANK_LENGTH));
  }, [renderingModal?.chatId, renderingModal?.rank, renderingModal?.userId, isOpen]);

  const handleClose = useLastCallback(() => {
    closeEditRankModal();
  });

  const handleInputChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRank(e.target.value);
  });

  const {
    userId, chatId, isAdmin, isOwner,
  } = renderingModal || {};
  const initialRank = (renderingModal?.rank || '').slice(0, MAX_RANK_LENGTH);
  const shouldShowBadge = Boolean(rank || isAdmin || isOwner);
  const isSubmitDisabled = !canEditRank || rank === initialRank;

  const handleSubmit = useLastCallback(() => {
    if (isSubmitDisabled) return;

    if (!chatId || !userId) return;

    editChatParticipantRank({
      chatId,
      userId,
      rank,
    });

    handleClose();
  });

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    e.preventDefault();
    handleSubmit();
  });

  if (!chatId || !userId) return undefined;

  return (
    <Modal
      isOpen={isOpen}
      title={lang(isOwn ? 'RankModalEditMy' : 'RankModalEdit')}
      contentClassName={styles.content}
      isSlim
      hasCloseButton
      onClose={handleClose}
    >
      <PreviewBlock className={styles.previewBlock} contentClassName={styles.previewBlockContent}>
        <PreviewBlock.Message
          className={styles.previewMessage}
          avatar={user ? <Avatar peer={user} size="small" /> : undefined}
          sender={user && getPeerTitle(lang, user)}
          badge={shouldShowBadge ? (
            <RankBadge
              chatId={chatId}
              userId={userId}
              className={styles.previewRankBadge}
              isAdmin={isAdmin}
              isOwner={isOwner}
              rank={rank || undefined}
            />
          ) : undefined}
          time={PREVIEW_TIME}
        >
          {renderPreviewContent()}
        </PreviewBlock.Message>
      </PreviewBlock>

      <InputText
        id="edit-rank"
        label={lang('EditAdminRank')}
        className={styles.input}
        value={rank}
        maxLength={MAX_RANK_LENGTH}
        disabled={!chat || !user || !canEditRank}
        teactExperimentControlled
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
      />
      <p className={styles.description}>
        {isOwn ? lang('RankEditTextOwn') : lang('RankEditText', {
          user: user && getUserFirstOrLastName(user),
        })}
      </p>

      <Button
        disabled={isSubmitDisabled}
        onClick={handleSubmit}
      >
        {lang('RankEditSave')}
      </Button>
    </Modal>
  );
};

function renderPreviewContent() {
  return (
    <>
      <span className={styles.previewLine}>
        <Skeleton variant="rounded-rect" height={10} inline />
      </span>
      <span className={styles.previewLine}>
        <Skeleton variant="rounded-rect" width={128} height={10} inline />
      </span>
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    return {
      user: modal?.userId ? selectUser(global, modal.userId) : undefined,
      chat: modal?.chatId ? selectChat(global, modal.chatId) : undefined,
      canEditRank: modal && selectCanEditRank(global, {
        chatId: modal.chatId,
        userId: modal.userId,
        isAdmin: modal.isAdmin,
        isOwner: modal.isOwner,
      }),
      isOwn: modal && modal.userId === global.currentUserId,
    };
  },
)(EditRankModal));
