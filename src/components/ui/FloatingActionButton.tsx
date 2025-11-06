import type { IconName } from '../../types/icons';
import type { OwnProps as ButtonProps } from './Button';

import buildClassName from '../../util/buildClassName';

import useOldLang from '../../hooks/useOldLang';

import IconWithSpinner from '../common/IconWithSpinner';
import Button from './Button';

import './FloatingActionButton.scss';

type OwnProps = {
  isShown: boolean;
  iconName: IconName;
  className?: string;
  color?: ButtonProps['color'];
  ariaLabel?: ButtonProps['ariaLabel'];
  disabled?: boolean;
  isLoading?: boolean;
  onClick: () => void;
};

const FloatingActionButton = ({
  isShown,
  iconName,
  className,
  color = 'primary',
  ariaLabel,
  disabled,
  isLoading,
  onClick,
}: OwnProps) => {
  const lang = useOldLang();

  const buttonClassName = buildClassName(
    'FloatingActionButton',
    isShown && 'revealed',
    className,
  );

  return (
    <Button
      className={buttonClassName}
      color={color}
      round
      disabled={disabled}
      onClick={isShown && !disabled ? onClick : undefined}
      ariaLabel={ariaLabel}
      tabIndex={-1}
      isRtl={lang.isRtl}
    >
      <IconWithSpinner iconName={iconName} isLoading={isLoading} />
    </Button>
  );
};

export default FloatingActionButton;
