/* eslint-disable react/no-array-index-key */
import React from 'react';
import { Command } from 'cmdk';

import LinearLogo from './HomePage/LinearLogo.svg';

interface CommandMenuListItemProps {
  onSelect: () => void;
  value?: string;
  label?: string;
  icon?: React.ReactNode;
  content?: React.ReactNode;
  shortcut?: string[];
}

const CommandMenuListItem: React.FC<CommandMenuListItemProps> = React.memo(({
  onSelect,
  content,
  value,
  shortcut,
  icon,
  label,
}) => {
  let iconElement;
  if (icon === 'linear') {
    iconElement = <img src={LinearLogo} alt="linear" />;
  } else {
    iconElement = <i className={`icon icon-${icon}`} />;
  }

  if (!content && label && icon) {
    content = (
      <>
        {iconElement}
        <span>{label}</span>
      </>
    );
  }

  return (
    <Command.Item value={value} onSelect={onSelect}>
      {content}
      {shortcut && (
        <span className="shortcuts">
          {shortcut.map((key, index) => (
            <span key={index} className="kbd">{key}</span>
          ))}
        </span>
      )}
    </Command.Item>
  );
});

export default CommandMenuListItem;
