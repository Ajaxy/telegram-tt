import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import ShowTransition from '../../ui/ShowTransition';
import { useControlContext } from '../layout/Control';
import { useInteractiveContext } from '../layout/Interactive';

import styles from './Switch.module.scss';

type InputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>;

type OwnProps = {
  checked: boolean;
  disabled?: boolean;
  locked?: boolean;
  nonInteractive?: boolean;
  withPermissionColors?: boolean;
  className?: string;
  onChange?: (checked: boolean) => void;
};

type Props = OwnProps & Omit<InputProps, keyof OwnProps | 'type'>;

const Switch = ({
  checked,
  disabled,
  locked,
  nonInteractive,
  withPermissionColors,
  className,
  onChange,
  id,
  tabIndex,
  ...restProps
}: Props) => {
  const control = useControlContext();
  const interactive = useInteractiveContext();

  const resolvedId = id ?? control?.id;
  const isDisabled = disabled || interactive?.isDisabled || interactive?.isLoading;

  const handleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (locked || nonInteractive) return;

    onChange?.(e.currentTarget.checked);
  });

  if (interactive?.isLoading) return undefined;

  return (
    <span
      className={buildClassName(
        'Switch',
        styles.root,
        isDisabled && styles.disabled,
        (locked || nonInteractive) && styles.nonInteractive,
        withPermissionColors && styles.permissionColors,
        control?.inputClassName,
        className,
      )}
    >
      <input
        {...restProps}
        type="checkbox"
        role="switch"
        id={resolvedId}
        checked={checked}
        disabled={isDisabled || locked || nonInteractive}
        tabIndex={nonInteractive ? -1 : tabIndex}
        aria-disabled={nonInteractive || undefined}
        className={styles.input}
        onChange={handleChange}
      />
      <span className={styles.track} aria-hidden>
        <span className={styles.thumb}>
          <ShowTransition isOpen={Boolean(locked)} className={styles.lockIconTransition}>
            <Icon name="lock-badge" className={styles.lockIcon} />
          </ShowTransition>
        </span>
      </span>
    </span>
  );
};

export default memo(Switch);
