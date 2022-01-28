import React, {
  FC, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiChatInviteImporter, ApiExportedInvite, ApiUser } from '../../../api/types';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import { copyTextToClipboard } from '../../../util/clipboard';
import { getServerTime } from '../../../util/serverTime';
import { formatFullDate, formatMediaDateTime, formatTime } from '../../../util/dateFormat';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';
import Button from '../../ui/Button';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  invite?: ApiExportedInvite;
  importers?: ApiChatInviteImporter[];
  admin?: ApiUser;
  serverTimeOffset: number;
};

const ManageInviteInfo: FC<OwnProps & StateProps> = ({
  chatId,
  invite,
  importers,
  isActive,
  serverTimeOffset,
  onClose,
}) => {
  const {
    showNotification,
    loadChatInviteImporters,
    openUserInfo,
  } = getDispatch();

  const lang = useLang();
  const {
    usage = 0, usageLimit, link, adminId,
  } = invite || {};
  const expireDate = invite?.expireDate && (invite.expireDate - getServerTime(serverTimeOffset)) * 1000 + Date.now();
  const isExpired = ((invite?.expireDate || 0) - getServerTime(serverTimeOffset)) < 0;

  useEffect(() => {
    if (link) loadChatInviteImporters({ chatId, link });
  }, [chatId, link, loadChatInviteImporters]);

  const handleCopyClicked = useCallback(() => {
    copyTextToClipboard(invite!.link);
    showNotification({
      message: lang('LinkCopied'),
    });
  }, [invite, lang, showNotification]);

  useHistoryBack(isActive, onClose);

  const renderImporters = () => {
    if (invite?.isRevoked) return undefined;
    if (!importers) return <p className="text-muted">{lang('Loading')}</p>;
    return (
      <div className="section">
        <p>{importers.length ? lang('PeopleJoined', usage) : lang('NoOneJoined')}</p>
        <p className="text-muted">
          {!importers.length && (
            usageLimit ? lang('PeopleCanJoinViaLinkCount', usageLimit - usage) : lang('NoOneJoinedYet')
          )}
          {importers.map((importer) => (
            <ListItem
              className="chat-item-clickable scroll-item small-icon"
              onClick={() => openUserInfo({ id: importer.userId })}
            >
              <PrivateChatInfo
                userId={importer.userId}
                status={formatMediaDateTime(lang, importer.date * 1000, true)}
                forceShowSelf
              />
            </ListItem>
          ))}
        </p>
      </div>
    );
  };

  return (
    <div className="Management ManageInviteInfo">
      <div className="custom-scroll">
        {!invite && (
          <p className="text-muted">{lang('Loading')}</p>
        )}
        {invite && (
          <>
            <div className="section">
              <h3>{invite.title || invite.link}</h3>
              <input
                className="form-control"
                value={invite.link}
                readOnly
                onClick={handleCopyClicked}
              />
              <Button className="copy-link" onClick={handleCopyClicked}>{lang('CopyLink')}</Button>
              {expireDate && (
                <p className="text-muted">
                  {isExpired
                    ? lang('ExpiredLink')
                    : lang('LinkExpiresIn', `${formatFullDate(lang, expireDate)} ${formatTime(lang, expireDate)}`)}
                </p>
              )}
            </div>
            {adminId && (
              <div className="section">
                <p>{lang('LinkCreatedeBy')}</p>
                <ListItem
                  className="chat-item-clickable scroll-item small-icon"
                  onClick={() => openUserInfo({ id: adminId })}
                >
                  <PrivateChatInfo
                    userId={adminId}
                    status={formatMediaDateTime(lang, invite.date * 1000, true)}
                    forceShowSelf
                  />
                </ListItem>
              </div>
            )}
            {renderImporters()}
          </>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const { inviteInfo } = global.management.byChatId[chatId];
    const invite = inviteInfo?.invite;
    const importers = inviteInfo?.importers;

    return {
      invite,
      importers,
      serverTimeOffset: global.serverTimeOffset,
    };
  },
)(ManageInviteInfo));
