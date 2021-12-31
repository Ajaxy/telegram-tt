import React, {
  FC, memo, useCallback,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiCountryCode, ApiUser } from '../../../api/types';
import { SettingsScreens } from '../../../types';

import { CHAT_HEIGHT_PX } from '../../../config';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';
import {
  getChatTitle, getUserFullName, isUserId,
} from '../../../modules/helpers';
import renderText from '../../common/helpers/renderText';
import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useFlag from '../../../hooks/useFlag';

import ListItem from '../../ui/ListItem';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Avatar from '../../common/Avatar';
import Loading from '../../ui/Loading';
import BlockUserModal from './BlockUserModal';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
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
  onScreenSelect,
  onReset,
  chatsByIds,
  usersByIds,
  blockedIds,
  phoneCodeList,
}) => {
  const { unblockContact } = getDispatch();

  const lang = useLang();
  const [isBlockUserModalOpen, openBlockUserModal, closeBlockUserModal] = useFlag();
  const handleUnblockClick = useCallback((contactId: string) => {
    unblockContact({ contactId });
  }, [unblockContact]);

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.PrivacyBlockedUsers);

  function renderContact(contactId: string, i: number, viewportOffset: number) {
    const isPrivate = isUserId(contactId);
    const user = isPrivate ? usersByIds[contactId] : undefined;
    const chat = !isPrivate ? chatsByIds[contactId] : undefined;

    const className = buildClassName(
      'Chat chat-item-clickable blocked-list-item small-icon',
      isPrivate ? 'private' : 'group',
    );

    return (
      <ListItem
        key={contactId}
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
        <Avatar size="medium" user={user} chat={chat} />
        <div className="contact-info" dir="auto">
          <h3 dir="auto">{renderText((isPrivate ? getUserFullName(user) : getChatTitle(lang, chat!)) || '')}</h3>
          {user?.phoneNumber && (
            <div className="contact-phone" dir="auto">{formatPhoneNumberWithCode(phoneCodeList, user.phoneNumber)}</div>
          )}
          {user && !user.phoneNumber && user.username && (
            <div className="contact-username" dir="auto">@{user.username}</div>
          )}
        </div>
      </ListItem>
    );
  }

  return (
    <div className="settings-fab-wrapper">
      <div className="settings-content infinite-scroll">
        <div className="settings-item">
          <p className="settings-item-description-larger mt-0 mb-2" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('BlockedUsersInfo')}
          </p>
        </div>

        <div className="chat-list custom-scroll">
          {blockedIds?.length ? (
            <div className="scroll-container">
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
        onClick={openBlockUserModal}
        ariaLabel={lang('BlockContact')}
      >
        <i className="icon-add" />
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
