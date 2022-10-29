import React, {
  useState, useCallback, memo, useEffect, useMemo,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FC } from '../../lib/teact/teact';

import { TME_LINK_PREFIX } from '../../config';
import { debounce } from '../../util/schedulers';

import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';

import InputText from '../ui/InputText';

type OwnProps = {
  currentUsername?: string;
  asLink?: boolean;
  isLoading?: boolean;
  isUsernameAvailable?: boolean;
  checkedUsername?: string;
  onChange: (value: string | false) => void;
};

const MIN_USERNAME_LENGTH = 5;
const MAX_USERNAME_LENGTH = 32;
const LINK_PREFIX_REGEX = /https:\/\/t\.me\/?/i;
const USERNAME_REGEX = /^[^\d]([a-zA-Z0-9_]+)$/;

const runDebouncedForCheckUsername = debounce((cb) => cb(), 250, false);

function isUsernameValid(username: string) {
  return username.length >= MIN_USERNAME_LENGTH
    && username.length <= MAX_USERNAME_LENGTH
    && USERNAME_REGEX.test(username);
}

const UsernameInput: FC<OwnProps> = ({
  currentUsername,
  asLink,
  isLoading,
  isUsernameAvailable,
  checkedUsername,
  onChange,
}) => {
  const { checkUsername, checkPublicLink } = getActions();
  const [username, setUsername] = useState(currentUsername || '');

  const lang = useLang();
  const langPrefix = asLink ? 'SetUrl' : 'Username';
  const label = asLink ? lang('SetUrlPlaceholder') : lang('Username');

  const previousIsUsernameAvailable = usePrevious(isUsernameAvailable);
  const renderingIsUsernameAvailable = currentUsername !== username
    ? (isUsernameAvailable ?? previousIsUsernameAvailable) : undefined;
  const isChecking = username && currentUsername !== username && checkedUsername !== username;

  const [usernameSuccess, usernameError] = useMemo(() => {
    if (!username.length) {
      return [];
    }

    if (username.length < MIN_USERNAME_LENGTH) {
      return [undefined, lang(`${langPrefix}InvalidShort`)];
    }
    if (username.length > MAX_USERNAME_LENGTH) {
      return [undefined, lang(`${langPrefix}InvalidLong`)];
    }
    if (!USERNAME_REGEX.test(username)) {
      return [undefined, lang(`${langPrefix}Invalid`)];
    }

    if (renderingIsUsernameAvailable === undefined || isChecking) {
      return [];
    }

    // Variable `isUsernameAvailable` is initialized with `undefined`, so a strict false check is required
    return [
      renderingIsUsernameAvailable ? lang(`${langPrefix}Available`, label) : undefined,
      renderingIsUsernameAvailable === false ? lang(`${langPrefix}InUse`) : undefined,
    ];
  }, [username, renderingIsUsernameAvailable, isChecking, lang, langPrefix, label]);

  useEffect(() => {
    setUsername(currentUsername || '');
  }, [asLink, currentUsername]);

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value.trim().replace(LINK_PREFIX_REGEX, '');
    setUsername(newUsername);

    const isValid = isUsernameValid(newUsername);
    if (!isValid) return;

    onChange?.(newUsername);

    runDebouncedForCheckUsername(() => {
      if (newUsername !== currentUsername) {
        const check = asLink ? checkPublicLink : checkUsername;
        check({ username: newUsername });
      }
    });
  }, [asLink, checkPublicLink, checkUsername, currentUsername, onChange]);

  return (
    <InputText
      value={`${asLink ? TME_LINK_PREFIX : ''}${username}`}
      onChange={handleUsernameChange}
      label={isChecking ? lang('Checking') : label}
      error={usernameError}
      success={usernameSuccess}
      readOnly={isLoading}
      teactExperimentControlled
    />
  );
};

export default memo(UsernameInput);
