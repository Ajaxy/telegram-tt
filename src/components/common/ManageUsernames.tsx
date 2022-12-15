import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiUsername } from '../../api/types';

import { copyTextToClipboard } from '../../util/clipboard';
import buildClassName from '../../util/buildClassName';
import { isBetween } from '../../util/math';
import usePrevious from '../../hooks/usePrevious';
import useLang from '../../hooks/useLang';

import Draggable from '../ui/Draggable';
import ListItem from '../ui/ListItem';
import ConfirmDialog from '../ui/ConfirmDialog';

import styles from './ManageUsernames.module.scss';

type SortState = {
  orderedUsernames?: string[];
  dragOrderUsernames?: string[];
  draggedIndex?: number;
};

type OwnProps = {
  chatId?: string;
  usernames: ApiUsername[];
  onEditUsername: (username: string) => void;
};

const USERNAME_HEIGHT_PX = 60;

const ManageUsernames: FC<OwnProps> = ({
  chatId,
  usernames,
  onEditUsername,
}) => {
  const {
    showNotification,
    toggleUsername,
    toggleChatUsername,
    sortUsernames,
    sortChatUsernames,
  } = getActions();
  const lang = useLang();
  const [usernameForConfirm, setUsernameForConfirm] = useState<ApiUsername | undefined>();

  const usernameList = useMemo(() => usernames.map(({ username }) => username), [usernames]);
  const prevUsernameList = usePrevious(usernameList);

  const [state, setState] = useState<SortState>({
    orderedUsernames: usernameList,
    dragOrderUsernames: usernameList,
    draggedIndex: undefined,
  });

  // Sync folders state after changing folders in other clients
  useEffect(() => {
    if (prevUsernameList !== usernameList) {
      setState({
        orderedUsernames: usernameList,
        dragOrderUsernames: usernameList,
        draggedIndex: undefined,
      });
    }
  }, [prevUsernameList, usernameList]);

  const handleCopyUsername = useCallback((value: string) => {
    copyTextToClipboard(`@${value}`);
    showNotification({
      message: lang('UsernameCopied'),
    });
  }, [lang, showNotification]);

  const handleUsernameClick = useCallback((data: ApiUsername) => {
    if (data.isEditable) {
      onEditUsername(data.username);
    } else {
      setUsernameForConfirm(data);
    }
  }, [onEditUsername]);

  const closeConfirmUsernameDialog = useCallback(() => {
    setUsernameForConfirm(undefined);
  }, []);

  const handleUsernameToggle = useCallback(() => {
    if (chatId) {
      toggleChatUsername({
        chatId,
        username: usernameForConfirm!.username,
        isActive: !usernameForConfirm!.isActive,
      });
    } else {
      toggleUsername({
        username: usernameForConfirm!.username,
        isActive: !usernameForConfirm!.isActive,
      });
    }
    closeConfirmUsernameDialog();
  }, [chatId, closeConfirmUsernameDialog, toggleChatUsername, toggleUsername, usernameForConfirm]);

  const handleDrag = useCallback((translation: { x: number; y: number }, id: string | number) => {
    const delta = Math.round(translation.y / USERNAME_HEIGHT_PX);
    const index = state.orderedUsernames?.indexOf(id as string) || 0;
    const dragOrderUsernames = state.orderedUsernames?.filter((username) => username !== id);

    if (!dragOrderUsernames || !isBetween(index + delta, 0, usernameList.length)) {
      return;
    }

    dragOrderUsernames.splice(index + delta, 0, id as string);
    setState((current) => ({
      ...current,
      draggedIndex: index,
      dragOrderUsernames,
    }));
  }, [state.orderedUsernames, usernameList.length]);

  const handleDragEnd = useCallback(() => {
    setState((current) => {
      if (chatId) {
        sortChatUsernames({
          chatId,
          usernames: current.dragOrderUsernames!,
        });
      } else {
        sortUsernames({ usernames: current.dragOrderUsernames! });
      }

      return {
        ...current,
        orderedUsernames: current.dragOrderUsernames,
        draggedIndex: undefined,
      };
    });
  }, [chatId, sortChatUsernames, sortUsernames]);

  return (
    <>
      <div className={styles.container}>
        <h4 className={styles.header} dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('lng_usernames_subtitle')}
        </h4>
        <div className={styles.sortableContainer} style={`height: ${(usernames.length) * USERNAME_HEIGHT_PX}px`}>
          {usernames.map((usernameData, i) => {
            const isDragged = state.draggedIndex === i;
            const draggedTop = (state.orderedUsernames?.indexOf(usernameData.username) ?? 0) * USERNAME_HEIGHT_PX;
            const top = (state.dragOrderUsernames?.indexOf(usernameData.username) ?? 0) * USERNAME_HEIGHT_PX;
            const subtitle = usernameData.isEditable
              ? 'lng_usernames_edit'
              : (usernameData.isActive ? 'lng_usernames_active' : 'lng_usernames_non_active');

            return (
              <Draggable
                key={usernameData.username}
                id={usernameData.username}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                style={`top: ${isDragged ? draggedTop : top}px;`}
                knobStyle={`${lang.isRtl ? 'left' : 'right'}: 3rem;`}
                isDisabled={!usernameData.isActive}
              >
                <ListItem
                  key={usernameData.username}
                  className={buildClassName('mb-2 no-icon', styles.item)}
                  narrow
                  secondaryIcon="more"
                  icon={usernameData.isActive ? 'link' : 'link-broken'}
                  multiline
                  contextActions={[
                    {
                      handler: () => {
                        handleCopyUsername(usernameData.username);
                      },
                      title: lang('Copy'),
                      icon: 'copy',
                    },
                  ]}
                  // eslint-disable-next-line react/jsx-no-bind
                  onClick={() => {
                    handleUsernameClick(usernameData);
                  }}
                >
                  <span className="title">@{usernameData.username}</span>
                  <span className="subtitle">{lang(subtitle)}</span>
                </ListItem>
              </Draggable>
            );
          })}
        </div>
        <p className={styles.description} dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('lng_usernames_description')}
        </p>
      </div>
      <ConfirmDialog
        isOpen={Boolean(usernameForConfirm)}
        onClose={closeConfirmUsernameDialog}
        title={lang(usernameForConfirm?.isActive ? 'Username.DeactivateAlertTitle' : 'Username.ActivateAlertTitle')}
        text={lang(usernameForConfirm?.isActive ? 'Username.DeactivateAlertText' : 'Username.ActivateAlertText')}
        confirmLabel={lang(usernameForConfirm?.isActive
          ? 'Username.DeactivateAlertHide'
          : 'Username.ActivateAlertShow')}
        confirmHandler={handleUsernameToggle}
        confirmIsDestructive={!usernameForConfirm?.isActive}
      />
    </>
  );
};

export default memo(ManageUsernames);
