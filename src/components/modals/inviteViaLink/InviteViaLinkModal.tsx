import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback,
  useEffect,
  useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChat } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { selectChat } from '../../../global/selectors';
import { partition } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import renderText from '../../common/helpers/renderText';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AvatarList from '../../common/AvatarList';
import Icon from '../../common/icons/Icon';
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

const InviteViaLinkModal: FC<OwnProps & StateProps> = ({
  modal,
  chat,
}) => {
  const { sendInviteMessages, closeInviteViaLinkModal, openPremiumModal } = getActions();
  const { missingUsers } = modal || {};

  const lang = useOldLang();
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const userIds = useMemo(() => missingUsers?.map((user) => user.id) || MEMO_EMPTY_ARRAY, [missingUsers]);
  const [unselectableIds, selectableIds] = useMemo(() => {
    if (!missingUsers?.length) return [[], []];
    const [requirePremiumIds, regularIds] = partition(missingUsers, (user) => user.isRequiringPremiumToMessage);
    return [requirePremiumIds.map((user) => user.id), regularIds.map((user) => user.id)];
  }, [missingUsers]);

  const invitableWithPremiumIds = useMemo(() => {
    return missingUsers?.filter((user) => user.isRequiringPremiumToInvite || user.isRequiringPremiumToMessage)
      .map((user) => user.id);
  }, [missingUsers]);

  const isEveryPremiumBlocksPm = useMemo(() => {
    if (!missingUsers) return undefined;
    return !missingUsers.some((user) => user.isRequiringPremiumToInvite && !user.isRequiringPremiumToMessage);
  }, [missingUsers]);

  const topListPeers = useMemo(() => {
    const users = getGlobal().users.byId;
    return invitableWithPremiumIds?.map((id) => users[id]);
  }, [invitableWithPremiumIds]);

  useEffect(() => {
    setSelectedMemberIds(selectableIds);
  }, [selectableIds]);

  const handleClose = useLastCallback(() => closeInviteViaLinkModal());

  const handleSendInviteLink = useCallback(() => {
    sendInviteMessages({ chatId: chat!.id, userIds: selectedMemberIds });
    closeInviteViaLinkModal();
  }, [selectedMemberIds, chat]);

  const handleOpenPremiumModal = useCallback(() => {
    openPremiumModal();
  }, []);

  const canSendInviteLink = useMemo(() => {
    if (!chat) return undefined;
    return Boolean(chat?.isCreator || chat?.adminRights?.inviteUsers);
  }, [chat]);

  const inviteSectionText = useMemo(() => {
    return canSendInviteLink
      ? lang(missingUsers?.length === 1 ? 'InviteBlockedOneMessage' : 'InviteBlockedManyMessage')
      : lang('InviteRestrictedUsers2', missingUsers?.length);
  }, [canSendInviteLink, lang, missingUsers?.length]);

  const premiumSectionText = useMemo(() => {
    if (!invitableWithPremiumIds?.length || !topListPeers?.length) return undefined;
    const prefix = isEveryPremiumBlocksPm ? 'InviteMessagePremiumBlocked' : 'InvitePremiumBlocked';
    let langKey = `${prefix}One`;
    let params = [getUserFullName(topListPeers[0])];
    if (invitableWithPremiumIds.length === 2) {
      langKey = `${prefix}Two`;
      params = [getUserFullName(topListPeers[0]), getUserFullName(topListPeers[1])];
    } else if (invitableWithPremiumIds.length === 3) {
      langKey = `${prefix}Three`;
      params = [getUserFullName(topListPeers[0]), getUserFullName(topListPeers[1]), getUserFullName(topListPeers[2])];
    } else if (invitableWithPremiumIds.length > 3) {
      langKey = `${prefix}Many`;
      params = [
        getUserFullName(topListPeers[0]),
        getUserFullName(topListPeers[1]),
        (invitableWithPremiumIds.length - 2).toString(),
      ];
    }

    return lang(langKey, params, undefined, topListPeers.length);
  }, [invitableWithPremiumIds, isEveryPremiumBlocksPm, lang, topListPeers]);

  const hasPremiumSection = Boolean(topListPeers?.length);
  const hasSelectableSection = Boolean(selectableIds?.length);

  return (
    <Modal
      isOpen={Boolean(userIds && chat)}
      contentClassName={styles.content}
      onClose={handleClose}
      isSlim
    >
      <Button
        round
        color="translucent"
        size="smaller"
        className={styles.closeButton}
        ariaLabel={lang('Close')}
        onClick={handleClose}
      >
        <Icon name="close" />
      </Button>
      {premiumSectionText && (
        <>
          <AvatarList
            className={styles.avatarList}
            peers={topListPeers}
            size="large"
          />
          <h3 className={styles.title}>
            {canSendInviteLink ? lang('InvitePremiumBlockedTitle') : lang('ChannelInviteViaLinkRestricted')}
          </h3>
          <p className={styles.contentText}>
            {renderText(premiumSectionText, ['simple_markdown'])}
          </p>
          <Button
            withPremiumGradient
            isShiny
            onClick={handleOpenPremiumModal}
          >
            {lang('InvitePremiumBlockedSubscribe')}
          </Button>
        </>
      )}
      {hasPremiumSection && hasSelectableSection && (
        <Separator className={styles.separator}>
          {lang('InvitePremiumBlockedOr')}
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
            lockedUnselectedSubtitle={lang('InvitePremiumBlockedUser')}
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
              {lang('SendInviteLink.ActionInvite')}
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
