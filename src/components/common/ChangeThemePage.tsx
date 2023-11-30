/* eslint-disable no-console */
import React from 'react';
import { Command } from 'cmdk';
import { type FC } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ISettings, ThemeKey } from '../../types';

import { getSystemTheme } from '../../util/systemTheme';

interface FolderPageProps {
  theme?: ISettings['theme'];
  shouldUseSystemTheme?: boolean;
  close: () => void;
  setInputValue: (value: string) => void;
}

const ChangeThemePage: FC<FolderPageProps> = ({
  close, theme, shouldUseSystemTheme, setInputValue,
}) => {
  const { setSettingOption, showNotification } = getActions();
  console.log('ChangeThemePage rendered');
  setInputValue('');

  const handleThemeChange = (themeChoice: ThemeKey | 'auto') => () => {
    const newTheme = themeChoice === 'auto' ? getSystemTheme() : themeChoice;
    setSettingOption({ theme: newTheme });
    setSettingOption({ shouldUseSystemTheme: themeChoice === 'auto' });
    close();
    showNotification({ message: `Theme changed to ${themeChoice}` });
  };

  const selectedTheme = shouldUseSystemTheme ? 'auto' : theme;

  return (
    <Command.Group>
      {(['auto', 'light', 'dark'] as (ThemeKey | 'auto')[]).map((themeOption) => (
        <Command.Item key={themeOption} onSelect={handleThemeChange(themeOption)}>
          <span>
            {
              themeOption === 'auto' ? 'System preference' : themeOption.charAt(0).toUpperCase() + themeOption.slice(1)
            } {themeOption !== 'auto' && 'theme'}
          </span>
          {selectedTheme === themeOption && <i className="icon icon-check" cmdk-selected="" />}
        </Command.Item>
      ))}
    </Command.Group>
  );
};

export default (ChangeThemePage);
