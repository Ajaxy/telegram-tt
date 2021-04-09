import { ChangeEvent } from 'react';
import React, {
  FC, useState, useCallback, memo, useEffect, useMemo,
} from '../../lib/teact/teact';

import { debounce } from '../../util/schedulers';
import useLang from '../../hooks/useLang';

import InputText from '../ui/InputText';

type OwnProps = {
  currentUsername?: string;
  asLink?: boolean;
  isLoading?: boolean;
  isUsernameAvailable?: boolean;
  checkUsername: AnyToVoidFunction;
  onChange: (value: string | false) => void;
};

const MIN_USERNAME_LENGTH = 5;
const MAX_USERNAME_LENGTH = 32;
const LINK_PREFIX = 'https://t.me/';
const LINK_PREFIX_REGEX = /https:\/\/t\.me\/?/i;
const USERNAME_REGEX = /^([a-zA-Z0-9_]+)$/;

const runDebouncedForCheckUsername = debounce((cb) => cb(), 250, false);

function isUsernameValid(username: string) {
  return username.length >= MIN_USERNAME_LENGTH
    && username.length <= MAX_USERNAME_LENGTH
    && USERNAME_REGEX.test(username);
}

const SettingsEditProfile: FC<OwnProps> = ({
  currentUsername,
  asLink,
  isLoading,
  isUsernameAvailable,
  checkUsername,
  onChange,
}) => {
  const [username, setUsername] = useState(currentUsername || '');

  const lang = useLang();
  const langPrefix = asLink ? 'SetUrl' : 'Username';
  const label = asLink ? lang('SetUrlPlaceholder') : lang('Username');

  const [usernameSuccess, usernameError] = useMemo(() => {
    if (!username.length) {
      return [];
    }

    if (username.length < MIN_USERNAME_LENGTH) {
      return [undefined, `${label} is too short`];
    }
    if (username.length > MAX_USERNAME_LENGTH) {
      return [undefined, `${label} is too long`];
    }
    if (!USERNAME_REGEX.test(username)) {
      return [undefined, `${label} contains invalid characters`];
    }

    if (isUsernameAvailable === undefined) {
      return [];
    }

    // Variable `isUsernameAvailable` is initialized with `undefined`, so a strict false check is required
    return [
      isUsernameAvailable ? lang(`${langPrefix}Available`, 'Username') : undefined,
      isUsernameAvailable === false ? lang(`${langPrefix}InUse`) : undefined,
    ];
  }, [username, isUsernameAvailable, lang, langPrefix, label]);

  useEffect(() => {
    setUsername(currentUsername || '');
  }, [asLink, currentUsername]);

  const handleUsernameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value.trim().replace(LINK_PREFIX_REGEX, '');
    setUsername(newUsername);
    e.target.value = `${asLink ? LINK_PREFIX : ''}${newUsername}`;

    const isValid = isUsernameValid(newUsername);

    if (isValid) {
      runDebouncedForCheckUsername(() => {
        checkUsername({ username: newUsername });
      });
    }

    if (onChange) {
      onChange(isValid ? newUsername : false);
    }
  }, [asLink, checkUsername, onChange]);

  return (
    <InputText
      value={`${asLink ? LINK_PREFIX : ''}${username}`}
      onChange={handleUsernameChange}
      label={label}
      error={usernameError}
      success={usernameSuccess}
      readOnly={isLoading}
    />
  );
};

export default memo(SettingsEditProfile);
