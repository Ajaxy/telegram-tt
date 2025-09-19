import { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import { VERIFY_AGE_MIN_DEFAULT } from '../../config';

import useLang from '../../hooks/useLang';

import Checkbox from '../ui/Checkbox';
import ConfirmDialog from '../ui/ConfirmDialog';

import styles from './SensitiveContentConfirmModal.module.scss';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
  shouldAlwaysShow: boolean;
  onAlwaysShowChanged: (value: boolean) => void;
  confirmHandler: NoneToVoidFunction;
};

type StateProps = {
  verifyAgeMin: number;
};

const SensitiveContentConfirmModal = ({
  isOpen,
  onClose,
  shouldAlwaysShow,
  onAlwaysShowChanged,
  confirmHandler,
  verifyAgeMin,
}: OwnProps & StateProps) => {
  const lang = useLang();

  return (
    <ConfirmDialog
      title={lang('TitleSensitiveModal', { years: verifyAgeMin })}
      confirmLabel={lang('ButtonSensitiveView')}
      isOpen={isOpen}
      onClose={onClose}
      confirmHandler={confirmHandler}
    >
      {lang('TextSensitiveModal')}
      <Checkbox
        className={styles.checkBox}
        label={lang('ButtonSensitiveAlways', { years: verifyAgeMin })}
        checked={shouldAlwaysShow}
        onCheck={onAlwaysShowChanged}
      />
    </ConfirmDialog>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const appConfig = global.appConfig;
  const verifyAgeMin = appConfig.verifyAgeMin;

  return {
    verifyAgeMin: verifyAgeMin || VERIFY_AGE_MIN_DEFAULT,
  };
})(SensitiveContentConfirmModal));
