import React, {
  FC, memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../modules';

import { ApiChat, ApiExportedInvite } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { STICKER_SIZE_INVITES } from '../../../config';
import getAnimationData from '../../common/helpers/animatedAssets';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import { formatCountdown, MILLISECONDS_IN_DAY } from '../../../util/dateFormat';
import useInterval from '../../../hooks/useInterval';
import useForceUpdate from '../../../hooks/useForceUpdate';
import { selectChat } from '../../../modules/selectors';
import { copyTextToClipboard } from '../../../util/clipboard';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import { getServerTime } from '../../../util/serverTime';
import useFlag from '../../../hooks/useFlag';
import { isChatChannel } from '../../../modules/helpers';

import ListItem from '../../ui/ListItem';
import NothingFound from '../../common/NothingFound';
import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import ConfirmDialog from '../../ui/ConfirmDialog';
import AnimatedSticker from '../../common/AnimatedSticker';

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
  revokedExportedInvites,
  isActive,
  isChannel,
  serverTimeOffset,
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

  const [animationData, setAnimationData] = useState<string>();
  const [isAnimationLoaded, setIsAnimationLoaded] = useState(false);
  const handleAnimationLoad = useCallback(() => setIsAnimationLoaded(true), []);

  useEffect(() => {
    if (!animationData) {
      getAnimationData('Invite').then(setAnimationData);
    }
  }, [animationData]);

  useHistoryBack(isActive, onClose);

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
    return invites?.sort(inviteComparator);
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

  const handleCopyPrimaryClicked = useCallback(() => {
    copyLink(primaryInviteLink!);
  }, [copyLink, primaryInviteLink]);

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
        <div className="section">
          <div className="section-icon">
            {animationData && (
              <AnimatedSticker
                id="inviteDuck"
                size={STICKER_SIZE_INVITES}
                animationData={animationData}
                play={isAnimationLoaded}
                onLoad={handleAnimationLoad}
              />
            )}
          </div>
          <p className="text-muted">{isChannel ? lang('PrimaryLinkHelpChannel') : lang('PrimaryLinkHelp')}</p>
        </div>
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
          {(!temporalInvites || !temporalInvites.length) && <NothingFound text="No links found" key="nothing" />}
          {temporalInvites?.map((invite) => (
            <ListItem
              icon="link"
              secondaryIcon="more"
              multiline
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
                icon="link"
                secondaryIcon="more"
                multiline
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
    const { invites, revokedInvites } = global.management.byChatId[chatId];
    const chat = selectChat(global, chatId);
    const isChannel = chat && isChatChannel(chat);

    return {
      exportedInvites: invites,
      revokedExportedInvites: revokedInvites,
      chat,
      serverTimeOffset: global.serverTimeOffset,
      isChannel,
    };
  },
)(ManageInvites));
