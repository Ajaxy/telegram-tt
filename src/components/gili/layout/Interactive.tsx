import type { TeactNode } from '../../../lib/teact/teact';
import { createContext, memo, useMemo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useContext from '../../../hooks/data/useContext';
import useClickable from '../../../hooks/useClickable';

import RippleEffect from '../../ui/RippleEffect';

import styles from './Interactive.module.scss';

export type InteractiveContextType = {
  isDisabled: boolean;
  isLoading: boolean;
  isLabel: boolean;
};

export const InteractiveContext = createContext<InteractiveContextType | undefined>(undefined);

export function useInteractiveContext() {
  return useContext(InteractiveContext);
}

type OwnProps = {
  asLabel?: boolean;
  clickable?: boolean;
  ripple?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children: TeactNode;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
};

const Interactive = ({
  asLabel,
  clickable,
  ripple,
  disabled,
  loading,
  className,
  children,
  onClick,
}: OwnProps) => {
  const contextValue = useMemo(() => ({
    isDisabled: Boolean(disabled),
    isLoading: Boolean(loading),
    isLabel: Boolean(asLabel),
  }), [asLabel, disabled, loading]);

  const isNonInteractive = disabled || loading;
  const clickableProps = useClickable(onClick, {
    disabled: isNonInteractive,
    withA11y: !asLabel,
  });

  const blockClassName = buildClassName(
    styles.interactive,
    clickable && !isNonInteractive && styles.clickable,
    isNonInteractive && styles.nonInteractive,
    disabled && styles.disabled,
    className,
  );

  const content = (
    <>
      {children}
      {ripple && !isNonInteractive && <RippleEffect />}
    </>
  );

  if (asLabel) {
    return (
      <InteractiveContext.Provider value={contextValue}>
        <label className={blockClassName} {...clickableProps}>
          {content}
        </label>
      </InteractiveContext.Provider>
    );
  }

  return (
    <InteractiveContext.Provider value={contextValue}>
      <div className={blockClassName} {...clickableProps}>
        {content}
      </div>
    </InteractiveContext.Provider>
  );
};

export default memo(Interactive);
