import type { FC } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { GlobalState } from '../../global/types';
import type { FolderEditDispatch } from '../../hooks/reducers/useFoldersReducer';

import { ANIMATION_END_DELAY } from '../../config';
import buildClassName from '../../util/buildClassName';
import { ANIMATION_DURATION } from '../story/helpers/ribbonAnimation';

import useForumPanelRender from '../../hooks/useForumPanelRender';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';
import useLeftHeaderButtonRtlForumTransition from './main/hooks/useLeftHeaderButtonRtlForumTransition';

import StoryRibbon from '../story/StoryRibbon';
import StoryToggler from '../story/StoryToggler';
import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import ChatList from './main/ChatList';
import ForumPanel from './main/forum/ForumPanel';

import './ArchivedChats.scss';

export type OwnProps = {
  isActive: boolean;
  isForumPanelOpen?: boolean;
  archiveSettings: GlobalState['archiveSettings'];
  isStoryRibbonShown?: boolean;
  onReset: () => void;
  onTopicSearch: NoneToVoidFunction;
  foldersDispatch: FolderEditDispatch;
};

const ArchivedChats: FC<OwnProps> = ({
  isActive,
  isForumPanelOpen,
  archiveSettings,
  isStoryRibbonShown,
  onReset,
  onTopicSearch,
  foldersDispatch,
}) => {
  const { updateArchiveSettings } = getActions();
  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleDisplayArchiveInChats = useLastCallback(() => {
    updateArchiveSettings({ isHidden: false });
  });

  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(isForumPanelOpen);

  const {
    shouldRender: shouldRenderTitle,
    transitionClassNames: titleClassNames,
  } = useShowTransitionDeprecated(!isForumPanelOpen, undefined, undefined, false);

  const {
    shouldRenderForumPanel, handleForumPanelAnimationEnd,
    handleForumPanelAnimationStart, isAnimationStarted,
  } = useForumPanelRender(isForumPanelOpen);
  const isForumPanelVisible = isForumPanelOpen && isAnimationStarted;

  const {
    shouldRender: shouldRenderStoryRibbon,
    transitionClassNames: storyRibbonClassNames,
    isClosing: isStoryRibbonClosing,
  } = useShowTransitionDeprecated(
    isStoryRibbonShown, undefined, undefined, '', false, ANIMATION_DURATION + ANIMATION_END_DELAY,
  );

  return (
    <div className="ArchivedChats">
      <div className={buildClassName('left-header', !shouldRenderStoryRibbon && 'left-header-shadow')}>
        {lang.isRtl && <div className="DropdownMenuFiller" />}
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={onReset}
          ariaLabel="Return to chat list"
          className={buildClassName(
            lang.isRtl && 'rtl',
            isForumPanelVisible && lang.isRtl && 'right-aligned',
            shouldDisableDropdownMenuTransitionRef.current && lang.isRtl && 'disable-transition',
          )}
          onTransitionEnd={handleDropdownMenuTransitionEnd}
          iconName="arrow-left"
        />
        {shouldRenderTitle && <h3 className={titleClassNames}>{lang('ArchivedChats')}</h3>}
        <div className="story-toggler-wrapper">
          <StoryToggler canShow isArchived />
        </div>
        {archiveSettings.isHidden && (
          <DropdownMenu
            className="archived-chats-more-menu"
            positionX="right"
            onTransitionEnd={lang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
          >
            <MenuItem icon="archive-from-main" onClick={handleDisplayArchiveInChats}>
              {lang('lng_context_archive_to_list')}
            </MenuItem>
          </DropdownMenu>
        )}
      </div>
      <div
        className={buildClassName(
          'chat-list-wrapper',
          shouldRenderStoryRibbon && 'with-story-ribbon',
          storyRibbonClassNames,
        )}
      >
        {shouldRenderStoryRibbon && (
          <StoryRibbon isArchived className="left-header-shadow" isClosing={isStoryRibbonClosing} />
        )}
        <ChatList
          folderType="archived"
          isActive={isActive}
          isForumPanelOpen={isForumPanelVisible}
          isMainList
          foldersDispatch={foldersDispatch}
          archiveSettings={archiveSettings}
          isStoryRibbonShown={isStoryRibbonShown}
        />
      </div>
      {shouldRenderForumPanel && (
        <ForumPanel
          isOpen={isForumPanelOpen}
          onTopicSearch={onTopicSearch}
          onOpenAnimationStart={handleForumPanelAnimationStart}
          onCloseAnimationEnd={handleForumPanelAnimationEnd}
        />
      )}
    </div>
  );
};

export default memo(ArchivedChats);
