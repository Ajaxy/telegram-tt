import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiExportedInvite } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import { formatCountdown, MILLISECONDS_IN_DAY } from '../../../util/dateFormat';
import useInterval from '../../../hooks/useInterval';
import useForceUpdate from '../../../hooks/useForceUpdate';
import { selectChat } from '../../../modules/selectors';
import { copyTextToClipboard } from '../../../util/clipboard';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import { getServerTime } from '../../../util/serverTime';

import ListItem from '../../ui/ListItem';
import NothingFound from '../../common/NothingFound';
import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  onScreenSelect: (screen: ManagementScreens) => void;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  exportedInvites?: ApiExportedInvite[];
  serverTimeOffset: number;
};

const BULLET = '\u2022';

function inviteComparator(i1: ApiExportedInvite, i2: ApiExportedInvite) {
  const { isPermanent: i1IsPermanent, usage: i1Usage = 0, date: i1Date } = i1;
  const { isPermanent: i2IsPermanent, usage: i2Usage = 0, date: i2Date } = i2;
  if (i1IsPermanent || i2IsPermanent) return Number(i1IsPermanent) - Number(i2IsPermanent);
  if (i1Usage || i2Usage) return i2Usage - i1Usage;
  return i2Date - i1Date;
}

const ManageInvites: FC<OwnProps & StateProps> = ({
  chatId,
  chat,
  exportedInvites,
  isActive,
  serverTimeOffset,
  onClose,
  onScreenSelect,
}) => {
  const { setEditingExportedInvite, showNotification, editExportedChatInvite } = getDispatch();
  useHistoryBack(isActive, onClose);
  const lang = useLang();

  const hasDetailedCountdown = useMemo(() => {
    if (!exportedInvites) return undefined;
    return exportedInvites
      .some(({ expireDate }) => (
        expireDate && (expireDate - getServerTime(serverTimeOffset) < MILLISECONDS_IN_DAY / 1000)
      ));
  }, [exportedInvites, serverTimeOffset]);
  const forceUpdate = useForceUpdate();
  useInterval(() => {
    forceUpdate();
  }, hasDetailedCountdown ? 1000 : undefined);

  const primaryInvite = exportedInvites?.find(({ isPermanent }) => isPermanent);
  const primaryInviteLink = chat?.username ? `t.me/${chat.username}` : primaryInvite?.link;
  const temporalInvites = useMemo(() => {
    const invites = chat?.username ? exportedInvites : exportedInvites?.filter(({ isPermanent }) => !isPermanent);
    return invites?.filter(({ isRevoked }) => !isRevoked)
      .sort(inviteComparator);
  }, [chat?.username, exportedInvites]);

  const editInvite = (invite: ApiExportedInvite) => {
    setEditingExportedInvite({ chatId, invite });
    onScreenSelect(ManagementScreens.EditInvite);
  };

  const revokeInvite = useCallback((invite: ApiExportedInvite) => {
    const {
      link, title, isRequestNeeded, expireDate, usageLimit,
    } = invite;
    editExportedChatInvite({
      chatId,
      link,
      title,
      isRequestNeeded,
      expireDate,
      usageLimit,
      isRevoked: true,
    });
  }, [chatId, editExportedChatInvite]);

  const handleCreateNewClick = useCallback(() => {
    onScreenSelect(ManagementScreens.EditInvite);
  }, [onScreenSelect]);

  const handlePrimaryRevoke = useCallback(() => {
    if (primaryInvite) {
      revokeInvite(primaryInvite);
    }
  }, [primaryInvite, revokeInvite]);

  const copyLink = useCallback((link: string) => {
    copyTextToClipboard(link);
    showNotification({
      message: lang('LinkCopied'),
    });
  }, [lang, showNotification]);

  const handleCopyPrimaryClicked = useCallback(() => {
    copyLink(primaryInviteLink!);
  }, [copyLink, primaryInviteLink]);

  const prepareUsageText = (invite: ApiExportedInvite) => {
    const {
      usage = 0, usageLimit, expireDate, isPermanent, requested,
    } = invite;
    let text = '';
    if (usageLimit && usage < usageLimit) {
      text = lang('CanJoin', usageLimit - usage);
    } else if (usage) {
      text = lang('PeopleJoined', usage);
    } else {
      text = lang('NoOneJoined');
    }

    if (requested) {
      text += ` ${BULLET} ${lang('JoinRequests', requested)}`;
    }

    if (usageLimit !== undefined && usage === usageLimit) {
      text += ` ${BULLET} ${lang('LinkLimitReached')}`;
    } else if (expireDate) {
      const diff = (expireDate - getServerTime(serverTimeOffset)) * 1000;
      text += ` ${BULLET} `;
      if (diff > 0) {
        text += lang('InviteLink.ExpiresIn', formatCountdown(lang, diff));
      } else {
        text += lang('InviteLink.Expired');
      }
    } else if (isPermanent) {
      text += ` ${BULLET} ${lang('Permanent')}`;
    }

    return text;
  };

  const prepareContextActions = (invite: ApiExportedInvite) => {
    const actions = [];
    actions.push({
      title: lang('Copy'),
      icon: 'copy',
      handler: () => copyLink(invite.link),
    });
    if (!invite.isPermanent) {
      actions.push({
        title: lang('Edit'),
        icon: lang('edit'),
        handler: () => editInvite(invite),
      });
    }
    actions.push({
      title: lang('RevokeButton'),
      icon: lang('delete'),
      handler: () => revokeInvite(invite),
      destructive: true,
    });
    return actions;
  };

  const PrimaryLinkMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="Actions"
      >
        <i className="icon-more" />
      </Button>
    );
  }, []);

  return (
    <div className="Management ManageInvites">
      <div className="custom-scroll">
        {primaryInviteLink && (
          <div className="section">
            <p className="text-muted">
              {chat?.username ? lang('PublicLink') : lang('lng_create_permanent_link_title')}
            </p>
            <div className="primary-link">
              <input
                className="form-control primary-link-input"
                value={primaryInviteLink}
                readOnly
                onClick={handleCopyPrimaryClicked}
              />
              <DropdownMenu
                className="primary-link-more-menu"
                trigger={PrimaryLinkMenuButton}
                positionX="right"
              >
                <MenuItem icon="copy" onClick={handleCopyPrimaryClicked}>{lang('Copy')}</MenuItem>
                {!chat?.username && (
                  <MenuItem icon="delete" onClick={handlePrimaryRevoke} destructive>{lang('RevokeButton')}</MenuItem>
                )}
              </DropdownMenu>
            </div>
            <Button onClick={handleCopyPrimaryClicked}>{lang('CopyLink')}</Button>
          </div>
        )}
        <div className="section" teactFastList>
          <Button isText key="create" className="create-link" onClick={handleCreateNewClick}>
            {lang('CreateNewLink')}
          </Button>
          {!temporalInvites && <NothingFound text="No links found" key="nothing" />}
          {temporalInvites?.map((invite) => (
            <ListItem
              icon="link"
              secondaryIcon="more"
              multiline
              onClick={() => copyLink(invite.link)}
              contextActions={prepareContextActions(invite)}
              key={invite.link}
            >
              <span className="title">{invite.title || invite.link}</span>
              <span className="subtitle" dir="auto">
                {prepareUsageText(invite)}
              </span>
            </ListItem>
          ))}
          <p className="text-muted hint" key="links-hint">{lang('ManageLinksInfoHelp')}</p>
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const { invites } = global.management.byChatId[chatId];
    const chat = selectChat(global, chatId);

    return {
      exportedInvites: invites,
      chat,
      serverTimeOffset: global.serverTimeOffset,
    };
  },
)(ManageInvites));
