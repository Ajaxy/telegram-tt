import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiCountryCode, ApiUser } from '../../../api/types';

import { CHAT_HEIGHT_PX } from '../../../config';
import { getMainUsername, isUserId } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import BlockUserModal from './BlockUserModal';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  chatsByIds: Record<string, ApiChat>;
  usersByIds: Record<string, ApiUser>;
  blockedIds: string[];
  phoneCodeList: ApiCountryCode[];
};

const SettingsPrivacyBlockedUsers: FC<OwnProps & StateProps> = ({
  isActive,
  onReset,
  chatsByIds,
  usersByIds,
  blockedIds,
  phoneCodeList,
}) => {
  const { unblockUser } = getActions();

  const lang = useLang();
  const [isBlockUserModalOpen, openBlockUserModal, closeBlockUserModal] = useFlag();
  const handleUnblockClick = useCallback((userId: string) => {
    unblockUser({ userId });
  }, [unblockUser]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const blockedUsernamesById = useMemo(() => {
    return blockedIds.reduce((acc, userId) => {
      const isPrivate = isUserId(userId);
      const user = isPrivate ? usersByIds[userId] : undefined;
      const mainUsername = user && !user.phoneNumber && getMainUsername(user);

      if (mainUsername) {
        acc[userId] = mainUsername;
      }

      return acc;
    }, {} as Record<string, string>);
  }, [blockedIds, usersByIds]);

  function renderContact(contactId: string, i: number, viewportOffset: number) {
    const isPrivate = isUserId(contactId);
    const user = usersByIds[contactId];
    const chat = chatsByIds[contactId];
    const peer = user || chat;

    const className = buildClassName(
      'Chat chat-item-clickable blocked-list-item small-icon',
      isPrivate ? 'private' : 'group',
    );

    const userMainUsername = blockedUsernamesById[contactId];

    return (
      <ListItem
        key={`blocked_${contactId}`}
        className={className}
        ripple
        narrow
        contextActions={[{
          title: 'Unblock',
          icon: 'unlock',
          handler: () => {
            handleUnblockClick(contactId);
          },
        }]}
        style={`top: ${(viewportOffset + i) * CHAT_HEIGHT_PX}px;`}
      >
        <Avatar
          size="medium"
          peer={peer}
        />
        <div className="contact-info" dir="auto">
          {peer && <FullNameTitle peer={peer} />}
          {user?.phoneNumber && (
            <div className="contact-phone" dir="auto">{formatPhoneNumberWithCode(phoneCodeList, user.phoneNumber)}</div>
          )}
          {userMainUsername && (<div className="contact-username" dir="auto">@{userMainUsername}</div>)}
        </div>
      </ListItem>
    );
  }

  return (
    <div className="settings-fab-wrapper">
      <div className="settings-content infinite-scroll">
        <div className="settings-item no-border">
          <p className="settings-item-description-larger mt-0 mb-2" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('BlockedUsersInfo')}
          </p>
        </div>

        <div className="chat-list custom-scroll">
          {blockedIds?.length ? (
            <div className="scroll-container settings-item">
              {blockedIds!.map((contactId, i) => renderContact(contactId, i, 0))}
            </div>
          ) : blockedIds && !blockedIds.length ? (
            <div className="no-results" dir="auto">{lang('NoBlocked')}</div>
          ) : (
            <Loading key="loading" />
          )}
        </div>
      </div>

      <FloatingActionButton
        isShown
        className="block-user-button"
        onClick={openBlockUserModal}
        ariaLabel={lang('BlockContact')}
      >
        <i className="icon icon-add" />
      </FloatingActionButton>
      <BlockUserModal
        isOpen={isBlockUserModalOpen}
        onClose={closeBlockUserModal}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chats: {
        byId: chatsByIds,
      },
      users: {
        byId: usersByIds,
      },
      blocked: {
        ids,
      },
      countryList: {
        phoneCodes: phoneCodeList,
      },
    } = global;

    return {
      chatsByIds,
      usersByIds,
      blockedIds: ids,
      phoneCodeList,
    };
  },
)(SettingsPrivacyBlockedUsers));
