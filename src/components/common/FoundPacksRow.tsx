import { useRef } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';

import pickerStyles from '../middle/composer/StickerPicker.module.scss';

type OwnProps = {
  children: React.ReactNode;
};

function FoundPacksRow({ children }: OwnProps) {
  const ref = useRef<HTMLDivElement>();

  useHorizontalScroll(ref, undefined, true);

  return (
    <div ref={ref} className={buildClassName(pickerStyles.foundPacks, 'no-scrollbar')}>
      {children}
    </div>
  );
}

export default FoundPacksRow;
