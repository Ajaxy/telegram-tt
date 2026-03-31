import { memo, useMemo } from '../../../../lib/teact/teact';

import type { TableAboutData } from '../../../modals/common/TableAboutModal';

import buildClassName from '../../../../util/buildClassName';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

import useLang from '../../../../hooks/useLang';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';
import ListItem from '../../../ui/ListItem';

import styles from './PremiumFeaturePreviewNoForwards.module.scss';

const ICON_SIZE = 100;

const PremiumFeaturePreviewNoForwards = () => {
  const lang = useLang();

  const listItemData = useMemo(() => {
    return [
      ['no-share', lang('NoForwardingTitle'), lang('NoForwardingDescription')],
      ['no-download', lang('NoSavingTitle'), lang('NoSavingDescription')],
    ] satisfies TableAboutData;
  }, [lang]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <AnimatedIconWithPreview
          size={ICON_SIZE}
          tgsUrl={LOCAL_TGS_URLS.HandStop}
          previewUrl={LOCAL_TGS_PREVIEW_URLS.HandStop}
          noLoop
        />
      </div>
      <div className={styles.listItems}>
        {listItemData.map(([icon, title, subtitle]) => (
          <ListItem
            isStatic
            multiline
            icon={icon}
            className={styles.listItem}
          >
            <span className={buildClassName('title', styles.listItemTitle)}>{title}</span>
            <span className="subtitle">{subtitle}</span>
          </ListItem>
        ))}
      </div>
    </div>
  );
};

export default memo(PremiumFeaturePreviewNoForwards);
