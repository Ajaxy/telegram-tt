import { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useHeaderPane, { type PaneState } from '../../../middle/hooks/useHeaderPane';

import styles from './FrozenAccountPane.module.scss';

type OwnProps = {
  isAccountFrozen?: boolean;
  onPaneStateChange: (state: PaneState) => void;
};

const FrozenAccountPane = ({ isAccountFrozen, onPaneStateChange }: OwnProps) => {
  const { openFrozenAccountModal } = getActions();
  const lang = useLang();

  const { ref, shouldRender } = useHeaderPane({
    isOpen: isAccountFrozen,
    onStateChange: onPaneStateChange,
    withResizeObserver: true,
  });

  const handleClick = useLastCallback(() => {
    openFrozenAccountModal();
  });

  if (!shouldRender) return undefined;

  return (
    <div
      ref={ref}
      className={styles.root}
      role="button"
      tabIndex={0}
      onClick={handleClick}
    >
      <div className={styles.title}>{lang('TitleFrozenAccount')}</div>
      <div className={styles.subtitle}>{lang('SubtitleFrozenAccount')}</div>
    </div>
  );
};

export default memo(FrozenAccountPane);
