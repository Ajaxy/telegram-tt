/* eslint-disable no-console */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
import type { FC } from '../../../../lib/teact/teact';
import { useCallback } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { FAQ_URL, SHORTCUTS_URL } from '../../../../config';

import CommandMenuListItem from '../CommanMenuListItem';

import '../../../main/CommandMenu.scss';

interface HelpGroupProps {
  close: () => void;
}

const HelpGroup: FC<HelpGroupProps> = ({
  close,
}) => {
  const {
    openUrl, openChatByUsername,
  } = getActions();

  const handleFAQ = useCallback(() => {
    openUrl({
      url: FAQ_URL,
      shouldSkipModal: true,
    });
    close();
  }, [openUrl, close]);

  const handleOpenShortcuts = useCallback(() => {
    openUrl({
      url: SHORTCUTS_URL,
      shouldSkipModal: true,
    });
    close();
  }, [openUrl, close]);

  const handleSupport = useCallback(() => {
    openChatByUsername({ username: 'ulugmer' });
    close();
  }, [openChatByUsername, close]);

  const menuItems = [
    {
      onSelect: handleFAQ,
      icon: 'document',
      label: 'Help center',
    },
    {
      onSelect: handleOpenShortcuts,
      label: 'Keyboard shortcuts',
      icon: 'keyboard',
    },
    {
      onSelect: handleSupport,
      label: 'Send feedback',
      icon: 'ask-support',
    },
    {
      onSelect: handleSupport,
      label: 'Request feature',
      icon: 'animations',

    },
    {
      onSelect: handleSupport,
      label: 'Report bug',
      icon: 'bug',
    },
    {
      onSelect: handleSupport,
      label: 'Contact support',
      icon: 'help',
    },
  ];

  return (
    <Command.Group heading="Help">
      {menuItems.map((item, index) => (
        <CommandMenuListItem
          key={index}
          onSelect={item.onSelect}
          label={item.label}
          icon={item.icon}
        />
      ))}
    </Command.Group>
  );
};

export default HelpGroup;
