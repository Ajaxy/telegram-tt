import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiExportedInvite } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { STICKER_SIZE_INVITES, TME_LINK_PREFIX } from '../../../config';
import { getMainUsername, isChatChannel } from '../../../global/helpers';
import { selectChat, selectTabState } from '../../../global/selectors';
import { copyTextToClipboard } from '../../../util/clipboard';
import { formatCountdown, MILLISECONDS_IN_DAY } from '../../../util/dateFormat';
import { getServerTime } from '../../../util/serverTime';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useInterval from '../../../hooks/schedulers/useInterval';
import useFlag from '../../../hooks/useFlag';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import AnimatedIcon from '../../common/AnimatedIcon';
import LinkField from '../../common/LinkField';
import NothingFound from '../../common/NothingFound';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem, { type MenuItemContextAction } from '../../ui/ListItem';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  onScreenSelect: (screen: ManagementScreens) => void;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  isChannel?: boolean;
  exportedInvites?: ApiExportedInvite[];
  revokedExportedInvites?: ApiExportedInvite[];
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
  revokedExportedInvites,
  isActive,
  isChannel,
  onClose,
  onScreenSelect,
}) => {
  const {
    setEditingExportedInvite,
    showNotification,
    editExportedChatInvite,
    deleteExportedChatInvite,
    deleteRevokedExportedChatInvites,
    setOpenedInviteInfo,
  } = getActions();

  const lang = useLang();

  const [isDeleteRevokeAllDialogOpen, openDeleteRevokeAllDialog, closeDeleteRevokeAllDialog] = useFlag();
  const [isRevokeDialogOpen, openRevokeDialog, closeRevokeDialog] = useFlag();
  const [revokingInvite, setRevokingInvite] = useState<ApiExportedInvite | undefined>();
  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const [deletingInvite, setDeletingInvite] = useState<ApiExportedInvite | undefined>();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const hasDetailedCountdown = useMemo(() => {
    if (!exportedInvites) return undefined;
    return exportedInvites
      .some(({ expireDate }) => (
        expireDate && (expireDate - getServerTime() < MILLISECONDS_IN_DAY / 1000)
      ));
  }, [exportedInvites]);
  const forceUpdate = useForceUpdate();
  useInterval(forceUpdate, hasDetailedCountdown ? 1000 : undefined);

  const chatMainUsername = useMemo(() => chat && getMainUsername(chat), [chat]);
  const primaryInvite = exportedInvites?.find(({ isPermanent }) => isPermanent);
  const primaryInviteLink = chatMainUsername ? `${TME_LINK_PREFIX}${chatMainUsername}` : primaryInvite?.link;
  const temporalInvites = useMemo(() => {
    const invites = chat?.usernames ? exportedInvites : exportedInvites?.filter(({ isPermanent }) => !isPermanent);
    return invites?.sort(inviteComparator);
  }, [chat?.usernames, exportedInvites]);

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

  const askToRevoke = useCallback((invite: ApiExportedInvite) => {
    setRevokingInvite(invite);
    openRevokeDialog();
  }, [openRevokeDialog]);

  const handleRevoke = useCallback(() => {
    if (!revokingInvite) return;
    revokeInvite(revokingInvite);
    setRevokingInvite(undefined);
    closeRevokeDialog();
  }, [closeRevokeDialog, revokeInvite, revokingInvite]);

  const handleCreateNewClick = useCallback(() => {
    onScreenSelect(ManagementScreens.EditInvite);
  }, [onScreenSelect]);

  const handlePrimaryRevoke = useCallback(() => {
    if (primaryInvite) {
      askToRevoke(primaryInvite);
    }
  }, [askToRevoke, primaryInvite]);

  const handleDeleteAllRevoked = useCallback(() => {
    deleteRevokedExportedChatInvites({ chatId });
    closeDeleteRevokeAllDialog();
  }, [chatId, closeDeleteRevokeAllDialog, deleteRevokedExportedChatInvites]);

  const showInviteInfo = useCallback((invite: ApiExportedInvite) => {
    setOpenedInviteInfo({ chatId, invite });
    onScreenSelect(ManagementScreens.InviteInfo);
  }, [chatId, onScreenSelect, setOpenedInviteInfo]);

  const deleteInvite = useCallback((invite: ApiExportedInvite) => {
    deleteExportedChatInvite({ chatId, link: invite.link });
  }, [chatId, deleteExportedChatInvite]);

  const askToDelete = useCallback((invite: ApiExportedInvite) => {
    setDeletingInvite(invite);
    openDeleteDialog();
  }, [openDeleteDialog]);

  const handleDelete = useCallback(() => {
    if (!deletingInvite) return;
    deleteInvite(deletingInvite);
    setDeletingInvite(undefined);
    closeDeleteDialog();
  }, [closeDeleteDialog, deleteInvite, deletingInvite]);

  const copyLink = useCallback((link: string) => {
    copyTextToClipboard(link);
    showNotification({
      message: lang('LinkCopied'),
    });
  }, [lang, showNotification]);

  const prepareUsageText = (invite: ApiExportedInvite) => {
    const {
      usage = 0, usageLimit, expireDate, isPermanent, requested, isRevoked,
    } = invite;
    let text = '';
    if (!isRevoked && usageLimit && usage < usageLimit) {
      text = lang('CanJoin', usageLimit - usage);
    } else if (usage) {
      text = lang('PeopleJoined', usage);
    } else {
      text = lang('NoOneJoined');
    }

    if (isRevoked) {
      text += ` ${BULLET} ${lang('Revoked')}`;
      return text;
    }

    if (requested) {
      text += ` ${BULLET} ${lang('JoinRequests', requested)}`;
    }

    if (usageLimit !== undefined && usage === usageLimit) {
      text += ` ${BULLET} ${lang('LinkLimitReached')}`;
    } else if (expireDate) {
      const diff = (expireDate - getServerTime()) * 1000;
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

  const getInviteIconClass = (invite: ApiExportedInvite) => {
    const {
      usage = 0, usageLimit, isRevoked, expireDate,
    } = invite;
    if (isRevoked) {
      return 'link-status-icon-gray';
    }
    if (usageLimit && usage < usageLimit) {
      return 'link-status-icon-green';
    }
    if (expireDate) {
      const diff = (expireDate - getServerTime()) * 1000;
      if (diff <= 0) {
        return 'link-status-icon-red';
      }
    }
    return 'link-status-icon-blue';
  };

  const prepareContextActions = (invite: ApiExportedInvite) => {
    const actions: MenuItemContextAction[] = [];
    actions.push({
      title: lang('Copy'),
      icon: 'copy',
      handler: () => copyLink(invite.link),
    });

    if (!invite.isPermanent && !invite.isRevoked) {
      actions.push({
        title: lang('Edit'),
        icon: 'edit',
        handler: () => editInvite(invite),
      });
    }

    if (!invite.isRevoked) {
      actions.push({
        title: lang('RevokeButton'),
        icon: 'delete',
        handler: () => askToRevoke(invite),
        destructive: true,
      });
    } else {
      actions.push({
        title: lang('DeleteLink'),
        icon: 'delete',
        handler: () => askToDelete(invite),
        destructive: true,
      });
    }
    return actions;
  };

  return (
    <div className="Management ManageInvites">
      <div className="custom-scroll">
        <div className="section">
          <AnimatedIcon
            tgsUrl={LOCAL_TGS_URLS.Invite}
            size={STICKER_SIZE_INVITES}
            className="section-icon"
          />
          <p className="text-muted">{isChannel ? lang('PrimaryLinkHelpChannel') : lang('PrimaryLinkHelp')}</p>
        </div>
        {primaryInviteLink && (
          <LinkField
            className="section"
            link={primaryInviteLink}
            withShare
            onRevoke={!chat?.usernames ? handlePrimaryRevoke : undefined}
            title={chat?.usernames ? lang('PublicLink') : lang('lng_create_permanent_link_title')}
          />
        )}
        <div className="section" teactFastList>
          <Button isText key="create" className="create-link" onClick={handleCreateNewClick}>
            {lang('CreateNewLink')}
          </Button>
          {(!temporalInvites || !temporalInvites.length) && <NothingFound text="No links found" key="nothing" />}
          {temporalInvites?.map((invite) => (
            <ListItem
              leftElement={<i className={`icon icon-link link-status-icon ${getInviteIconClass(invite)}`} />}
              secondaryIcon="more"
              multiline
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => showInviteInfo(invite)}
              contextActions={prepareContextActions(invite)}
              key={invite.link}
            >
              <span className="title invite-title">{invite.title || invite.link}</span>
              <span className="subtitle" dir="auto">
                {prepareUsageText(invite)}
              </span>
            </ListItem>
          ))}
          <p className="text-muted hint" key="links-hint">{lang('ManageLinksInfoHelp')}</p>
        </div>
        {revokedExportedInvites && Boolean(revokedExportedInvites.length) && (
          <div className="section" teactFastList>
            <p className="text-muted" key="title">{lang('RevokedLinks')}</p>
            <ListItem
              icon="delete"
              destructive
              key="delete"
              onClick={openDeleteRevokeAllDialog}
            >
              <span className="title">{lang('DeleteAllRevokedLinks')}</span>
            </ListItem>
            {revokedExportedInvites?.map((invite) => (
              <ListItem
                leftElement={<i className={`icon icon-link link-status-icon ${getInviteIconClass(invite)}`} />}
                secondaryIcon="more"
                multiline
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => showInviteInfo(invite)}
                contextActions={prepareContextActions(invite)}
                key={invite.link}
              >
                <span className="title">{invite.title || invite.link}</span>
                <span className="subtitle" dir="auto">
                  {prepareUsageText(invite)}
                </span>
              </ListItem>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={isDeleteRevokeAllDialogOpen}
        onClose={closeDeleteRevokeAllDialog}
        title={lang('DeleteAllRevokedLinks')}
        text={lang('DeleteAllRevokedLinkHelp')}
        confirmIsDestructive
        confirmLabel={lang('DeleteAll')}
        confirmHandler={handleDeleteAllRevoked}
      />
      <ConfirmDialog
        isOpen={isRevokeDialogOpen}
        onClose={closeRevokeDialog}
        title={lang('RevokeLink')}
        text={lang('RevokeAlert')}
        confirmIsDestructive
        confirmLabel={lang('RevokeButton')}
        confirmHandler={handleRevoke}
      />
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        title={lang('DeleteLink')}
        text={lang('DeleteLinkHelp')}
        confirmIsDestructive
        confirmLabel={lang('Delete')}
        confirmHandler={handleDelete}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const { invites, revokedInvites } = selectTabState(global).management.byChatId[chatId] || {};
    const chat = selectChat(global, chatId);
    const isChannel = chat && isChatChannel(chat);

    return {
      exportedInvites: invites,
      revokedExportedInvites: revokedInvites,
      chat,
      isChannel,
    };
  },
)(ManageInvites));
