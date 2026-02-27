import type { TeactNode } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Link from '../../ui/Link';

import styles from './GiftEmptyState.module.scss';

type OwnProps = {
  description: TeactNode;
  linkText?: TeactNode;
  onLinkClick?: NoneToVoidFunction;
};

const GiftEmptyState = ({ description, linkText, onLinkClick }: OwnProps) => {
  return (
    <div className={styles.root}>
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

export default memo(GiftEmptyState);
