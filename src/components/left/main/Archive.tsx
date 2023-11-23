import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { GlobalState } from '../../../global/types';

import { ARCHIVED_FOLDER_ID } from '../../../config';
import { getChatTitle } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { compact } from '../../../util/iteratees';
import { formatIntegerCompact } from '../../../util/textFormat';
import renderText from '../../common/helpers/renderText';

import { useFolderManagerForOrderedIds, useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useLang from '../../../hooks/useLang';

import Badge from '../../ui/Badge';
import ListItem, { type MenuItemContextAction } from '../../ui/ListItem';

import styles from './Archive.module.scss';

type OwnProps = {
  archiveSettings: GlobalState['archiveSettings'];
  onDragEnter?: NoneToVoidFunction;
  onClick?: NoneToVoidFunction;
};

const PREVIEW_SLICE = 5;

const Archive: FC<OwnProps> = ({
  archiveSettings,
  onDragEnter,
  onClick,
}) => {
  const { updateArchiveSettings } = getActions();
  const lang = useLang();

  const orderedChatIds = useFolderManagerForOrderedIds(ARCHIVED_FOLDER_ID);
  const unreadCounters = useFolderManagerForUnreadCounters();
  const archiveUnreadCount = unreadCounters[ARCHIVED_FOLDER_ID]?.chatsCount;

  const previewItems = useMemo(() => {
    if (!orderedChatIds?.length) return lang('Loading');

    const chatsById = getGlobal().chats.byId;

    return orderedChatIds.slice(0, PREVIEW_SLICE).map((chatId, i, arr) => {
      const isLast = i === arr.length - 1;
      const chat = chatsById[chatId];
      if (!chat) {
        return undefined;
      }

      const title = getChatTitle(lang, chat);

      return (
        <>
          <span className={buildClassName(styles.chat, archiveUnreadCount && chat.unreadCount && styles.unread)}>
            {renderText(title)}
          </span>
          {isLast ? '' : ', '}
        </>
      );
    });
  }, [orderedChatIds, lang, archiveUnreadCount]);

  const contextActions = useMemo(() => {
    const actionMinimize = !archiveSettings.isMinimized && {
      title: lang('lng_context_archive_collapse'),
      icon: 'collapse',
      handler: () => {
        updateArchiveSettings({ isMinimized: true });
      },
    } satisfies MenuItemContextAction;

    const actionExpand = archiveSettings.isMinimized && {
      title: lang('lng_context_archive_expand'),
      icon: 'expand',
      handler: () => {
        updateArchiveSettings({ isMinimized: false });
      },
    } satisfies MenuItemContextAction;

    const actionHide = {
      title: lang('lng_context_archive_to_menu'),
      icon: 'archive-to-main',
      handler: () => {
        updateArchiveSettings({ isHidden: true });
      },
    } satisfies MenuItemContextAction;

    return compact([actionMinimize, actionExpand, actionHide]);
  }, [archiveSettings.isMinimized, lang, updateArchiveSettings]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    onDragEnter?.();
  }, [onDragEnter]);

  function renderCollapsed() {
    return (
      <div className={buildClassName(styles.info, 'info')}>
        <div className="info-row">
          <div className={buildClassName('title', styles.title)}>
            <h3 dir="auto" className={buildClassName(styles.name, 'fullName')}>
              <i className={buildClassName(styles.icon, 'icon', 'icon-archive-filled')} />
              {lang('Archive')}
            </h3>
          </div>
          <Badge
            className={styles.unreadCount}
            text={archiveUnreadCount ? formatIntegerCompact(archiveUnreadCount) : undefined}
          />
        </div>
      </div>
    );
  }

  function renderRegular() {
    return (
      <>
        <div className={buildClassName('status', styles.avatarWrapper)}>
          <div className={buildClassName('Avatar', styles.avatar)}>
            <i className="icon icon-archive-filled" />
          </div>
        </div>
        <div className={buildClassName(styles.info, 'info')}>
          <div className="info-row">
            <div className={buildClassName('title', styles.title)}>
              <h3 dir="auto" className={buildClassName(styles.name, 'fullName')}>{lang('Archive')}</h3>
            </div>
          </div>
          <div className="subtitle">
            <div className={buildClassName('status', styles.chatsPreview)}>
              {previewItems}
            </div>
            <Badge
              className={styles.unreadCount}
              text={archiveUnreadCount ? formatIntegerCompact(archiveUnreadCount) : undefined}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <ListItem
      onClick={onClick}
      onDragEnter={handleDragEnter}
      className={buildClassName(
        styles.root,
        archiveSettings.isMinimized && styles.minimized,
        'chat-item-clickable',
        'chat-item-archive',
      )}
      buttonClassName={styles.button}
      contextActions={contextActions}
      withPortalForMenu
    >
      {archiveSettings.isMinimized ? renderCollapsed() : renderRegular()}
    </ListItem>
  );
};

export default memo(Archive);
