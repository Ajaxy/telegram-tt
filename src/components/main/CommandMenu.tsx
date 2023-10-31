import React from 'react';
import { Command } from 'cmdk';
import { useEffect, useState } from '../../lib/teact/teact';

const CommandMenu = () => {
  const [open, setOpen] = useState(false);

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // eslint-disable-next-line no-console
      console.log(e);
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
        // eslint-disable-next-line @typescript-eslint/no-shadow
        setOpen((open: boolean) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Command.Dialog open={true || open} onOpenChange={setOpen} label="Global Command Menu">
      <Command.Input />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        <Command.Group heading="Letters">
          <Command.Item>a</Command.Item>
          <Command.Item>b</Command.Item>
          <Command.Separator />
          <Command.Item>c</Command.Item>
        </Command.Group>

        <Command.Item>Apple</Command.Item>
      </Command.List>
    </Command.Dialog>
  );
};

export default CommandMenu;
