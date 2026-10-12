import { memo, useState } from '../../../lib/teact/teact';

import type { GlobalState } from '../../../global/types';

import useSelector from '../../../hooks/data/useSelector';
import useLang from '../../../hooks/useLang';

import PasswordForm from '../../common/PasswordForm';
import PasswordMonkey from '../../common/PasswordMonkey';

import styles from './WalletPasswordScreen.module.scss';

type OwnProps = {
  // The slide just left stays mounted, so the value is cleared on each reopen
  isActive?: boolean;
  isPasscode?: boolean;
  isLoading?: boolean;
  error?: string;
  onSubmit: (password: string) => void;
  onClearError: NoneToVoidFunction;
};

const WalletPasswordScreen = ({
  isActive, isPasscode, isLoading, error, onSubmit, onClearError,
}: OwnProps) => {
  const lang = useLang();

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const passwordHint = useSelector(selectPasswordHint);

  return (
    <div className={styles.root}>
      <PasswordMonkey isBig isPasswordVisible={isPasswordVisible} />
      <PasswordForm
        className={styles.form}
        shouldShowSubmit
        placeholder={lang(isPasscode ? 'WalletAppPasscodePlaceholder' : 'CheckPasswordPlaceholder')}
        description={lang(isPasscode ? 'WalletAppPasscodeDescription' : 'EnterPasswordDescription')}
        submitLabel={lang('Continue')}
        error={error}
        hint={isPasscode ? undefined : passwordHint}
        isLoading={isLoading}
        shouldResetValue={isActive}
        isPasswordVisible={isPasswordVisible}
        onChangePasswordVisibility={setIsPasswordVisible}
        onClearError={onClearError}
        onSubmit={onSubmit}
      />
    </div>
  );
};

function selectPasswordHint(global: GlobalState) {
  return global.twoFaSettings.hint;
}

export default memo(WalletPasswordScreen);
