import {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { selectAnimatedEmoji, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatPhoneNumber } from '../../../util/phoneNumber';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';

import { useShallowSelector } from '../../../hooks/data/useSelector';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import CustomEmoji from '../../common/CustomEmoji';
import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import Switcher from '../../ui/Switcher';

import styles from './UrlAuthModal.module.scss';

export type OwnProps = {
  modal?: TabState['urlAuth'];
};

type StateProps = {
  bot?: ApiUser;
  currentUser?: ApiUser;
};

type AcceptParams = {
  wasPhoneShared?: boolean;
  matchCode?: string;
};

type DialogState = 'closed' | 'match-confirm' | 'phone';
const MATCH_CODE_EMOJI_SIZE = 2 * REM;

const UrlAuthModal = ({
  modal, bot, currentUser,
}: OwnProps & StateProps) => {
  const {
    acceptBotUrlAuth, acceptLinkUrlAuth, checkUrlAuthMatchCode, declineUrlAuth,
  } = getActions();
  const lang = useLang();

  const renderingModal = useCurrentOrPrev(modal, false);
  const currentBot = useCurrentOrPrev(bot, false);
  const modalRequest = modal?.request;
  const renderingRequest = renderingModal?.request;
  const confirmedMatchCode = renderingModal?.matchCode;
  const botName = getUserFullName(currentBot) || currentBot?.firstName;
  const isMatchCodePrecheckPending = Boolean(
    modalRequest?.matchCodesFirst && modalRequest.matchCodes?.length && !modal?.matchCode,
  );
  const isOpen = Boolean(modal?.url && modal?.request) && !isMatchCodePrecheckPending;

  const [isWriteAccessChecked, setIsWriteAccessChecked] = useState(
    () => Boolean(modalRequest?.shouldRequestWriteAccess),
  );
  const [selectedMatchCode, setSelectedMatchCode] = useState<string | undefined>();
  const [dialogState, setDialogState] = useState<DialogState>('closed');
  const effectiveMatchCode = confirmedMatchCode || selectedMatchCode;
  const isMatchDialogOpen = isMatchCodePrecheckPending || dialogState === 'match-confirm';
  const isPhoneDialogOpen = dialogState === 'phone';
  const matchCodeEmojisSelector = useCallback((global: GlobalState) => {
    return renderingRequest?.matchCodes?.map((matchCode) => selectAnimatedEmoji(global, matchCode));
  }, [renderingRequest?.matchCodes]);
  const matchCodeEmojis = useShallowSelector(matchCodeEmojisSelector);

  useEffect(() => {
    if (!modalRequest) {
      setSelectedMatchCode(undefined);
      setDialogState('closed');
      return;
    }

    setIsWriteAccessChecked(Boolean(modalRequest.shouldRequestWriteAccess));
    setSelectedMatchCode(undefined);
    setDialogState('closed');
  }, [modalRequest]);

  const handleDismiss = useLastCallback(() => {
    setDialogState('closed');
    declineUrlAuth();
  });

  const submitAuth = useLastCallback((params: AcceptParams = {}) => {
    const acceptAction = renderingModal?.button ? acceptBotUrlAuth : acceptLinkUrlAuth;
    acceptAction({
      isWriteAllowed: renderingRequest?.shouldRequestWriteAccess ? isWriteAccessChecked : undefined,
      wasPhoneShared: params.wasPhoneShared,
      matchCode: params.matchCode ?? effectiveMatchCode,
    });
  });

  const handleConfirm = useLastCallback(() => {
    if (!renderingRequest) {
      return;
    }

    if (renderingRequest.matchCodes?.length && !effectiveMatchCode) {
      setDialogState('match-confirm');
      return;
    }

    if (renderingRequest.shouldRequestPhoneNumber) {
      setDialogState('phone');
      return;
    }

    submitAuth();
  });

  const handleMatchDialogClose = useLastCallback(() => {
    setDialogState('closed');
  });

  const handleMatchCodeSelect = useLastCallback((matchCode: string) => {
    if (isMatchCodePrecheckPending) {
      checkUrlAuthMatchCode({ matchCode });
      return;
    }

    setSelectedMatchCode(matchCode);
    setDialogState('closed');

    if (renderingRequest?.shouldRequestPhoneNumber) {
      setDialogState('phone');
      return;
    }

    submitAuth({ matchCode });
  });

  const handlePhoneDialogClose = useLastCallback(() => {
    setDialogState('closed');
  });

  const handlePhoneDecision = useLastCallback((wasPhoneShared: boolean) => {
    setDialogState('closed');
    submitAuth({ wasPhoneShared });
  });

  const handleTriggerWriteAccess = useLastCallback(() => {
    setIsWriteAccessChecked(!isWriteAccessChecked);
  });

  if (!renderingRequest) {
    return undefined;
  }

  const shouldRenderSessionInfo = Boolean(renderingRequest.platform
    || renderingRequest.browser || renderingRequest.ip || renderingRequest.region,
  );
  const requestDomain = renderingRequest.domain;
  const requestDisplayName = renderingRequest.isApp
    ? renderingRequest.verifiedAppName || lang('BotAuthUnverifiedApp')
    : requestDomain;
  const titleTarget = renderingRequest.isApp
    ? requestDisplayName
    : <SafeLink url={requestDomain} text={requestDomain} />;
  const formattedPhoneNumber = currentUser?.phoneNumber ? `+${formatPhoneNumber(currentUser.phoneNumber)}` : undefined;
  const titleText = lang('BotAuthTitle', {
    url: titleTarget,
  }, {
    withNodes: true,
  });
  const descriptionText = lang(renderingRequest.isApp ? 'BotAuthAppSubtitle' : 'BotAuthSiteSubtitle', undefined, {
    withNodes: true,
    withMarkdown: true,
  });

  function renderPhoneDialogText() {
    return (
      <>
        <p>
          {lang('BotAuthPhoneNumberText', {
            domain: requestDisplayName,
            phone: formattedPhoneNumber || lang('Phone'),
          }, {
            withNodes: true,
            withMarkdown: true,
          })}
        </p>
        <p>{lang('BotAuthPhoneNumberQuestion')}</p>
      </>
    );
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        contentClassName={styles.content}
        className="tall"
        onClose={handleDismiss}
        hasAbsoluteCloseButton
        isSlim
      >
        <Avatar
          peer={currentBot}
          size={96}
          className={styles.center}
        />

        <h2 className={buildClassName(styles.center, styles.title)} dir="auto">{titleText}</h2>

        <span className={styles.textCenter}>{descriptionText}</span>

        {shouldRenderSessionInfo && (
          <>
            <div className={styles.infoCard}>
              <span className={styles.infoLabel}>{lang('BotAuthDevice')}</span>
              <span className={styles.infoValue}>
                {[renderingRequest.platform, renderingRequest.browser].filter(Boolean).join(' · ')}
              </span>
              <span className={styles.infoLabel}>{lang('SessionPreviewIp')}</span>
              <span className={styles.infoValue}>{renderingRequest.ip}</span>
              <span className={styles.infoLabel}>{lang('SessionPreviewLocation')}</span>
              <span className={styles.infoValue}>{renderingRequest.region}</span>
            </div>

            <span className={styles.note}>{lang('BotAuthInfo')}</span>
          </>
        )}

        {renderingRequest.shouldRequestWriteAccess && (
          <>
            <ListItem
              className={styles.allowMessages}
              onClick={handleTriggerWriteAccess}
              rightElement={(
                <Switcher
                  id="url_auth_allow_messages"
                  label={lang('BotAuthAllowMessages')}
                  checked={isWriteAccessChecked}
                />
              )}
            >
              {lang('BotAuthAllowMessages')}
            </ListItem>
            {botName && (
              <span className={styles.note}>
                {lang(
                  'BotAuthAllowMessagesInfo',
                  { bot: botName },
                  { withNodes: true, withMarkdown: true },
                )}
              </span>
            )}
          </>
        )}

        <div className={buildClassName(styles.actions, styles.center)}>
          <Button
            className={styles.actionButton}
            color="gray"
            isText
            fluid
            noForcedUpperCase
            onClick={handleDismiss}
          >
            {lang('Cancel')}
          </Button>
          <Button
            className={styles.actionButton}
            color="primary"
            fluid
            noForcedUpperCase
            onClick={handleConfirm}
          >
            {lang('BotAuthLogin')}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isMatchDialogOpen}
        title={lang('BotAuthSelectEmoji')}
        onClose={isMatchCodePrecheckPending ? handleDismiss : handleMatchDialogClose}
        className={buildClassName('confirm', styles.matchDialog)}
      >
        <div className={styles.matchCodes}>
          {renderingRequest.matchCodes?.map((matchCode, index) => {
            const animatedMatchCodeEmoji = matchCodeEmojis?.[index];

            return (
              <Button
                key={matchCode}
                fluid
                color="adaptive"
                className={styles.matchCodeButton}
                onClick={() => handleMatchCodeSelect(matchCode)}
              >
                {animatedMatchCodeEmoji ? (
                  <CustomEmoji
                    sticker={animatedMatchCodeEmoji}
                    size={MATCH_CODE_EMOJI_SIZE}
                  />
                ) : renderText(matchCode)}
              </Button>
            );
          })}
        </div>
        <div className={styles.footnote}>
          {lang('BotAuthTitle', {
            url: titleTarget,
          }, {
            withNodes: true,
          })}
        </div>
        <Button
          color="danger"
          className={styles.cancelButton}
          isText
          noForcedUpperCase
          onClick={handleDismiss}
        >
          {lang('Cancel')}
        </Button>
      </Modal>

      <Modal
        isOpen={isPhoneDialogOpen}
        title={lang('BotAuthPhoneNumber')}
        onClose={handlePhoneDialogClose}
        className={buildClassName('confirm', styles.phoneDialog)}
      >
        {renderPhoneDialogText()}
        <div className="dialog-buttons">
          <Button
            className="confirm-dialog-button"
            color="primary"
            noForcedUpperCase
            onClick={() => handlePhoneDecision(true)}
          >
            {lang('BotAuthPhoneNumberAccept')}
          </Button>
          <Button
            className="confirm-dialog-button"
            color="gray"
            noForcedUpperCase
            onClick={() => handlePhoneDecision(false)}
          >
            {lang('BotAuthPhoneNumberDeny')}
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const currentUser = selectUser(global, global.currentUserId!);
    const bot = modal?.request?.botId ? selectUser(global, modal.request.botId) : undefined;

    return {
      bot,
      currentUser,
    };
  },
)(UrlAuthModal));
