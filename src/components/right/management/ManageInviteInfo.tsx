import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChatInviteImporter, ApiExportedInvite } from '../../../api/types';

import { isChatChannel } from '../../../global/helpers';
import { selectChat, selectTabState } from '../../../global/selectors';
import { formatFullDate, formatMediaDateTime, formatTime } from '../../../util/dates/oldDateFormat';
import { getServerTime } from '../../../util/serverTime';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import LinkField from '../../common/LinkField';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
import ListItem from '../../ui/ListItem';
import Spinner from '../../ui/Spinner';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  invite?: ApiExportedInvite;
  importers?: ApiChatInviteImporter[];
  requesters?: ApiChatInviteImporter[];
  isChannel?: boolean;
};

const BULLET = '\u2022';

const ManageInviteInfo = ({
  chatId,
  invite,
  importers,
  requesters,
  isChannel,
  isActive,
  onClose,
}: OwnProps & StateProps) => {
  const {
    loadChatInviteImporters,
    loadChatInviteRequesters,
    openChat,
  } = getActions();

  const lang = useOldLang();
  const {
    usage = 0, usageLimit, link, adminId,
  } = invite || {};
  // eslint-disable-next-line @eslint-react/purity
  const expireDate = invite?.expireDate && (invite.expireDate - getServerTime()) * 1000 + Date.now();
  const isExpired = ((invite?.expireDate || 0) - getServerTime()) < 0;

  useEffect(() => {
    if (link) {
      loadChatInviteImporters({ chatId, link });
      loadChatInviteRequesters({ chatId, link });
    }
  }, [chatId, link, loadChatInviteImporters, loadChatInviteRequesters]);

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const renderImporters = () => {
    if (!importers?.length && requesters?.length) return undefined;
    if (!importers) return <Spinner />;
    return (
      <>
        <IslandTitle>{importers.length ? lang('PeopleJoined', usage) : lang('NoOneJoined')}</IslandTitle>
        <Island>
          {!importers.length && (
            <IslandDescription>
              {usageLimit ? lang('PeopleCanJoinViaLinkCount', usageLimit - usage) : lang('NoOneJoinedYet')}
            </IslandDescription>
          )}
          {importers.map((importer) => {
            const joinTime = formatMediaDateTime(lang, importer.date * 1000, true);
            const status = importer.isFromChatList ? `${joinTime} ${BULLET} ${lang('JoinedViaFolder')}` : joinTime;
            return (
              <ListItem
                className="chat-item-clickable scroll-item small-icon"

                onClick={() => openChat({ id: importer.userId })}
              >
                <PrivateChatInfo
                  userId={importer.userId}
                  status={status}
                  forceShowSelf
                />
              </ListItem>
            );
          })}
        </Island>
      </>
    );
  };

  const renderRequesters = () => {
    if (invite?.isRevoked) return undefined;
    if (!requesters && importers) return <Spinner />;
    if (!requesters?.length) return undefined;
    return (
      <>
        <IslandTitle>{isChannel ? lang('SubscribeRequests') : lang('MemberRequests')}</IslandTitle>
        <Island>
          {requesters.map((requester) => (
            <ListItem
              className="chat-item-clickable scroll-item small-icon"

              onClick={() => openChat({ id: requester.userId })}
            >
              <PrivateChatInfo
                userId={requester.userId}
                status={formatMediaDateTime(lang, requester.date * 1000, true)}
                forceShowSelf
              />
            </ListItem>
          ))}
        </Island>
      </>
    );
  };

  return (
    <div className="Management ManageInviteInfo">
      <div className="panel-content custom-scroll">
        {!invite && (
          <IslandDescription>{lang('Loading')}</IslandDescription>
        )}
        {invite && (
          <>
            <Island>
              <LinkField title={invite.title} link={invite.link} className="invite-link" />
              {Boolean(expireDate) && (
                <IslandDescription>
                  {isExpired
                    ? lang('ExpiredLink')
                    : lang('LinkExpiresIn', `${formatFullDate(lang, expireDate)} ${formatTime(lang, expireDate)}`)}
                </IslandDescription>
              )}
            </Island>
            {adminId && (
              <>
                <IslandTitle>{lang('LinkCreatedeBy')}</IslandTitle>
                <Island>
                  <ListItem
                    className="chat-item-clickable scroll-item small-icon"

                    onClick={() => openChat({ id: adminId })}
                  >
                    <PrivateChatInfo
                      userId={adminId}
                      status={formatMediaDateTime(lang, invite.date * 1000, true)}
                      forceShowSelf
                    />
                  </ListItem>
                </Island>
              </>
            )}
            {renderImporters()}
            {renderRequesters()}
          </>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const { inviteInfo } = selectTabState(global).management.byChatId[chatId] || {};
    const { invite, importers, requesters } = inviteInfo || {};
    const chat = selectChat(global, chatId);
    const isChannel = chat && isChatChannel(chat);

    return {
      invite,
      importers,
      requesters,
      isChannel,
    };
  },
)(ManageInviteInfo));
