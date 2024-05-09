import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiReaction, ApiSavedReactionTag,
} from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import buildClassName from '../../../../util/buildClassName';
import { REM } from '../../../common/helpers/mediaDimensions';

import useContextMenuHandlers from '../../../../hooks/useContextMenuHandlers';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useMenuPosition from '../../../../hooks/useMenuPosition';

import ReactionAnimatedEmoji from '../../../common/reactions/ReactionAnimatedEmoji';
import PromptDialog from '../../../modals/prompt/PromptDialog';
import Button from '../../../ui/Button';
import Menu from '../../../ui/Menu';
import MenuItem from '../../../ui/MenuItem';

import styles from './ReactionButton.module.scss';

const REACTION_SIZE = 1.25 * REM;
const TITLE_MAX_LENGTH = 15;
const LOOP_LIMIT = 1;

const SavedTagButton: FC<{
  reaction: ApiReaction;
  tag?: ApiSavedReactionTag;
  containerId: string;
  isChosen?: boolean;
  isOwnMessage?: boolean;
  withCount?: boolean;
  className?: string;
  chosenClassName?: string;
  isDisabled?: boolean;
  withContextMenu?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: (reaction: ApiReaction) => void;
  onRemove?: (reaction: ApiReaction) => void;
}> = ({
  reaction,
  tag,
  containerId,
  isChosen,
  isOwnMessage,
  className,
  chosenClassName,
  withCount,
  isDisabled,
  withContextMenu,
  observeIntersection,
  onClick,
  onRemove,
}) => {
  const { editSavedReactionTag } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLButtonElement>(null);
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);

  const lang = useLang();
  const [isRenamePromptOpen, openRenamePrompt, closeRenamePrompt] = useFlag();

  const { title, count } = tag || {};
  const hasText = Boolean(title || (withCount && count));

  const handleClick = useLastCallback(() => {
    onClick?.(reaction);
  });

  const handleRemoveClick = useLastCallback(() => {
    onRemove?.(reaction);
  });

  const handleRenameTag = useLastCallback((newTitle: string) => {
    editSavedReactionTag({
      reaction,
      title: newTitle,
    });
    closeRenamePrompt();
  });

  const {
    isContextMenuOpen,
    contextMenuPosition,
    handleBeforeContextMenu,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref, !withContextMenu);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);

  const getLayout = () => ({ withPortal: true, shouldAvoidNegativePosition: true });

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

  if (withCount && count === 0) {
    return undefined;
  }

  return (
    <Button
      className={buildClassName(
        styles.root,
        styles.tag,
        isOwnMessage && styles.own,
        isChosen && styles.chosen,
        isChosen && chosenClassName,
        isDisabled && styles.disabled,
        className,
      )}
      size="tiny"
      onClick={handleClick}
      onMouseDown={handleBeforeContextMenu}
      onContextMenu={handleContextMenu}
      ref={ref}
    >
      <ReactionAnimatedEmoji
        className={styles.animatedEmoji}
        containerId={containerId}
        reaction={reaction}
        loopLimit={LOOP_LIMIT}
        size={REACTION_SIZE}
        observeIntersection={observeIntersection}
      />
      {hasText && (
        <span className={styles.tagText}>
          {title && <span>{title}</span>}
          {withCount && <span>{count}</span>}
        </span>
      )}
      <svg
        className={styles.tail}
        width="15"
        height="30"
        viewBox="0 0 15 30"
      >
        <path className={styles.tailFill} d="m 0,30 c 3.1855,0 6.1803,-1.5176 8.0641,-4.0864 l 5.835,-7.9568 c 1.2906,-1.7599 1.2906,-4.1537 0,-5.9136 L 8.0641,4.08636 C 6.1803,1.51761 3.1855,0 0,0" />
      </svg>
      {withContextMenu && (
        <PromptDialog
          isOpen={isRenamePromptOpen}
          maxLength={TITLE_MAX_LENGTH}
          title={lang(tag?.title ? 'SavedTagRenameTag' : 'SavedTagLabelTag')}
          subtitle={lang('SavedTagLabelTagText')}
          placeholder={lang('SavedTagLabelPlaceholder')}
          initialValue={tag?.title}
          onClose={closeRenamePrompt}
          onSubmit={handleRenameTag}
        />
      )}
      {withContextMenu && contextMenuPosition && (
        <Menu
          ref={menuRef}
          isOpen={isContextMenuOpen}
          transformOriginX={transformOriginX}
          transformOriginY={transformOriginY}
          positionX={positionX}
          positionY={positionY}
          style={menuStyle}
          autoClose
          withPortal
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        >
          <MenuItem icon="tag-filter" onClick={handleClick}>
            {lang('SavedTagFilterByTag')}
          </MenuItem>
          <MenuItem icon="tag-name" onClick={openRenamePrompt}>
            {lang(tag?.title ? 'SavedTagRenameTag' : 'SavedTagLabelTag')}
          </MenuItem>
          <MenuItem icon="tag-crossed" destructive onClick={handleRemoveClick}>
            {lang('SavedTagRemoveTag')}
          </MenuItem>
        </Menu>
      )}
    </Button>
  );
};

export default memo(SavedTagButton);
