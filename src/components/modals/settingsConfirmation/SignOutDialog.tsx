import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getPromiseActions } from '../../../global';

import {
  selectHasLocalOnlyWalletPhrase, selectIsWalletAvailable, selectIsWalletKeyRotationPending,
  selectWalletLocalOnlyNanos, selectWalletSavedWallets,
} from '../../../global/selectors';
import { formatTonAsIcon, formatTonNumber } from '../../../util/localization/format';
import { pause } from '../../../util/schedulers';

import useSelector from '../../../hooks/data/useSelector';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

const WALLET_CHECK_TIMEOUT = 10000;

const SignOutDialog = ({ isOpen, onClose }: OwnProps) => {
  const { signOut } = getActions();

  const lang = useLang();
  const [isWalletCheckDone, markWalletCheckDone, unmarkWalletCheckDone] = useFlag();
  const [isWalletCheckTimedOut, setIsWalletCheckTimedOut] = useState(false);
  const walletCheckIdRef = useRef(0);
  const isWalletAvailable = useSelector(selectIsWalletAvailable);
  const hasLocalOnlyWalletPhrase = useSelector(selectHasLocalOnlyWalletPhrase);
  const localOnlyWalletNanos = useSelector(selectWalletLocalOnlyNanos);
  const savedWallets = useSelector(selectWalletSavedWallets);
  const isKeyRotationPending = useSelector(selectIsWalletKeyRotationPending);
  const unbackedWalletNanos = useMemo(() => (
    savedWallets?.reduce((sum, { balance }) => sum + (balance ?? 0n), localOnlyWalletNanos) ?? localOnlyWalletNanos
  ), [savedWallets, localOnlyWalletNanos]);
  // A wallet without Grams may still hold collectibles, which are not loaded here, so any wallet whose keys are
  // only on this device is warned about, as in Telegram Desktop
  const hasUnbackedWallet = isWalletAvailable && (hasLocalOnlyWalletPhrase || Boolean(savedWallets?.length));
  const isKeyRotationWarned = isWalletAvailable && (isKeyRotationPending || isWalletCheckTimedOut);

  // Until the checks answer, the dialog would offer a logout that deletes the local phrases, so the button waits,
  // but no longer than `WALLET_CHECK_TIMEOUT` in case a check stalls
  const checkWallets = useLastCallback(async () => {
    const checkId = ++walletCheckIdRef.current;
    const { loadWalletState, loadSavedWallets, loadWalletKeyRotationPending } = getPromiseActions();

    const isChecked = await Promise.race([
      (async () => {
        await loadWalletState();
        await Promise.all([loadSavedWallets(), loadWalletKeyRotationPending()]);
        return true;
      })(),
      pause(WALLET_CHECK_TIMEOUT).then(() => false),
    ]);

    if (checkId !== walletCheckIdRef.current) return;

    setIsWalletCheckTimedOut(!isChecked);
    markWalletCheckDone();
  });

  useEffect(() => {
    if (isOpen) {
      if (isWalletAvailable) checkWallets();
      return;
    }

    walletCheckIdRef.current++;
    unmarkWalletCheckDone();
  }, [isOpen, isWalletAvailable, checkWallets, unmarkWalletCheckDone]);

  const handleConfirm = useLastCallback(() => {
    onClose();
    signOut({ forceInitApi: true });
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      confirmLabel={lang('AccountSettingsLogout')}
      confirmHandler={handleConfirm}
      confirmIsDestructive
      isConfirmLoading={isWalletAvailable && !isWalletCheckDone}
    >
      <p>
        {hasUnbackedWallet && unbackedWalletNanos > 0 ? lang(
          'AreYouSureLogoutGrams',
          { amount: formatTonAsIcon(lang, formatTonNumber(lang, unbackedWalletNanos, true)) },
          { withNodes: true, withMarkdown: true, renderTextFilters: ['br'] },
        ) : lang('SureLogout')}
      </p>
      {hasUnbackedWallet && !unbackedWalletNanos && <p>{lang('WalletLogoutWarning')}</p>}
      {isKeyRotationWarned && <p>{lang('WalletLogoutKeyRotation')}</p>}
    </ConfirmDialog>
  );
};

export default memo(SignOutDialog);
