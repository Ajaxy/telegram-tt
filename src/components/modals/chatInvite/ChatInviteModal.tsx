import React, { memo, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { TabState } from '../../../global/types';

import { getCustomPeerFromInvite, getUserFullName } from '../../../global/helpers';
import { selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import usePrevious from '../../../hooks/usePrevious';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import PeerBadge from '../../common/PeerBadge';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './ChatInviteModal.module.scss';

export type OwnProps = {
  modal: TabState['chatInviteModal'];
};

const ChatInviteModal = ({ modal }: OwnProps) => {
  const { acceptChatInvite, closeChatInviteModal, showNotification } = getActions();
  // eslint-disable-next-line no-null/no-null
  const participantsRef = useRef<HTMLDivElement>(null);

  const lang = useOldLang();

  const prevModal = usePrevious(modal);
  const { hash, inviteInfo } = modal || prevModal || {};
  const {
    about, isBroadcast, participantIds, participantsCount, photo, isRequestNeeded,
  } = inviteInfo || {};

  const handleClose = useLastCallback(() => {
    closeChatInviteModal();
  });

  const handleAccept = useLastCallback(() => {
    acceptChatInvite({ hash: hash! });

    showNotification({
      message: isBroadcast ? lang('RequestToJoinChannelSentDescription') : lang('RequestToJoinGroupSentDescription'),
    });

    handleClose();
  });

  const acceptLangKey = isBroadcast ? 'ProfileJoinChannel' : 'JoinGroup';
  const requestToJoinLangKey = isBroadcast ? 'MemberRequests.RequestToJoinChannel'
    : 'MemberRequests.RequestToJoinGroup';

  const customPeer = useMemo(() => {
    if (!inviteInfo) return undefined;

    return getCustomPeerFromInvite(inviteInfo);
  }, [inviteInfo]);

  const participants = useMemo(() => {
    if (!participantIds) {
      return undefined;
    }

    const global = getGlobal();
    return participantIds.map((id) => selectUser(global, id)).filter(Boolean);
  }, [participantIds]);

  useHorizontalScroll(participantsRef, !modal || !participants);

  return (
    <Modal
      isOpen={Boolean(modal)}
      contentClassName={styles.content}
      isSlim
      onClose={handleClose}
      onEnter={handleAccept}
    >
      {customPeer && <Avatar size="jumbo" photo={photo} peer={customPeer} withVideo />}
      {customPeer && <FullNameTitle className={styles.title} peer={customPeer} />}
      {about && <p className={styles.about}>{about}</p>}
      <p className={styles.participantCount}>
        {lang(isBroadcast ? 'Subscribers' : 'Members', participantsCount, 'i')}
      </p>
      {participants && (
        <div ref={participantsRef} className={buildClassName(styles.participants, 'no-scrollbar')}>
          {participants.map((participant) => (
            <PeerBadge className={styles.participant} peer={participant} text={getUserFullName(participant)} />
          ))}
        </div>
      )}
      <div className={buildClassName('dialog-buttons', styles.buttons)}>
        <Button isText className="confirm-dialog-button" onClick={handleAccept}>
          {lang(isRequestNeeded ? requestToJoinLangKey : acceptLangKey)}
        </Button>
        <Button isText className="confirm-dialog-button" onClick={handleClose}>
          {lang('Cancel')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(ChatInviteModal);
