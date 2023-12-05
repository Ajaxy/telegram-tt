/* eslint-disable react/no-array-index-key */
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import buildClassName from '../../../util/buildClassName';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';

import useShowTransition from '../../../hooks/useShowTransition';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import ListItem from '../../ui/ListItem';

import './AttachTooltip.scss'; // Убедитесь, что у вас есть соответствующий файл стилей

interface Option {
  title: string;
  icon?: IconName;
  shortcut?: string;
  callback: () => void;
}

export type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
  filteredOptions: Option[];
};

const AttachTooltip: FC<OwnProps> = ({
  isOpen,
  onClose,
  filteredOptions,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);

  const handleSelectOption = useCallback((selectedOption: Option) => {
    selectedOption.callback();
  }, []);

  const selectedOptionIndex = useKeyboardNavigation({
    isActive: isOpen,
    items: filteredOptions,
    onSelect: handleSelectOption,
    initialIndex: isOpen ? 0 : undefined,
    shouldSelectOnTab: true,
    shouldRemoveSelectionOnReset: true,
    onClose,
  });

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedOptionIndex, containerRef);
  }, [selectedOptionIndex]);

  const className = buildClassName(
    'AttachTooltip composer-tooltip custom-scroll', // Обновите классы стилей в соответствии с вашими
    transitionClassNames,
  );

  const handleClick = useCallback((callback) => {
    callback();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div className={className} ref={containerRef}>
      {filteredOptions.map((option, index) => (
        <ListItem
          key={index}
          icon={option.icon}
          shortcut={option.shortcut}
          className="chat-item-clickable scroll-item"
          onClick={handleClick}
          focus={selectedOptionIndex === index}
        >
          {option.title}
        </ListItem>
      ))}
    </div>
  );
};

export default memo(AttachTooltip);
