import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { getUserFirstOrLastName } from '../../global/helpers';
import { selectTheme, selectUser } from '../../global/selectors';
import { LOCAL_TGS_URLS } from '../common/helpers/animatedAssets';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../common/AnimatedIconWithPreview';
import Icon from '../common/Icon';
import Button from '../ui/Button';

import styles from './PremiumRequiredMessage.module.scss';

type OwnProps = {
  userId: string;
};

type StateProps = {
  patternColor?: string;
  userName?: string;
};

function PremiumRequiredMessage({ patternColor, userName }: StateProps) {
  const lang = useLang();
  const { openPremiumModal } = getActions();

  const handleOpenPremiumModal = useLastCallback(() => openPremiumModal());

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <div className={styles.iconsContainer}>
          <AnimatedIconWithPreview
            tgsUrl={LOCAL_TGS_URLS.Unlock}
            size={54}
            color={patternColor}
            className={styles.animatedUnlock}
          />
          <Icon name="comments-sticker" className={styles.commentsIcon} />
        </div>
        <span className={styles.description}>
          {renderText(lang('MessageLockedPremium', userName), ['simple_markdown'])}
        </span>
        <Button
          color="translucent-black"
          size="tiny"
          onClick={handleOpenPremiumModal}
          className={styles.button}
        >
          {lang('MessagePremiumUnlock')}
        </Button>
      </div>
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>((global, { userId }): StateProps => {
    const theme = selectTheme(global);
    const { patternColor } = global.settings.themes[theme] || {};
    const user = selectUser(global, userId);

    return {
      patternColor,
      userName: getUserFirstOrLastName(user),
    };
  })(PremiumRequiredMessage),
);
