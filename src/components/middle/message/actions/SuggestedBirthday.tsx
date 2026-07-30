import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiMessage, ApiPeer } from '../../../../api/types';
import type { ApiMessageActionSuggestBirthday } from '../../../../api/types/messageActions';

import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectPeer } from '../../../../global/selectors';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';
import { renderPeerLink, translateWithYou } from '../helpers/messageActions';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  message: ApiMessage;
  action: ApiMessageActionSuggestBirthday;
};

type StateProps = {
  peer?: ApiPeer;
};

const STICKER_SIZE = 96;

type MonthIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

const SuggestedBirthday = ({ message, action, peer }: OwnProps & StateProps) => {
  const { openBirthdaySetupModal } = getActions();
  const { isOutgoing } = message;
  const { birthday } = action;

  const lang = useLang();

  const text = useMemo(() => {
    const peerName = (peer && getPeerTitle(lang, peer)) || lang('ActionFallbackUser');
    const peerLink = renderPeerLink(peer?.id, peerName);

    return translateWithYou(lang, 'ActionSuggestedBirthday', isOutgoing, { user: peerLink });
  }, [lang, isOutgoing, peer]);

  const handleView = useLastCallback(() => {
    openBirthdaySetupModal({
      currentBirthday: birthday,
      isFromSuggestion: true,
    });
  });

  const handleViewKeyDown = useLastCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleView();
    }
  });

  return (
    <div className={styles.contentBox}>
      <AnimatedIconWithPreview
        tgsUrl={LOCAL_TGS_URLS.DuckCake}
        size={STICKER_SIZE}
      />
      <div className={styles.suggestedText}>
        {text}
      </div>
      <div className={styles.birthdayValues}>
        <div className={styles.birthdayValue}>
          <span className={styles.birthdayValueLabel}>{lang('BirthdayInputDay')}</span>
          {birthday.day}
        </div>
        <div className={styles.birthdayValue}>
          <span className={styles.birthdayValueLabel}>{lang('BirthdayInputMonth')}</span>
          {lang(`Month${birthday.month as MonthIndex}`)}
        </div>
        {Boolean(birthday.year) && (
          <div className={styles.birthdayValue}>
            <span className={styles.birthdayValueLabel}>{lang('BirthdayInputYear')}</span>
            {birthday.year}
          </div>
        )}
      </div>
      {!isOutgoing && (
        <div
          className={styles.actionButton}
          tabIndex={0}
          role="button"
          onClick={handleView}
          onKeyDown={handleViewKeyDown}
        >
          {lang('ActionViewButton')}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): Complete<StateProps> => {
    const peer = selectPeer(global, message.chatId);

    return {
      peer,
    };
  },
)(SuggestedBirthday));
