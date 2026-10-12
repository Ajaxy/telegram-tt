import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiWalletSavedWallet } from '../../../api/types';

import { selectCanExportWalletPhrase, selectIsWalletKeyMissing } from '../../../global/selectors';
import { formatTonTextFromNanos } from '../../../util/localization/format';
import { shortenAddress } from '../../../util/tonAddress';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Control, { ControlAfter, ControlDescription, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island, { IslandDescription, IslandTitle } from '@gili/layout/Island';

import styles from './WalletKeySection.module.scss';

type OwnProps = {
  onShowPhrase: NoneToVoidFunction;
  onEnableBackup: NoneToVoidFunction;
  onDisableBackup: NoneToVoidFunction;
  onDeleteWallet: NoneToVoidFunction;
  onImportSavedWallet: (address: string) => void;
  onShowSavedPhrase: (address: string) => void;
  onEnterOwnPhrase: NoneToVoidFunction;
};

type StateProps = {
  canExportPhrase?: boolean;
  isKeyMissing?: boolean;
  canEnableBackup?: boolean;
  isBackupEnabled?: boolean;
  savedWallets?: ApiWalletSavedWallet[];
};

type SavedWalletOwnProps = {
  wallet: ApiWalletSavedWallet;
  onImport: (address: string) => void;
  onShowPhrase: (address: string) => void;
};

const WalletKeySection = ({
  canExportPhrase, isKeyMissing, canEnableBackup, isBackupEnabled, savedWallets,
  onShowPhrase, onEnableBackup, onDisableBackup, onDeleteWallet, onImportSavedWallet, onShowSavedPhrase,
  onEnterOwnPhrase,
}: OwnProps & StateProps) => {
  const lang = useLang();

  const hasBackupActions = Boolean(canEnableBackup || isBackupEnabled);

  return (
    <>
      <IslandTitle>{lang('WalletRecoveryPhraseTitle')}</IslandTitle>
      {canExportPhrase && (
        <Island>
          <Interactive clickable ripple onClick={onShowPhrase}>
            <Control>
              <ControlLabel className={styles.actionLabel}>{lang('WalletShowRecoveryPhrase')}</ControlLabel>
            </Control>
          </Interactive>
        </Island>
      )}
      {isKeyMissing && (
        <Island>
          <Interactive clickable ripple onClick={onEnterOwnPhrase}>
            <Control>
              <ControlLabel className={styles.actionLabel}>{lang('WalletEnterSecretPhrase')}</ControlLabel>
            </Control>
          </Interactive>
        </Island>
      )}
      <IslandDescription>{lang('WalletRecoveryPhraseHint')}</IslandDescription>
      {hasBackupActions && (
        <>
          <IslandTitle>{lang('WalletBackupTitle')}</IslandTitle>
          <Island>
            {canEnableBackup && (
              <Interactive clickable ripple onClick={onEnableBackup}>
                <Control>
                  <ControlLabel className={styles.actionLabel}>{lang('WalletEnableBackup')}</ControlLabel>
                </Control>
              </Interactive>
            )}
            {isBackupEnabled && (
              <Interactive clickable ripple onClick={onDisableBackup}>
                <Control>
                  <ControlLabel className={styles.dangerLabel}>{lang('WalletDisableBackup')}</ControlLabel>
                </Control>
              </Interactive>
            )}
          </Island>
          <IslandDescription>
            {lang(isBackupEnabled ? 'WalletBackupHint' : 'WalletBackupOffHint', undefined, {
              withNodes: true, renderTextFilters: ['br'],
            })}
          </IslandDescription>
        </>
      )}
      <Island>
        <Interactive clickable ripple onClick={onDeleteWallet}>
          <Control>
            <ControlLabel className={styles.dangerLabel}>{lang('WalletDeleteWallet')}</ControlLabel>
          </Control>
        </Interactive>
      </Island>
      {Boolean(savedWallets?.length) && (
        <>
          <IslandTitle>{lang('WalletOtherWalletsTitle')}</IslandTitle>
          <Island>
            {savedWallets.map((wallet) => (
              <SavedWallet
                key={wallet.address}
                wallet={wallet}
                onImport={onImportSavedWallet}
                onShowPhrase={onShowSavedPhrase}
              />
            ))}
          </Island>
          <IslandDescription>{lang('WalletOtherWalletsHint')}</IslandDescription>
        </>
      )}
    </>
  );
};

const SavedWallet = memo(({
  wallet, onImport, onShowPhrase,
}: SavedWalletOwnProps) => {
  const { removeSavedWallet } = getActions();

  const lang = useLang();

  const [isRemoveConfirmOpen, openRemoveConfirm, closeRemoveConfirm] = useFlag();

  const handleShowPhrase = useLastCallback(() => onShowPhrase(wallet.address));

  // A fast click fires on `mousedown`, which stopping would not hold the `click` back, hence `noFastClick`
  const handleImport = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onImport(wallet.address);
  });
  const handleRemoveClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    openRemoveConfirm();
  });
  const handleRemove = useLastCallback(() => {
    closeRemoveConfirm();
    removeSavedWallet({ address: wallet.address });
  });

  return (
    <>
      <Interactive clickable ripple onClick={handleShowPhrase}>
        <Control>
          <ControlLabel>{shortenAddress(wallet.address)}</ControlLabel>
          {wallet.balance !== undefined && (
            <ControlDescription>
              {lang('WalletSendBalance', { amount: formatTonTextFromNanos(lang, wallet.balance) })}
            </ControlDescription>
          )}
          <ControlAfter className={styles.savedActions}>
            <Button
              round
              color="translucent"
              size="tiny"
              className={styles.importButton}
              ariaLabel={lang('WalletSavedImport')}
              noFastClick
              onClick={handleImport}
            >
              <Icon name="replace" />
            </Button>
            <Button
              round
              color="translucent"
              size="tiny"
              className={styles.deleteButton}
              ariaLabel={lang('Delete')}
              noFastClick
              onClick={handleRemoveClick}
            >
              <Icon name="delete" />
            </Button>
          </ControlAfter>
        </Control>
      </Interactive>
      {/* The phrase has no other copy, so a slip of the pointer must not be the end of it */}
      <ConfirmDialog
        isOpen={isRemoveConfirmOpen}
        title={lang('WalletDeleteTitle')}
        text={lang('WalletDeleteText')}
        confirmLabel={lang('Delete')}
        confirmIsDestructive
        confirmHandler={handleRemove}
        onClose={closeRemoveConfirm}
      />
    </>
  );
});

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      canExportPhrase: selectCanExportWalletPhrase(global),
      isKeyMissing: selectIsWalletKeyMissing(global),
      canEnableBackup: global.wallet?.state?.canEnableBackup,
      isBackupEnabled: global.wallet?.state?.isBackupEnabled,
      savedWallets: global.wallet?.savedWallets,
    };
  },
)(WalletKeySection));
