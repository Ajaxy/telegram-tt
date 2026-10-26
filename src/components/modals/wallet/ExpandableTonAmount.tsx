import { memo, useState } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import { convertTonFromNanos, formatTonFromNanos, formatTonShortFromNanos } from '../../../util/formatCurrency';

import useClickable from '../../../hooks/useClickable';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedCounter from '../../common/AnimatedCounter';

import styles from './ExpandableTonAmount.module.scss';

type OwnProps = {
  // Nanotons
  nanos: bigint;
  className?: string;
  fractionClassName?: string;
  withTicker?: boolean;
  isAnimated?: boolean;
};

const ExpandableTonAmount = ({
  nanos, className, fractionClassName, withTicker, isAnimated,
}: OwnProps) => {
  const lang = useLang();
  const [isExpanded, setIsExpanded] = useState(false);

  const collapsed = formatTonShortFromNanos(nanos);
  const expanded = formatTonFromNanos(nanos);
  const canExpand = collapsed !== expanded;

  const toggleExpanded = useLastCallback((e: React.MouseEvent) => {
    // The amount often sits inside a clickable row
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  });

  const clickableProps = useClickable<HTMLSpanElement>(canExpand ? toggleExpanded : undefined);

  const text = isExpanded ? expanded : collapsed;
  const [whole, fraction] = fractionClassName ? text.split('.') : [text];

  // Expanding is not a change of the amount, so it starts fresh counters rather than rolling every digit
  const counterKey = isExpanded ? 'expanded' : 'collapsed';

  const amount = (
    <span className={buildClassName(canExpand && styles.expandable, className)} {...clickableProps}>
      {isAnimated ? <AnimatedCounter key={`whole-${counterKey}`} text={whole} /> : whole}
      {fraction && (isAnimated
        ? <AnimatedCounter key={`fraction-${counterKey}`} text={`.${fraction}`} className={fractionClassName} />
        : <span className={fractionClassName}>{`.${fraction}`}</span>)}
    </span>
  );

  if (!withTicker) {
    return amount;
  }

  return lang('GramAmountText', { amount }, { withNodes: true, pluralValue: convertTonFromNanos(nanos) });
};

export default memo(ExpandableTonAmount);
