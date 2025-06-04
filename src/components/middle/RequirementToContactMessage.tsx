import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { getUserFirstOrLastName } from '../../global/helpers';
import { selectTheme, selectThemeValues, selectUser } from '../../global/selectors';
import { formatStarsAsIcon } from '../../util/localization/format';
import { LOCAL_TGS_URLS } from '../common/helpers/animatedAssets';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import AnimatedIconWithPreview from '../common/AnimatedIconWithPreview';
import Icon from '../common/icons/Icon';
import Sparkles from '../common/Sparkles';
import Button from '../ui/Button';

import styles from './RequirementToContactMessage.module.scss';

type OwnProps = {

  userId: string;
  paidMessagesStars?: number;
};

type StateProps = {
  patternColor?: string;
  userName?: string;
};

function RequirementToContactMessage({ patternColor, userName, paidMessagesStars }: OwnProps & StateProps) {
  const oldLang = useOldLang();
  const lang = useLang();
  const { openPremiumModal, openStarsBalanceModal } = getActions();

  const handleOpenPremiumModal = useLastCallback(() => openPremiumModal());

  const handleGetMoreStars = useLastCallback(() => {
    openStarsBalanceModal({});
  });

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
          {
            paidMessagesStars
              ? lang('FirstMessageInPaidMessagesChat', {
                user: userName,
                amount: formatStarsAsIcon(lang,
                  paidMessagesStars,
                  {
                    asFont: true,
                    className: styles.starIcon,
                    containerClassName: styles.starIconContainer,
                  }),
              }, {
                withNodes: true,
                withMarkdown: true,
              })
              : renderText(oldLang('MessageLockedPremium', userName), ['simple_markdown'])
          }
        </span>
        <Button
          color="translucent-black"
          size="default"
          pill
          onClick={paidMessagesStars ? handleGetMoreStars : handleOpenPremiumModal}
          className={styles.button}
        >
          {
            paidMessagesStars
              ? (
                <>
                  {lang('ButtonBuyStars')}
                  <Sparkles preset="button" />
                </>
              )
              : oldLang('MessagePremiumUnlock')
          }
        </Button>
      </div>
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>((global, { userId }): StateProps => {
    const theme = selectTheme(global);
    const { patternColor } = selectThemeValues(global, theme) || {};
    const user = selectUser(global, userId);

    return {
      patternColor,
      userName: getUserFirstOrLastName(user),
    };
  })(RequirementToContactMessage),
);
