import { useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';
import type { RegularLangKey } from '../../../types/language';
import type useWalletCredentials from './useWalletCredentials';
import type useWalletNavigation from './useWalletNavigation';
import { WalletScreen } from './types';

import { callApi } from '../../../api/gramjs';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';

// `isOwnExpected`: the phrase of the current wallet is typed to store it on this device; nothing is swapped
type ReplaceRequest = {
  fromAddress?: string;
  words?: string[];
  savedAddress?: string;
  shouldSaveCurrent?: boolean;
  isOwnExpected?: boolean;
};

type Options = {
  navigation: ReturnType<typeof useWalletNavigation>;
  credentials: ReturnType<typeof useWalletCredentials>;
  hasAppPasscode?: boolean;
  hasLocalSecret?: boolean;
  ownAddress?: string;
  ownPublicKey?: string;
  walletMnemonic?: TabState['walletMnemonic'];
  walletBackup?: TabState['walletBackup'];
  walletReplace?: TabState['walletReplace'];
};

export default function useWalletKeyFlows({
  navigation, credentials, hasAppPasscode, hasLocalSecret, ownAddress, ownPublicKey,
  walletMnemonic, walletBackup, walletReplace,
}: Options) {
  const {
    loadWalletMnemonic, clearWalletMnemonic, enableWalletBackup, disableWalletBackup, clearWalletBackup,
    replaceWallet, clearWalletReplace, keepWalletPhrase,
  } = getActions();

  const {
    screen, push, replace, back, reset: resetNavigation,
  } = navigation;
  const {
    intent: credentialIntent, start: startCredentials, run: runCredentials, ask: askCredentials, drop: dropCredentials,
  } = credentials;

  // Its presence also tells the phrase screen that the words bring in another wallet
  const [pendingReplace, setPendingReplace] = useState<ReplaceRequest | undefined>();

  // `address` is the wallet the typed words open instead, if they are a valid phrase at all
  const [wrongPhrase, setWrongPhrase] = useState<{ address?: string } | undefined>();
  const [isPhraseValidating, markPhraseValidating, unmarkPhraseValidating] = useFlag();
  const [phraseError, setPhraseError] = useState<RegularLangKey>();
  const phraseValidationIdRef = useRef(0);

  // A phrase check still on its way answers about the wrong wallet after a swap or a rotation, so it is dropped
  useEffect(() => {
    phraseValidationIdRef.current += 1;

    // The dropped answer no longer clears the spinner
    unmarkPhraseValidating();
  }, [ownAddress, ownPublicKey, unmarkPhraseValidating]);

  const handleShowPhrase = useLastCallback(() => {
    // A leftover of an earlier export must not pop the phrase before the credentials are asked
    clearWalletMnemonic();
    push(WalletScreen.PhraseInfo);
  });

  const handlePhraseInfoShow = useLastCallback(() => {
    clearWalletMnemonic();
    askCredentials({ intent: 'phrase', run: (entered) => loadWalletMnemonic(entered) });
  });

  const handleShowSavedPhrase = useLastCallback((savedAddress: string) => {
    clearWalletMnemonic();
    startCredentials({ intent: 'phrase', run: ({ passcode }) => loadWalletMnemonic({ passcode, savedAddress }) });
    push(WalletScreen.Passcode);
  });

  const handleEnableBackup = useLastCallback(() => {
    clearWalletBackup();

    if (hasLocalSecret) {
      startCredentials({ intent: 'enableBackup', run: (entered) => enableWalletBackup(entered) });
      push(WalletScreen.Passcode);
      return;
    }

    push(WalletScreen.EnterPhrase);
  });

  const handleEnterPhraseSubmit = useLastCallback(async (words: string[]) => {
    const shouldMatchOwn = !pendingReplace || pendingReplace.isOwnExpected;
    if (shouldMatchOwn && !ownAddress) return;

    const requestId = ++phraseValidationIdRef.current;
    markPhraseValidating();
    setPhraseError(undefined);

    const isValid = await callApi('validateWalletPhrase', {
      words,
      ownAddress: shouldMatchOwn ? ownAddress : undefined,
      ownPublicKey: shouldMatchOwn ? ownPublicKey : undefined,
    }).catch(() => false);
    const wrongAddress = !isValid && shouldMatchOwn
      ? await callApi('derivePhraseWalletAddress', { words }).catch(() => undefined) : undefined;
    if (requestId !== phraseValidationIdRef.current) return;

    unmarkPhraseValidating();

    if (!isValid) {
      if (shouldMatchOwn) {
        setWrongPhrase({ address: wrongAddress });
      } else {
        setPhraseError('WalletWrongPhraseError');
      }
      return;
    }

    if (pendingReplace?.isOwnExpected) {
      keepWalletPhrase({ words });
      return;
    }

    if (pendingReplace) {
      startReplace({ ...pendingReplace, words });
      return;
    }

    runCredentials({ intent: 'enableBackup', run: ({ password }) => enableWalletBackup({ words, password }) });
  });

  const handleEnterPhraseErrorClear = useLastCallback(() => {
    phraseValidationIdRef.current += 1;
    unmarkPhraseValidating();
    setPhraseError(undefined);

    if (walletReplace?.status === 'error') {
      clearWalletReplace();
    }

    if (walletBackup?.status === 'error') {
      clearWalletBackup();
    }
  });

  const handlePhraseDone = useLastCallback(() => {
    clearWalletMnemonic();
    dropCredentials();

    const settingsIndex = navigation.stack.lastIndexOf(WalletScreen.Settings);

    if (settingsIndex < 0) {
      resetNavigation();
      return;
    }

    for (let index = navigation.stack.length - 1; index > settingsIndex; index--) {
      back();
    }
  });

  const handleWrongPhraseClose = useLastCallback(() => {
    setWrongPhrase(undefined);
  });

  const handleImportOwnWallet = useLastCallback(() => {
    clearWalletReplace();
    setPendingReplace({ fromAddress: ownAddress, isOwnExpected: true });

    if (!hasAppPasscode) {
      push(WalletScreen.PasscodeRequired);
      return;
    }

    push(WalletScreen.EnterPhrase);
  });

  const disableBackupAddressRef = useRef<string>();
  const handleDisableBackup = useLastCallback(() => {
    if (walletBackup?.status === 'pending') return;

    disableBackupAddressRef.current = ownAddress;
    push(WalletScreen.DisableBackup);
  });

  // The phrase must stay on the device before the server backup goes, which only the app passcode can keep
  const handleConfirmDisableBackup = useLastCallback((shouldRotateKey: boolean) => {
    if (walletBackup?.status === 'pending') return;

    clearWalletBackup();
    clearWalletMnemonic();

    if (!hasAppPasscode) {
      // Replacing keeps one `back` between the notice and the keys list
      replace(WalletScreen.PasscodeRequired);
      return;
    }

    runCredentials({
      intent: 'disableBackup',
      run: ({ password }) => disableWalletBackup({
        fromAddress: disableBackupAddressRef.current!, shouldRotateKey, password,
      }),
    });
  });

  const handleDeleteWallet = useLastCallback(() => {
    clearWalletReplace();
    setPendingReplace({ fromAddress: ownAddress });
    push(WalletScreen.DeleteWallet);
  });

  const handleDeleteConfirm = useLastCallback((shouldSaveCurrent: boolean) => {
    if (shouldSaveCurrent && !hasAppPasscode) {
      push(WalletScreen.PasscodeRequired);
      return;
    }

    if (pendingReplace?.savedAddress) {
      startReplace({ ...pendingReplace, shouldSaveCurrent });
      return;
    }

    setPendingReplace({ ...pendingReplace, shouldSaveCurrent });

    // Replacing keeps one `back` between the choice and the keys list
    replace(WalletScreen.ReplaceWallet);
  });

  const startReplace = useLastCallback((request: ReplaceRequest) => {
    setPendingReplace(request);

    const isLocalKeyNeeded = Boolean(request.shouldSaveCurrent || request.savedAddress || request.words);

    if (isLocalKeyNeeded && !hasAppPasscode) {
      push(WalletScreen.PasscodeRequired);
      return;
    }

    runCredentials({
      intent: 'replace',
      run: ({ password }) => replaceWallet({ ...request, fromAddress: request.fromAddress ?? ownAddress!, password }),
    });
  });

  const handleReplaceCreate = useLastCallback(() => {
    startReplace(pendingReplace!);
  });

  const handleReplaceImport = useLastCallback(() => {
    if (!hasAppPasscode) {
      push(WalletScreen.PasscodeRequired);
      return;
    }

    push(WalletScreen.EnterPhrase);
  });

  const handleImportSavedWallet = useLastCallback((savedAddress: string) => {
    clearWalletReplace();
    setPendingReplace({ fromAddress: ownAddress, savedAddress });
    push(WalletScreen.DeleteWallet);
  });

  const handleBack = useLastCallback(() => {
    // A late export answer would park the words in the tab state
    if (screen === WalletScreen.Phrase || screen === WalletScreen.PhraseInfo) {
      clearWalletMnemonic();
    }

    if (screen === WalletScreen.EnterPhrase) {
      handleEnterPhraseErrorClear();
      clearWalletBackup();
      clearWalletReplace();
    }

    // The own-phrase import starts from the main screen, so no earlier screen keeps its request
    const isOwnImportScreen = screen === WalletScreen.EnterPhrase || screen === WalletScreen.PasscodeRequired;

    if (isOwnImportScreen && pendingReplace?.isOwnExpected) {
      setPendingReplace(undefined);
    }

    if (screen === WalletScreen.DeleteWallet || screen === WalletScreen.ReplaceWallet) {
      dropCredentials();
      setPendingReplace(undefined);
    }
  });

  const reset = useLastCallback(() => {
    phraseValidationIdRef.current += 1;
    unmarkPhraseValidating();
    setPhraseError(undefined);
    setPendingReplace(undefined);
    setWrongPhrase(undefined);
  });

  // The intent check keeps a stale export from replacing a credential screen of an unrelated flow
  useEffect(() => {
    if (walletMnemonic?.status !== 'ready') return;

    const isOnCredentialScreen = screen === WalletScreen.Password || screen === WalletScreen.Passcode;

    if (credentialIntent === 'phrase' && isOnCredentialScreen) {
      dropCredentials();
      replace(WalletScreen.Phrase);
    } else if (credentialIntent === 'disableBackup' && isOnCredentialScreen) {
      // The password screen sits over the warning; both make way for the phrase
      dropCredentials();
      back();
      replace(WalletScreen.Phrase);
    } else if (screen === WalletScreen.PhraseInfo) {
      push(WalletScreen.Phrase);
    } else if (screen === WalletScreen.DisableBackup) {
      replace(WalletScreen.Phrase);
    }
  }, [walletMnemonic?.status, screen, credentialIntent, dropCredentials, replace, push, back]);

  useEffect(() => {
    if (walletReplace?.status !== 'done') return;

    clearWalletReplace();
    setPendingReplace(undefined);
    dropCredentials();
    resetNavigation();
  }, [walletReplace?.status, dropCredentials, resetNavigation]);

  // Only a backup turned on pops a screen, so a success landing mid-navigation does not pop an unrelated one
  useEffect(() => {
    if (walletBackup?.status !== 'done') return;

    clearWalletBackup();

    // A backup turned off leaves its screens to the phrase effect above
    if (credentialIntent === 'disableBackup') return;

    dropCredentials();

    if (screen === WalletScreen.Password || screen === WalletScreen.EnterPhrase || screen === WalletScreen.Passcode) {
      back();
    }
  }, [walletBackup?.status, screen, credentialIntent, dropCredentials, back]);

  return {
    pendingReplace,
    isPhraseValidating,
    phraseError,
    wrongPhrase,
    handleWrongPhraseClose,
    handleImportOwnWallet,
    handlePhraseDone,
    handleShowPhrase,
    handlePhraseInfoShow,
    handleShowSavedPhrase,
    handleEnableBackup,
    handleEnterPhraseSubmit,
    handleEnterPhraseErrorClear,
    handleDisableBackup,
    handleConfirmDisableBackup,
    handleDeleteWallet,
    handleDeleteConfirm,
    handleReplaceCreate,
    handleReplaceImport,
    handleImportSavedWallet,
    handleBack,
    reset,
  };
}
