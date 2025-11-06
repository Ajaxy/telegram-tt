import { type TeactNode } from '../../../lib/teact/teact';

import { IS_IOS } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import RippleEffect from '../../ui/RippleEffect';

import styles from './PickerItem.module.scss';

type OwnProps = {
  title: TeactNode;
  subtitle?: TeactNode;
  avatarElement?: TeactNode;
  inputElement?: TeactNode;
  inputPosition?: 'start' | 'end';
  disabled?: boolean;
  inactive?: boolean;
  ripple?: boolean;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  style?: string;
  onClick?: NoneToVoidFunction;
  onDisabledClick?: NoneToVoidFunction;
};

const PickerItem = ({
  title,
  subtitle,
  avatarElement,
  inputElement,
  inputPosition = 'start',
  disabled,
  inactive,
  ripple,
  className,
  titleClassName,
  subtitleClassName,
  style,
  onClick,
  onDisabledClick,
}: OwnProps) => {
  const lang = useLang();

  const isClickable = !inactive && !disabled;
  const handleClick = useLastCallback(() => {
    if (inactive) return;

    if (disabled) {
      onDisabledClick?.();
      return;
    }

    onClick?.();
  });

  return (
    <div
      className={buildClassName(
        styles.root,
        subtitle && styles.multiline,
        disabled && styles.disabled,
        isClickable && styles.clickable,
        avatarElement && styles.withAvatar,
        className,
      )}
      onClick={handleClick}
      style={style}
      dir={lang.isRtl ? 'rtl' : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {!disabled && !inactive && ripple && <RippleEffect />}
      {Boolean(inputElement) && (
        <div className={buildClassName(
          styles.input,
          inputPosition === 'end' ? styles.endInput : styles.startInput,
        )}
        >
          {inputElement}
        </div>
      )}
      {Boolean(avatarElement) && (
        <div className={styles.avatarElement}>
          {avatarElement}
        </div>
      )}
      <div className={buildClassName(styles.title, titleClassName)}>
        {title}
      </div>
      {Boolean(subtitle) && (
        <div className={buildClassName(styles.subtitle, subtitleClassName)}>
          {subtitle}
        </div>
      )}
      {!inputElement && IS_IOS && (
        <div className={styles.separator} />
      )}
    </div>
  );
};

export default PickerItem;
