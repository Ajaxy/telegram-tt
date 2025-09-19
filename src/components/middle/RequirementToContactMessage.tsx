import { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiPeer } from '../../api/types';

import { getPeerTitle, isApiPeerUser } from '../../global/helpers/peers';
import { selectPeer, selectTheme, selectThemeValues } from '../../global/selectors';
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
  peerId: string;
  paidMessagesStars?: number;
};

type StateProps = {
  patternColor?: string;
  peer?: ApiPeer;
};

function RequirementToContactMessage({
  patternColor, peer, paidMessagesStars,
}: OwnProps & StateProps) {
  const oldLang = useOldLang();
  const lang = useLang();
  const { openPremiumModal, openStarsBalanceModal } = getActions();

  const handleOpenPremiumModal = useLastCallback(() => openPremiumModal());

  const handleGetMoreStars = useLastCallback(() => {
    openStarsBalanceModal({});
  });

  if (!peer) return undefined;

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
              ? lang(isApiPeerUser(peer) ? 'MessagesPlaceholderPaidUser' : 'MessagesPlaceholderPaidChannel', {
                peer: getPeerTitle(lang, peer),
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
              : renderText(oldLang('MessageLockedPremium', getPeerTitle(lang, peer)), ['simple_markdown'])
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
  withGlobal<OwnProps>((global, { peerId: userId }): Complete<StateProps> => {
    const theme = selectTheme(global);
    const { patternColor } = selectThemeValues(global, theme) || {};
    const peer = selectPeer(global, userId);

    return {
      patternColor,
      peer,
    };
  })(RequirementToContactMessage),
);
