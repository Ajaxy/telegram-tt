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

  return (
    <Command.Group heading="Help">
      <Command.Item onSelect={handleFAQ}>
        <i className="icon icon-document" /><span>Help center</span>
      </Command.Item>
      <Command.Item onSelect={handleOpenShortcuts}>
        <i className="icon icon-keyboard" /><span>Keyboard shortcuts</span>
      </Command.Item>
      <Command.Item onSelect={handleSupport}>
        <i className="icon icon-ask-support" /><span>Send feedback</span>
      </Command.Item>
      <Command.Item onSelect={handleSupport}>
        <i className="icon icon-animations" /><span>Request feature</span>
      </Command.Item>
      <Command.Item onSelect={handleSupport}>
        <i className="icon icon-bug" /><span>Report bug</span>
      </Command.Item>
      <Command.Item onSelect={handleSupport}>
        <i className="icon icon-help" /><span>Contact support</span>
      </Command.Item>
    </Command.Group>
  );
};

export default HelpGroup;
