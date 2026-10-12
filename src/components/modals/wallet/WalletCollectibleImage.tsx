import { memo } from '../../../lib/teact/teact';

import type { ApiWalletCollectible } from '../../../api/types';

import { getWebDocumentHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';

import Icon from '../../common/icons/Icon';
import Skeleton from '../../ui/placeholder/Skeleton';

import styles from './WalletCollectibleImage.module.scss';

type OwnProps = {
  collectible: ApiWalletCollectible;
  isFull?: boolean;
  className?: string;
};

const WalletCollectibleImage = ({ collectible, isFull, className }: OwnProps) => {
  const { image, imageSmall } = collectible;
  const document = isFull ? (image ?? imageSmall) : (imageSmall ?? image);
  const imageUrl = useMedia(getWebDocumentHash(document));
  const { ref } = useMediaTransition<HTMLImageElement>({ hasMediaData: Boolean(imageUrl) });
  const [isBroken, markBroken] = useFlag();

  function renderContent() {
    if (!document || isBroken) {
      return <Icon name="gift" className={styles.placeholder} />;
    }

    if (!imageUrl) {
      return <Skeleton animation="wave" />;
    }

    return (
      <img ref={ref} src={imageUrl} alt="" draggable={false} className={styles.image} onError={markBroken} />
    );
  }

  return (
    <div className={buildClassName(styles.root, className)}>
      {renderContent()}
    </div>
  );
};

export default memo(WalletCollectibleImage);
