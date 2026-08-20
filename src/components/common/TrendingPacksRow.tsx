import { useRef } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';

import styles from './TrendingPacksRow.module.scss';

type OwnProps = {
  children: React.ReactNode;
};

function TrendingPacksRow({ children }: OwnProps) {
  const ref = useRef<HTMLDivElement>();

  useHorizontalScroll(ref, undefined, true);

  return (
    <div ref={ref} className={buildClassName(styles.root, 'no-scrollbar')}>
      {children}
    </div>
  );
}

export default TrendingPacksRow;
