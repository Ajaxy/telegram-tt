import React, { memo } from '../../lib/teact/teact';

import type { FC } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLeftHeaderButtonRtlForumTransition from './main/hooks/useLeftHeaderButtonRtlForumTransition';
import useShowTransition from '../../hooks/useShowTransition';
import useForumPanelRender from '../../hooks/useForumPanelRender';

import Button from '../ui/Button';
import ChatList from './main/ChatList';
import ForumPanel from './main/ForumPanel';

import './ArchivedChats.scss';

export type OwnProps = {
  isActive: boolean;
  onReset: () => void;
  onTopicSearch: NoneToVoidFunction;
  isForumPanelOpen?: boolean;
};

const ArchivedChats: FC<OwnProps> = ({
  isActive,
  isForumPanelOpen,
  onReset,
  onTopicSearch,
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

  const { shouldRenderForumPanel, handleForumPanelAnimationEnd } = useForumPanelRender(isForumPanelOpen);

  return (
    <div className="ArchivedChats">
      <div className="left-header">
        {lang.isRtl && <div className="DropdownMenuFiller" />}
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={onReset}
          ariaLabel="Return to chat list"
          className={buildClassName(
            lang.isRtl && 'rtl',
            isForumPanelOpen && lang.isRtl && 'right-aligned',
            shouldDisableDropdownMenuTransitionRef.current && lang.isRtl && 'disable-transition',
          )}
          onTransitionEnd={handleDropdownMenuTransitionEnd}
        >
          <i className="icon-arrow-left" />
        </Button>
        {shouldRenderTitle && <h3 className={titleClassNames}>{lang('ArchivedChats')}</h3>}
      </div>
      <ChatList folderType="archived" isActive={isActive} isForumPanelOpen={isForumPanelOpen} />
      {shouldRenderForumPanel && (
        <ForumPanel
          isOpen={isForumPanelOpen}
          onTopicSearch={onTopicSearch}
          onCloseAnimationEnd={handleForumPanelAnimationEnd}
        />
      )}
    </div>
  );
};

export default memo(ArchivedChats);
