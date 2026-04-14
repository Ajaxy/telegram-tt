import type { TeactNode } from '../../../lib/teact/teact';
import { createContext, memo, useMemo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useContext from '../../../hooks/data/useContext';
import useLang from '../../../hooks/useLang';
import useUniqueId from '../../../hooks/useUniqueId';

import Spinner from '../../ui/Spinner';
import { useInteractiveContext } from './Interactive';

import styles from './Control.module.scss';

export type ControlContextType = {
  id: string;
  inputClassName: string;
};

export const ControlContext = createContext<ControlContextType | undefined>(undefined);

export function useControlContext() {
  return useContext(ControlContext);
}

// #region Control

type ControlProps = {
  inputEnd?: boolean;
  className?: string;
  children: TeactNode;
};

const Control = ({
  inputEnd,
  className,
  children,
}: ControlProps) => {
  const uniqueId = useUniqueId();
  const lang = useLang();
  const interactive = useInteractiveContext();
  const id = `control-${uniqueId}`;

  const contextValue = useMemo(() => ({
    id,
    inputClassName: styles.input,
  }), [id]);

  return (
    <ControlContext.Provider value={contextValue}>
      <div
        className={buildClassName(
          styles.control,
          inputEnd && styles.inputEnd,
          className,
        )}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {interactive?.isLoading && <Spinner className={styles.spinner} />}
        {children}
      </div>
    </ControlContext.Provider>
  );
};

// #endregion

// #region ControlLabel / ControlDescription

type ControlTextProps = {
  htmlFor?: string;
  className?: string;
  children: TeactNode;
};

function ControlText({
  htmlFor,
  className,
  baseClassName,
  children,
}: ControlTextProps & { baseClassName: string }) {
  const control = useControlContext();
  const interactive = useInteractiveContext();
  const resolvedHtmlFor = htmlFor ?? control?.id;
  const shouldRenderLabel = !interactive?.isLabel && resolvedHtmlFor;

  if (shouldRenderLabel) {
    return (
      <label
        htmlFor={resolvedHtmlFor}
        className={buildClassName(baseClassName, className)}
        dir="auto"
      >
        {children}
      </label>
    );
  }

  return (
    <span
      className={buildClassName(baseClassName, className)}
      dir="auto"
    >
      {children}
    </span>
  );
}

const ControlLabel = (props: ControlTextProps) => (
  <ControlText {...props} baseClassName={styles.controlLabel} />
);

const ControlDescription = (props: ControlTextProps) => (
  <ControlText {...props} baseClassName={styles.controlDescription} />
);

// #endregion

// #region ControlBefore / ControlAfter

type ControlSlotProps = {
  className?: string;
  children: TeactNode;
};

const ControlBefore = ({ className, children }: ControlSlotProps) => {
  return (
    <div className={buildClassName(styles.controlBefore, className)}>
      {children}
    </div>
  );
};

const ControlAfter = ({ className, children }: ControlSlotProps) => {
  return (
    <div className={buildClassName(styles.controlAfter, className)}>
      {children}
    </div>
  );
};

// #endregion

export default memo(Control);
export {
  ControlLabel,
  ControlDescription,
  ControlBefore,
  ControlAfter,
};
