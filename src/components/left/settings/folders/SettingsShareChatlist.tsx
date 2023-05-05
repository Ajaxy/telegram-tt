import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type { FC } from '../../../../lib/teact/teact';

import { STICKER_SIZE_FOLDER_SETTINGS } from '../../../../config';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';
import renderText from '../../../common/helpers/renderText';
import { partition } from '../../../../util/iteratees';
import {
  selectCanInviteToChat, selectChat,
  selectChatFolder,
  selectTabState, selectUser,
} from '../../../../global/selectors';
import { isChatChannel, isUserBot } from '../../../../global/helpers';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';

import AnimatedIcon from '../../../common/AnimatedIcon';
import InviteLink from '../../../common/InviteLink';
import Picker from '../../../common/Picker';
import Spinner from '../../../ui/Spinner';
import FloatingActionButton from '../../../ui/FloatingActionButton';

type OwnProps = {
  isActive?: boolean;
  onReset: VoidFunction;
};

type StateProps = {
  folderId?: number;
  title?: string;
  includedChatIds?: string[];
  pinnedChatIds?: string[];
  peerIds?: string[];
  url?: string;
  isLoading?: boolean;
};

const SettingsShareChatlist: FC<OwnProps & StateProps> = ({
  isActive,
  onReset,
  folderId,
  title,
  includedChatIds,
  pinnedChatIds,
  peerIds,
  url,
  isLoading,
}) => {
  const {
    createChatlistInvite, deleteChatlistInvite, editChatlistInvite, showNotification,
  } = getActions();
  const lang = useLang();

  const [isTouched, setIsTouched] = useState(false);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  useEffect(() => {
    if (!isLoading) {
      setIsTouched(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!url && folderId) {
      createChatlistInvite({ folderId });
    }
  }, [folderId, url]);

  const handleRevoke = useCallback(() => {
    if (!url || !folderId) return;

    deleteChatlistInvite({ folderId, url });
    onReset();
  }, [folderId, onReset, url]);

  const itemIds = useMemo(() => {
    return (includedChatIds || []).concat(pinnedChatIds || []);
  }, [includedChatIds, pinnedChatIds]);

  const [unlockedIds, lockedIds] = useMemo(() => {
    const global = getGlobal();
    return partition(itemIds, (id) => selectCanInviteToChat(global, id));
  }, [itemIds]);

  const [selectedIds, setSelectedIds] = useState<string[]>(peerIds || []);

  const isFirstRenderRef = useRef(true);
  useEffectWithPrevDeps(([prevUrl]) => {
    if (prevUrl !== url) {
      isFirstRenderRef.current = true;
    }
    if (!isFirstRenderRef.current) return;
    isFirstRenderRef.current = false;
    if (!url) {
      setSelectedIds(unlockedIds);
    } else if (peerIds) {
      setSelectedIds(peerIds);
    }
  }, [url, unlockedIds, peerIds]);

  const handleClickDisabled = useCallback((id: string) => {
    const global = getGlobal();
    const user = selectUser(global, id);
    const chat = selectChat(global, id);
    if (user && isUserBot(user)) {
      showNotification({
        message: lang('FolderLinkScreen.AlertTextUnavailableBot'),
      });
    } else if (user) {
      showNotification({
        message: lang('FolderLinkScreen.AlertTextUnavailableUser'),
      });
    } else if (chat && isChatChannel(chat)) {
      showNotification({
        message: lang('FolderLinkScreen.AlertTextUnavailablePublicChannel'),
      });
    } else {
      showNotification({
        message: lang('FolderLinkScreen.AlertTextUnavailablePublicGroup'),
      });
    }
  }, [lang]);

  const handleSelectedIdsChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    setIsTouched(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!folderId || !url) return;
    editChatlistInvite({ folderId, peerIds: selectedIds, url });
  }, [folderId, selectedIds, url]);

  const chatsCount = selectedIds.length;
  const isDisabled = !chatsCount || isLoading;

  return (
    <div className="settings-content no-border custom-scroll SettingsFoldersChatsPicker">
      <div className="settings-content-header">
        <AnimatedIcon
          size={STICKER_SIZE_FOLDER_SETTINGS}
          tgsUrl={LOCAL_TGS_URLS.FoldersShare}
          className="settings-content-icon"
        />

        <p className="settings-item-description mb-3" dir="auto">
          {renderText(lang('FolderLinkScreen.TitleDescriptionSelected', [title, chatsCount]),
            ['simple_markdown'])}
        </p>
      </div>

      <InviteLink
        inviteLink={isLoading ? lang('Loading') : url!}
        onRevoke={handleRevoke}
        isDisabled={isDisabled}
      />

      <div className="settings-item settings-item-chatlist">
        <Picker
          itemIds={itemIds}
          lockedIds={lockedIds}
          onSelectedIdsChange={handleSelectedIdsChange}
          selectedIds={selectedIds}
          onDisabledClick={handleClickDisabled}
          isRoundCheckbox
        />
      </div>

      <FloatingActionButton
        isShown={isLoading || isTouched}
        disabled={isDisabled}
        onClick={handleSubmit}
        ariaLabel="Save changes"
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon icon-check" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { folderId, url, isLoading } = selectTabState(global).shareFolderScreen || {};
    const folder = folderId ? selectChatFolder(global, folderId) : undefined;
    const invite = folderId ? global.chatFolders.invites[folderId]?.find((i) => i.url === url) : undefined;

    return {
      folderId,
      title: folder?.title,
      includedChatIds: folder?.includedChatIds,
      pinnedChatIds: folder?.pinnedChatIds,
      url,
      isLoading,
      peerIds: invite?.peerIds,
    };
  },
)(SettingsShareChatlist));
