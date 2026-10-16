import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type { ApiChatFolder } from '../../../../api/types';

import { STICKER_SIZE_FOLDER_SETTINGS } from '../../../../config';
import { isChatChannel, isUserBot } from '../../../../global/helpers';
import {
  selectCanInviteToChat, selectChat,
  selectChatFolder,
  selectTabState, selectUser,
} from '../../../../global/selectors';
import { partition } from '../../../../util/iteratees';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIcon from '../../../common/AnimatedIcon';
import LinkField from '../../../common/LinkField';
import PeerPicker from '../../../common/pickers/PeerPicker';
import Island, { IslandTitle } from '../../../gili/layout/Island';
import FloatingActionButton from '../../../ui/FloatingActionButton';

type OwnProps = {
  isActive?: boolean;
  onReset: VoidFunction;
};

type StateProps = {
  folderId?: number;
  folder?: ApiChatFolder;
  peerIds?: string[];
  url?: string;
  isLoading?: boolean;
};

const SettingsShareChatlist = ({
  isActive,
  onReset,
  folderId,
  folder,
  peerIds,
  url,
  isLoading,
}: OwnProps & StateProps) => {
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
    if (!url && folderId && isActive) {
      createChatlistInvite({ folderId });
    }
  }, [folderId, isActive, url]);

  const handleRevoke = useLastCallback(() => {
    if (!url || !folderId) return;

    deleteChatlistInvite({ folderId, url });
    onReset();
  });

  const itemIds = useMemo(() => {
    return (folder?.includedChatIds || []).concat(folder?.pinnedChatIds || []);
  }, [folder?.includedChatIds, folder?.pinnedChatIds]);

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

  const handleClickDisabled = useLastCallback((id: string) => {
    const global = getGlobal();
    const user = selectUser(global, id);
    const chat = selectChat(global, id);
    if (user && isUserBot(user)) {
      showNotification({
        message: lang('FolderLinkScreenAlertTextUnavailableBot'),
      });
    } else if (user) {
      showNotification({
        message: lang('FolderLinkScreenAlertTextUnavailableUser'),
      });
    } else if (chat && isChatChannel(chat)) {
      showNotification({
        message: lang('FolderLinkScreenAlertTextUnavailablePublicChannel'),
      });
    } else {
      showNotification({
        message: lang('FolderLinkScreenAlertTextUnavailablePublicGroup'),
      });
    }
  });

  const handleSelectedIdsChange = useLastCallback((ids: string[]) => {
    setSelectedIds(ids);
    setIsTouched(true);
  });

  const handleSubmit = useLastCallback(() => {
    if (!folderId || !url || !isTouched) return;
    editChatlistInvite({ folderId, peerIds: selectedIds, url });
  });

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

        {folder && (
          <p className="settings-item-description mb-3" dir="auto">
            {lang('FolderLinkTitleDescription', {
              folder: renderTextWithEntities({
                text: folder.title.text,
                entities: folder.title.entities,
                noCustomEmojiPlayback: folder.noTitleAnimations,
              }),
              chats: lang('FolderLinkTitleDescriptionChats', { count: chatsCount }, { pluralValue: chatsCount }),
            }, {
              withMarkdown: true,
              withNodes: true,
            })}
          </p>
        )}
      </div>

      <IslandTitle>{lang('InviteLink')}</IslandTitle>
      <Island>
        <LinkField
          link={!url ? lang('Loading') : url}
          withShare
          noTitle
          onRevoke={handleRevoke}
          isDisabled={!chatsCount || isTouched}
        />
      </Island>

      <Island>
        <PeerPicker
          itemIds={itemIds}
          lockedUnselectedIds={lockedIds}
          onSelectedIdsChange={handleSelectedIdsChange}
          selectedIds={selectedIds}
          onDisabledClick={handleClickDisabled}
          allowMultiple
          withStatus
          itemInputType="checkbox"
        />
      </Island>

      <FloatingActionButton
        isShown={isLoading || isTouched}
        disabled={isDisabled}
        onClick={handleSubmit}
        ariaLabel={lang('SettingsSaveChanges')}
        iconName="check"
        isLoading={isLoading}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { folderId, url, isLoading } = selectTabState(global).shareFolderScreen || {};
    const folder = folderId ? selectChatFolder(global, folderId) : undefined;
    const invite = folderId ? global.chatFolders.invites[folderId]?.find((i) => i.url === url) : undefined;

    return {
      folderId,
      folder,
      url,
      isLoading,
      peerIds: invite?.peerIds,
    };
  },
)(SettingsShareChatlist));
