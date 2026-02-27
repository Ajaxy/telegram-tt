import type { TeactNode } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Link from '../../ui/Link';

import styles from './ResaleGiftsNotFound.module.scss';

type OwnProps = {
  className?: string;
  description: TeactNode;
  linkText?: TeactNode;
  onLinkClick?: NoneToVoidFunction;
};

const ResaleGiftsNotFound = ({ className, description, linkText, onLinkClick }: OwnProps) => {
  return (
    <div className={buildClassName(styles.root, className)}>
      <AnimatedIconWithPreview
        size={160}
        tgsUrl={LOCAL_TGS_URLS.SearchingDuck}
        nonInteractive
        noLoop
      />
      <div className={styles.description}>
        {description}
      </div>
      {Boolean(linkText && onLinkClick) && (
        <Link
          className={styles.link}
          onClick={onLinkClick}
        >
          {linkText}
        </Link>
      )}
    </div>
  );
};

export default memo(ResaleGiftsNotFound);
