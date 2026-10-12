import { useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';
import type { PasswordIntent } from './types';
import type useWalletNavigation from './useWalletNavigation';
import { WalletScreen } from './types';

import useLastCallback from '../../../hooks/useLastCallback';

type WalletCredentials = {
  password?: string;
  passcode?: string;
};

type CredentialRequest = {
  intent: PasswordIntent;
  run: (credentials: WalletCredentials) => void;
};

type CredentialFlows = Pick<
  TabState, 'walletTransfer' | 'walletMnemonic' | 'walletBackup' | 'walletReplace' | 'walletCommentDecryption'
  | 'walletTonConnect'
>;

type Options = CredentialFlows & {
  navigation: ReturnType<typeof useWalletNavigation>;
  hasLocalSecret?: boolean;
};

type ClearAction = 'clearWalletTransfer' | 'clearWalletCommentDecryption' | 'clearWalletBackup' | 'clearWalletReplace'
  | 'clearWalletMnemonic' | 'clearWalletTonConnectError';

const FLOWS_BY_INTENT: Record<PasswordIntent, { flowKey: keyof CredentialFlows; clearAction: ClearAction }> = {
  send: { flowKey: 'walletTransfer', clearAction: 'clearWalletTransfer' },
  decrypt: { flowKey: 'walletCommentDecryption', clearAction: 'clearWalletCommentDecryption' },
  enableBackup: { flowKey: 'walletBackup', clearAction: 'clearWalletBackup' },
  disableBackup: { flowKey: 'walletBackup', clearAction: 'clearWalletBackup' },
  replace: { flowKey: 'walletReplace', clearAction: 'clearWalletReplace' },
  phrase: { flowKey: 'walletMnemonic', clearAction: 'clearWalletMnemonic' },
  tonConnect: { flowKey: 'walletTonConnect', clearAction: 'clearWalletTonConnectError' },
};

// The cloud password is never asked up front: every request first runs without it, and only a
// `PASSWORD_MISSING` answer opens the password screen and runs the request again with it
export default function useWalletCredentials({
  navigation, hasLocalSecret,
  walletTransfer, walletMnemonic, walletBackup, walletReplace, walletCommentDecryption, walletTonConnect,
}: Options) {
  const {
    clearWalletTransfer, clearWalletMnemonic, clearWalletCommentDecryption, clearWalletBackup, clearWalletReplace,
  } = getActions();

  const {
    screen, stack, push, replace,
  } = navigation;

  const [intent, setIntent] = useState<PasswordIntent | undefined>();

  // Only run, never rendered, so a ref is enough
  const requestRef = useRef<CredentialRequest | undefined>();

  // A password asked for later joins the passcode already entered
  const enteredRef = useRef<WalletCredentials>({});

  // A phrase kept on the device signs directly, even when the server could export it too
  const shouldUseLocalKey = Boolean(hasLocalSecret);

  const flows: CredentialFlows = {
    walletTransfer, walletMnemonic, walletBackup, walletReplace, walletCommentDecryption, walletTonConnect,
  };
  const flow = intent ? flows[FLOWS_BY_INTENT[intent].flowKey] : undefined;

  const runRequest = useLastCallback((credentials: WalletCredentials) => {
    enteredRef.current = credentials;
    requestRef.current!.run(credentials);
  });

  const start = useLastCallback((request: CredentialRequest) => {
    requestRef.current = request;
    enteredRef.current = {};
    setIntent(request.intent);
  });

  const run = useLastCallback((request: CredentialRequest) => {
    start(request);
    runRequest({});
  });

  const ask = useLastCallback((request: CredentialRequest) => {
    if (!shouldUseLocalKey) {
      run(request);
      return;
    }

    start(request);
    push(WalletScreen.Passcode);
  });

  const drop = useLastCallback(() => {
    requestRef.current = undefined;
    enteredRef.current = {};
    setIntent(undefined);
  });

  const clearFlows = useLastCallback(() => {
    clearWalletTransfer();
    clearWalletMnemonic();
    clearWalletCommentDecryption();
    clearWalletBackup();
    clearWalletReplace();
  });

  const reset = useLastCallback(() => {
    drop();
    clearFlows();
  });

  // The way back to the phrase screen of a swap keeps the request, with the words typed for it
  const handleBack = useLastCallback(() => {
    if (screen !== WalletScreen.Password && screen !== WalletScreen.Passcode) return;

    const isBackToImport = intent === 'replace' && stack[stack.length - 2] === WalletScreen.EnterPhrase;

    if (!isBackToImport) {
      requestRef.current = undefined;
      setIntent(undefined);
    }

    enteredRef.current = {};
    clearFlows();
  });

  const handlePasswordSubmit = useLastCallback((password: string) => {
    runRequest({ ...enteredRef.current, password });
  });

  const handlePasscodeSubmit = useLastCallback((passcode: string) => {
    runRequest({ ...enteredRef.current, passcode });
  });

  const handlePasswordErrorClear = useLastCallback(() => {
    if (!intent) return;

    getActions()[FLOWS_BY_INTENT[intent].clearAction]();
  });

  // A screen that has done its part (the passcode passed, the phrase typed for a backup) is replaced;
  // an import keeps its phrase screen underneath, since the swap can still be backed out of
  const isPasswordDemanded = flow?.status === 'error' && flow.error === 'PASSWORD_MISSING';

  useEffect(() => {
    if (!isPasswordDemanded || !intent || !requestRef.current || screen === WalletScreen.Password) return;

    getActions()[FLOWS_BY_INTENT[intent].clearAction]();

    const isPhraseSpent = screen === WalletScreen.EnterPhrase && intent === 'enableBackup';

    if (screen === WalletScreen.Passcode || isPhraseSpent) {
      replace(WalletScreen.Password);
    } else {
      push(WalletScreen.Password);
    }
  }, [isPasswordDemanded, intent, screen, push, replace]);

  // A passcode refused after the cloud password was entered is retyped on its own screen, with the error there
  const isPasscodeRefused = flow?.status === 'error'
    && (flow.error === 'PASSCODE_INVALID' || flow.error === 'PASSCODE_LOCKED');

  useEffect(() => {
    if (screen !== WalletScreen.Password || !enteredRef.current.passcode || !isPasscodeRefused) return;

    replace(WalletScreen.Passcode);
  }, [screen, isPasscodeRefused, replace]);

  return {
    intent,
    flow,
    start,
    run,
    ask,
    drop,
    reset,
    handleBack,
    handlePasswordSubmit,
    handlePasscodeSubmit,
    handlePasswordErrorClear,
  };
}
