import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './QrIcon.module.scss';

type OwnProps = {
  className?: string;
};

// Masked SVG icon so the multi-path QR shape (with framed corners) tints via `currentColor`
const QrIcon = ({ className }: OwnProps) => {
  return <span className={buildClassName(styles.root, className)} />;
};

export default memo(QrIcon);
