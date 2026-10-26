import { memo, useMemo, useState } from '../../../lib/teact/teact';
import { getActions, getPromiseActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { RegularLangKey } from '../../../types/language';

import { getUserFullName } from '../../../global/helpers';
import { selectIsCurrentUserPremium, selectUser } from '../../../global/selectors';
import {
  isUsernameValid, MAX_USERNAME_LENGTH, MIN_UPDATE_USERNAME_LENGTH,
} from '../../../util/entities/username';
import { callApi } from '../../../api/gramjs';

import useAsync from '../../../hooks/useAsync';
import useDebouncedMemo from '../../../hooks/useDebouncedMemo';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Link from '../../ui/Link';
import Spinner from '../../ui/Spinner';
import Transition from '../../ui/Transition';
import Island, { IslandDescription } from '@gili/layout/Island';
import Modal, { ModalCloseButton, ModalHeader } from '@gili/modal/Modal';

import styles from './BotCreationModal.module.scss';

export type OwnProps = {
  modal: NonNullable<TabState['botCreationModal']>;
  isOpen: boolean;
};

type StateProps = {
  manager?: ApiUser;
  botAllowedSuffixes?: string[];
  isPremium?: boolean;
};

enum UsernameStatus {
  None,
  Checking,
  Available,
  Error,
}

const AVATAR_SIZE = 80;
const MAX_NAME_LENGTH = 64;
const USERNAME_CHECK_DEBOUNCE = 200;
const BOT_USERNAME_SUFFIX = 'bot';
const USERNAME_ERROR_KEYS: Record<string, RegularLangKey> = {
  USERNAME_OCCUPIED: 'UsernameInUse',
  USERNAME_INVALID: 'UsernameInvalid',
  USERNAME_SUFFIX_MISSING: 'CreateBotUsernameSuffix',
};

const BotCreationModal = ({
  modal, isOpen, manager, botAllowedSuffixes, isPremium,
}: OwnProps & StateProps) => {
  const { closeBotCreationModal, openPremiumModal, openChatWithInfo } = getActions();
  const { createBot } = getPromiseActions();

  const lang = useLang();

  const [name, setName] = useState(modal.suggestedName?.slice(0, MAX_NAME_LENGTH) || '');
  const premiumSuffixes = botAllowedSuffixes || [];
  const [username, setUsername] = useState(() => getSuggestedUsername(modal.suggestedUsername, premiumSuffixes));
  const [isCreating, markCreating, unmarkCreating] = useFlag();

  const usernameSuffix = findUsernameSuffix(username, premiumSuffixes);
  const premiumSuffix = !isPremium && usernameSuffix !== BOT_USERNAME_SUFFIX ? usernameSuffix : undefined;
  const localErrorKey = getLocalUsernameErrorKey();
  const canCheckUsername = Boolean(username && !localErrorKey && usernameSuffix && !premiumSuffix);

  const debouncedUsername = useDebouncedMemo(
    () => (canCheckUsername ? username : undefined), USERNAME_CHECK_DEBOUNCE, [canCheckUsername, username],
  );
  const { result: lastCheck, error: checkError } = useAsync(async () => {
    if (!debouncedUsername) return undefined;

    const response = await callApi('checkBotUsername', { username: debouncedUsername });
    return { username: debouncedUsername, ...response };
  }, [debouncedUsername]);

  const usernameCheck = lastCheck?.username === username ? lastCheck : undefined;
  const hasCheckFailed = Boolean(checkError) && debouncedUsername === username;

  const handleClose = useLastCallback(() => {
    closeBotCreationModal();
  });

  const handleNameChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.currentTarget.value);
  });

  const handleUsernameChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.currentTarget.value.trim());
  });

  const handlePremiumClick = useLastCallback(() => {
    closeBotCreationModal();
    openPremiumModal();
  });

  const handleManagerClick = useLastCallback(() => {
    closeBotCreationModal();
    openChatWithInfo({ id: modal.managerId });
  });

  const handleSubmit = useLastCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    markCreating();
    try {
      await createBot({ name: name.trim(), username });
    } finally {
      unmarkCreating();
    }
  });

  const usernameError = renderUsernameError();
  const usernameStatus = getUsernameStatus();
  const canSubmit = Boolean(name.trim() && usernameStatus === UsernameStatus.Available && !isCreating);

  const header = useMemo(() => (
    <ModalHeader>
      <ModalCloseButton />
    </ModalHeader>
  ), []);

  function getLocalUsernameErrorKey() {
    if (username.length < MIN_UPDATE_USERNAME_LENGTH) return 'UsernameShort';
    if (username.length > MAX_USERNAME_LENGTH) return 'UsernameLong';
    if (!isUsernameValid(username, true)) return 'UsernameInvalid';
    return undefined;
  }

  function renderUsernameError() {
    if (!username) return undefined;
    if (localErrorKey) return lang(localErrorKey);
    if (!usernameSuffix) return premiumSuffixes.length ? renderUsernameHint() : lang('CreateBotUsernameSuffix');
    if (premiumSuffix) {
      return lang('CreateBotUsernamePremium', {
        suffix: premiumSuffix,
        link: (
          <Link isPrimary onClick={handlePremiumClick}>
            {lang('CreateBotUsernameSubscribe')}
            <Icon name="next" className={styles.subscribeIcon} />
          </Link>
        ),
      }, { withNodes: true });
    }
    if (modal.occupiedUsername === username) return lang('UsernameInUse');
    if (hasCheckFailed) return lang('SomethingWentWrong');
    if (!usernameCheck || usernameCheck.result) return undefined;
    return lang(usernameCheck.error ? USERNAME_ERROR_KEYS[usernameCheck.error] : 'UsernameInUse');
  }

  function getUsernameStatus() {
    if (!username) return UsernameStatus.None;
    if (usernameError) return UsernameStatus.Error;
    return usernameCheck?.result ? UsernameStatus.Available : UsernameStatus.Checking;
  }

  function renderUsernameStatus() {
    switch (usernameStatus) {
      case UsernameStatus.Checking:
        return (
          <div className={styles.checking}>
            <Spinner className={styles.spinner} color="gray" />
            {lang('CreateBotUsernameChecking')}
          </div>
        );
      case UsernameStatus.Available:
        return (
          <div className={styles.available}>
            {lang('UsernameAvailable', { username })}
          </div>
        );
      case UsernameStatus.Error:
        return <div className={styles.error}>{usernameError}</div>;
      default:
        return <div>{renderUsernameHint()}</div>;
    }
  }

  function renderUsernameHint() {
    if (!premiumSuffixes.length) return lang('CreateBotUsernameHelp');

    return lang('CreateBotUsernameHint', {
      suffixes: lang.disjunction(premiumSuffixes.map((suffix) => `'${suffix}'`)),
      premium: <Link isPrimary onClick={handlePremiumClick}>{lang('TelegramPremium')}</Link>,
    }, { withNodes: true });
  }

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      width="slim"
      height="auto"
      ariaLabel={lang('CreateBotTitle')}
      dialogClassName={styles.modal}
      onClose={handleClose}
    >
      <form action="" onSubmit={handleSubmit}>
        <Avatar className={styles.avatar} peer={manager} size={AVATAR_SIZE} />
        <div className={styles.title}>{lang('CreateBotTitle')}</div>
        <div className={styles.description}>
          {lang('CreateBotText', {
            bot: <Link isPrimary onClick={handleManagerClick}>{getUserFullName(lang, manager)}</Link>,
          }, { withNodes: true })}
        </div>
        <Island className={styles.island}>
          <InputText
            value={name}
            label={lang('CreateBotName')}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            teactExperimentControlled
            onChange={handleNameChange}
          />
          <InputText
            value={username}
            label={lang('CreateBotUsername')}
            maxLength={MAX_USERNAME_LENGTH}
            noMargin
            teactExperimentControlled
            onChange={handleUsernameChange}
          />
        </Island>
        <IslandDescription>
          <Transition
            name="fade"
            className={styles.statusTransition}
            activeKey={usernameStatus}
            shouldCleanup
          >
            {renderUsernameStatus()}
          </Transition>
        </IslandDescription>
        <Button className={styles.submitButton} type="submit" disabled={!canSubmit} isLoading={isCreating}>
          {lang('Create')}
        </Button>
      </form>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    return {
      manager: selectUser(global, modal.managerId),
      botAllowedSuffixes: global.appConfig.botAllowedSuffixes,
      isPremium: selectIsCurrentUserPremium(global),
    };
  },
)(BotCreationModal));

function findUsernameSuffix(username: string, premiumSuffixes: string[]) {
  const lowerUsername = username.toLowerCase();
  return [BOT_USERNAME_SUFFIX, ...premiumSuffixes].find((suffix) => lowerUsername.endsWith(suffix));
}

function getSuggestedUsername(suggestedUsername: string | undefined, premiumSuffixes: string[]) {
  if (!suggestedUsername || findUsernameSuffix(suggestedUsername, premiumSuffixes)) return suggestedUsername || '';
  return `${suggestedUsername}${BOT_USERNAME_SUFFIX}`;
}
