import type { FC } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';

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

const SensitiveContentConfirmModal: FC<OwnProps> = ({
  isOpen,
  onClose,
  shouldAlwaysShow,
  onAlwaysShowChanged,
  confirmHandler,
}) => {
  const lang = useLang();

  return (
    <ConfirmDialog
      title={lang('TitleSensitiveModal')}
      confirmLabel={lang('ButtonSensitiveView')}
      isOpen={isOpen}
      onClose={onClose}
      confirmHandler={confirmHandler}
    >
      {lang('TextSensitiveModal')}
      <Checkbox
        className={styles.checkBox}
        label={lang('ButtonSensitiveAlways')}
        checked={shouldAlwaysShow}
        onCheck={onAlwaysShowChanged}
      />
    </ConfirmDialog>
  );
};

export default memo(SensitiveContentConfirmModal);
