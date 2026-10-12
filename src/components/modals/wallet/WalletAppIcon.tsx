import { memo } from '../../../lib/teact/teact';

import type { ApiWebDocument } from '../../../api/types';

import { getWebDocumentHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';

import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';

import styles from './WalletAppIcon.module.scss';

type OwnProps = {
  name?: string;
  icon?: ApiWebDocument;
  isLarge?: boolean;
};

// The server downloads the icon from the dApp, so its host never sees the user's IP
const WalletAppIcon = ({ name, icon, isLarge }: OwnProps) => {
  const iconUrl = useMedia(getWebDocumentHash(icon));
  const { ref } = useMediaTransition<HTMLImageElement>({ hasMediaData: Boolean(iconUrl) });

  return (
    <div className={buildClassName(styles.root, isLarge && styles.large)}>
      {name && [...name][0].toUpperCase()}
      {iconUrl && <img ref={ref} src={iconUrl} alt="" draggable={false} className={styles.image} />}
    </div>
  );
};

export default memo(WalletAppIcon);
