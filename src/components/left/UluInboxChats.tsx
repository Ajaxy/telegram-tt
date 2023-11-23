import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { GlobalState } from '../../global/types';
import type { FolderEditDispatch } from '../../hooks/reducers/useFoldersReducer';
import type { LeftColumnContent, SettingsScreens } from '../../types';

import { ANIMATION_END_DELAY, IS_STORIES_ENABLED } from '../../config';
import buildClassName from '../../util/buildClassName';
import { ANIMATION_DURATION } from '../story/helpers/ribbonAnimation';

import useForumPanelRender from '../../hooks/useForumPanelRender';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';
import useLeftHeaderButtonRtlForumTransition from './main/hooks/useLeftHeaderButtonRtlForumTransition';

import StoryRibbon from '../story/StoryRibbon';
import StoryToggler from '../story/StoryToggler';
import Button from '../ui/Button';
import ChatList from './main/ChatList';
import ForumPanel from './main/ForumPanel';

import './UluInboxChats.scss';

export type OwnProps = {
  isActive: boolean;
  isForumPanelOpen?: boolean;
  archiveSettings: GlobalState['archiveSettings'];
  isStoryRibbonShown?: boolean;
  onReset: () => void;
  onTopicSearch: NoneToVoidFunction;
  onSettingsScreenSelect: (screen: SettingsScreens) => void;
  foldersDispatch: FolderEditDispatch;
  onLeftColumnContentChange: (content: LeftColumnContent) => void;
};

const UluInboxChats: FC<OwnProps> = ({
  isActive,
  isForumPanelOpen,
  archiveSettings,
  isStoryRibbonShown,
  onReset,
  onTopicSearch,
  onSettingsScreenSelect,
  onLeftColumnContentChange,
  foldersDispatch,
}) => {
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(isForumPanelOpen);

  const {
    shouldRender: shouldRenderTitle,
    transitionClassNames: titleClassNames,
  } = useShowTransition(!isForumPanelOpen);

  const {
    shouldRenderForumPanel, handleForumPanelAnimationEnd,
    handleForumPanelAnimationStart, isAnimationStarted,
  } = useForumPanelRender(isForumPanelOpen);
  const isForumPanelVisible = isForumPanelOpen && isAnimationStarted;

  const {
    shouldRender: shouldRenderStoryRibbon,
    transitionClassNames: storyRibbonClassNames,
    isClosing: isStoryRibbonClosing,
  } = useShowTransition(isStoryRibbonShown, undefined, undefined, '', false, ANIMATION_DURATION + ANIMATION_END_DELAY);

  return (
    <div className="UluInboxChats">
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
        >
          <i className="icon icon-arrow-left" />
        </Button>
        {shouldRenderTitle && <h3 className={titleClassNames}>{lang('Inbox')}</h3>}
        {IS_STORIES_ENABLED && (
          <div className="story-toggler-wrapper">
            <StoryToggler canShow />
          </div>
        )}
      </div>
      <div
        className={buildClassName(
          'chat-list-wrapper',
          shouldRenderStoryRibbon && 'with-story-ribbon',
          storyRibbonClassNames,
        )}
      >
        {IS_STORIES_ENABLED && shouldRenderStoryRibbon && (
          <StoryRibbon className="left-header-shadow" isClosing={isStoryRibbonClosing} />
        )}
        <ChatList
          folderType="all"
          isInbox
          isActive={isActive}
          isForumPanelOpen={isForumPanelVisible}
          onSettingsScreenSelect={onSettingsScreenSelect}
          onLeftColumnContentChange={onLeftColumnContentChange}
          foldersDispatch={foldersDispatch}
          archiveSettings={archiveSettings}
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

export default memo(UluInboxChats);
