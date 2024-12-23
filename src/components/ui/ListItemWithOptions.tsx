import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { CustomPeer } from '../../types';

import buildClassName from '../../util/buildClassName';

import Checkbox from './Checkbox';
import ListItem from './ListItem';
import Radio from './Radio';

type OwnProps = {
  key: string;
  isChecked?: boolean;
  disabled?: boolean;
  inactive?: boolean;
  isChatItem?: boolean;
  ripple?: boolean;
  shouldRenderLockIcon?: boolean;
  category?: CustomPeer;
  handleItemClick: (id: string) => void;
  renderCategory?: (category: CustomPeer) => TeactNode;
  renderChatInfo?: (id: string) => TeactNode;
  allowDisabledClick?: boolean;
  label?: TeactNode;
  subLabel?: string;
  type?: 'checkbox' | 'radio';
};

const ListItemWithOptions: FC<OwnProps> = ({
  key,
  isChecked,
  disabled,
  inactive,
  isChatItem,
  shouldRenderLockIcon,
  category,
  handleItemClick,
  ripple,
  renderCategory,
  renderChatInfo,
  allowDisabledClick,
  label,
  subLabel,
  type,
}) => {
  function renderInput() {
    if (inactive || disabled) {
      return undefined;
    }
    return type === 'checkbox' ? (
      <Checkbox
        label={label || ''}
        subLabel={subLabel}
        disabled={disabled}
        checked={isChecked}
      />
    ) : (
      <Radio
        label=""
        disabled={disabled}
        checked={isChecked}
      />
    );
  }

  return (
    <ListItem
      key={key}
      className={buildClassName('chat-item-clickable picker-list-item', isChatItem && 'chat-item')}
      disabled={disabled}
      inactive={inactive}
      allowDisabledClick={allowDisabledClick}
      secondaryIcon={shouldRenderLockIcon ? 'lock-badge' : undefined}
      // eslint-disable-next-line react/jsx-no-bind
      onClick={() => handleItemClick(key)}
      ripple={ripple}
    >
      {!isChatItem ? renderInput() : undefined}
      {category ? renderCategory?.(category) : renderChatInfo?.(key)}
      {isChatItem ? renderInput() : undefined}
    </ListItem>
  );
};

export default memo(ListItemWithOptions);
