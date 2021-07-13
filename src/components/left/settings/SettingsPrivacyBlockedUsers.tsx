import React, {
  FC, memo, useCallback,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiChat, ApiUser } from '../../../api/types';
import { SettingsScreens } from '../../../types';

import { CHAT_HEIGHT_PX } from '../../../config';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';
import { pick } from '../../../util/iteratees';
import {
  getChatTitle, getUserFullName, isChatPrivate,
} from '../../../modules/helpers';
import renderText from '../../common/helpers/renderText';
import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ListItem from '../../ui/ListItem';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Avatar from '../../common/Avatar';
import Loading from '../../ui/Loading';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  chatsByIds: Record<number, ApiChat>;
  usersByIds: Record<number, ApiUser>;
  blockedIds: number[];
};

type DispatchProps = Pick<GlobalActions, 'unblockContact'>;

const SettingsPrivacyBlockedUsers: FC<OwnProps & StateProps & DispatchProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  chatsByIds,
  usersByIds,
  blockedIds,
  unblockContact,
}) => {
  const handleUnblockClick = useCallback((contactId: number) => {
    unblockContact({ contactId });
  }, [unblockContact]);

  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.PrivacyBlockedUsers);

  function renderContact(contactId: number, i: number, viewportOffset: number) {
    const isPrivate = isChatPrivate(contactId);
    const user = isPrivate ? usersByIds[contactId] : undefined;
    const chat = !isPrivate ? chatsByIds[contactId] : undefined;

    const className = buildClassName(
      'Chat chat-item-clickable blocked-list-item',
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
          {user && user.phoneNumber && (
            <div className="contact-phone" dir="auto">{formatPhoneNumberWithCode(user.phoneNumber)}</div>
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
          {blockedIds && blockedIds.length ? (
            <div className="scroll-container">
              {blockedIds!.map((contactId, i) => renderContact(contactId, i, 0))}
            </div>
          ) : blockedIds && !blockedIds.length ? (
            <div className="no-results" dir="auto">
              List is empty
            </div>
          ) : (
            <Loading key="loading" />
          )}
        </div>
      </div>

      <FloatingActionButton
        isShown
        onClick={() => {
        }}
        className="not-implemented"
        ariaLabel="Add a blocked user"
      >
        <i className="icon-add" />
      </FloatingActionButton>
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
    } = global;

    return {
      chatsByIds,
      usersByIds,
      blockedIds: ids,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['unblockContact']),
)(SettingsPrivacyBlockedUsers));
