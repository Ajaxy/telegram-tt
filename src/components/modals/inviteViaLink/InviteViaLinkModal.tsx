import {
  memo,
  useEffect,
  useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChat } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { selectChat, selectUser } from '../../../global/selectors';
import { partition } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AvatarList from '../../common/AvatarList';
import PeerPicker from '../../common/pickers/PeerPicker';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import Separator from '../../ui/Separator';

import styles from './InviteViaLinkModal.module.scss';

export type OwnProps = {
  modal: TabState['inviteViaLinkModal'];
};

type StateProps = {
  chat?: ApiChat;
};

const InviteViaLinkModal = ({
  modal,
  chat,
}: OwnProps & StateProps) => {
  const { sendInviteMessages, closeInviteViaLinkModal, openPremiumModal } = getActions();
  const { missingUsers } = modal || {};

  const lang = useLang();
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const userIds = useMemo(() => missingUsers?.map((user) => user.id) || MEMO_EMPTY_ARRAY, [missingUsers]);
  const [unselectableIds, selectableIds] = useMemo(() => {
    if (!missingUsers?.length) return [[], []];
    const [requirePremiumIds, regularIds] = partition(missingUsers, (user) => user.isRequiringPremiumToMessage);
    return [requirePremiumIds.map((user) => user.id), regularIds.map((user) => user.id)];
  }, [missingUsers]);

  const invitableWithPremiumPeers = useMemo(() => {
    const global = getGlobal();
    return missingUsers?.filter((user) => user.isRequiringPremiumToInvite || user.isRequiringPremiumToMessage)
      .map((user) => selectUser(global, user.id))
      .filter(Boolean);
  }, [missingUsers]);

  useEffect(() => {
    setSelectedMemberIds(selectableIds);
  }, [selectableIds]);

  const handleClose = useLastCallback(() => closeInviteViaLinkModal());

  const handleSendInviteLink = useLastCallback(() => {
    sendInviteMessages({ chatId: chat!.id, userIds: selectedMemberIds });
    closeInviteViaLinkModal();
  });

  const handleOpenPremiumModal = useLastCallback(() => {
    openPremiumModal();
  });

  const canSendInviteLink = useMemo(() => {
    if (!chat) return undefined;
    return Boolean(chat?.isCreator || chat?.adminRights?.inviteUsers);
  }, [chat]);

  const inviteSectionText = useMemo(() => {
    return canSendInviteLink
      ? lang(missingUsers?.length === 1 ? 'InviteBlockedOneMessage' : 'InviteBlockedManyMessage')
      : lang('InviteRestrictedUsers', { count: missingUsers?.length }, {
        pluralValue: missingUsers?.length || 0,
        withMarkdown: true,
        withNodes: true,
      });
  }, [canSendInviteLink, lang, missingUsers?.length]);

  const premiumSectionText = useMemo(() => {
    if (!invitableWithPremiumPeers?.length) return undefined;
    if (invitableWithPremiumPeers.length === 1) {
      return lang('InviteRestrictedPremiumReasonSingle', { user: getUserFullName(invitableWithPremiumPeers[0]) }, {
        withMarkdown: true,
        withNodes: true,
      });
    }

    if (invitableWithPremiumPeers.length <= 3) {
      const list = lang.conjunction(invitableWithPremiumPeers.map((peer) => getUserFullName(peer)).filter(Boolean));
      return lang('InviteRestrictedPremiumReasonMultiple', { list }, {
        withMarkdown: true,
        withNodes: true,
      });
    }

    if (invitableWithPremiumPeers.length > 3) {
      const moreCount = invitableWithPremiumPeers.length - 2;
      const peers = invitableWithPremiumPeers.slice(0, 2);
      const list = lang.conjunction(peers.map((peer) => getUserFullName(peer)).filter(Boolean));
      return lang('InviteRestrictedPremiumReasonMultipleMore', { list, count: moreCount }, {
        pluralValue: moreCount,
        withMarkdown: true,
        withNodes: true,
      });
    }

    return undefined;
  }, [invitableWithPremiumPeers, lang]);

  const hasPremiumSection = Boolean(invitableWithPremiumPeers?.length);
  const hasSelectableSection = Boolean(selectableIds?.length);

  return (
    <Modal
      isOpen={Boolean(userIds && chat)}
      contentClassName={styles.content}
      hasAbsoluteCloseButton
      onClose={handleClose}
      isSlim
    >
      {hasPremiumSection && (
        <>
          <AvatarList
            className={styles.avatarList}
            peers={invitableWithPremiumPeers}
            size="large"
          />
          <h3 className={styles.title}>
            {canSendInviteLink ? lang('InviteBlockedPremiumTitle') : lang('InviteBlockedNoLinkTitle')}
          </h3>
          <p className={styles.contentText}>
            {premiumSectionText}
          </p>
          <Button
            withPremiumGradient
            isShiny
            onClick={handleOpenPremiumModal}
          >
            {lang('InviteBlockedPremiumButton')}
          </Button>
        </>
      )}
      {hasPremiumSection && hasSelectableSection && (
        <Separator className={styles.separator}>
          {lang('InviteBlockedOr')}
        </Separator>
      )}
      {hasSelectableSection && (
        <>
          <h3 className={styles.title}>{lang('InviteBlockedTitle')}</h3>
          <p className={styles.contentText}>
            {inviteSectionText}
          </p>
          <PeerPicker
            className={styles.userPicker}
            itemIds={userIds}
            selectedIds={selectedMemberIds}
            lockedUnselectedIds={unselectableIds}
            lockedUnselectedSubtitle={lang('InviteRestrictedPremiumReason')}
            onSelectedIdsChange={setSelectedMemberIds}
            isViewOnly={!canSendInviteLink}
            allowMultiple
            withStatus
            itemInputType="checkbox"
          />
          {canSendInviteLink && (
            <Button
              className={styles.sendInvites}
              onClick={handleSendInviteLink}
              disabled={!selectedMemberIds.length}
            >
              {lang('InviteViaLinkButton')}
            </Button>
          )}
        </>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const chat = modal?.chatId ? selectChat(global, modal.chatId) : undefined;

    return {
      chat,
    };
  },
)(InviteViaLinkModal));
