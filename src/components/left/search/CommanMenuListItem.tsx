import React from 'react';
import { Command } from 'cmdk';

interface CommandMenuListItemProps {
  onSelect: () => void;
  content: React.ReactNode;
  value: string;
}

const CommandMenuListItem: React.FC<CommandMenuListItemProps> = React.memo(({ onSelect, content, value }) => {
  return (
    <Command.Item value={value} onSelect={onSelect}>
      {content}
    </Command.Item>
  );
});

export default CommandMenuListItem;
