import {
  memo, useLayoutEffect, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { STRICTERDOM_ENABLED } from '../../config';
import { disableStrict, enableStrict } from '../../lib/fasterdom/stricterdom';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import buildClassName from '../../util/buildClassName';
import { oldSetLanguage } from '../../util/oldLangProvider';
import { LOCAL_TGS_URLS } from '../common/helpers/animatedAssets';
import { navigateBack } from './helpers/backNavigation';
import { getSuggestedLanguage } from './helpers/getSuggestedLanguage';

import useAsync from '../../hooks/useAsync';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLangString from '../../hooks/useLangString';
import useLastCallback from '../../hooks/useLastCallback';
import useMediaTransitionDeprecated from '../../hooks/useMediaTransitionDeprecated';
import useMultiaccountInfo from '../../hooks/useMultiaccountInfo';

import AnimatedIcon from '../common/AnimatedIcon';
import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Loading from '../ui/Loading';

import blankUrl from '../../assets/blank.png';

type StateProps =
  Pick<GlobalState, 'connectionState' | 'authState' | 'authQrCode'>
  & {
    language?: string;
  };

const DATA_PREFIX = 'tg://login?token=';
const QR_SIZE = 280;
const QR_PLANE_SIZE = 54;
const QR_CODE_MUTATION_DURATION = 50; // The library is asynchronous and we need to wait for its mutation code

let qrCodeStylingPromise: Promise<typeof import('qr-code-styling')> | undefined;

function ensureQrCodeStyling() {
  if (!qrCodeStylingPromise) {
    qrCodeStylingPromise = import('qr-code-styling');
  }
  return qrCodeStylingPromise;
}

const AuthCode = ({
  connectionState,
  authState,
  authQrCode,
  language,
}: StateProps) => {
  const {
    returnToAuthPhoneNumber,
    setSharedSettingOption,
  } = getActions();

  const suggestedLanguage = getSuggestedLanguage();
  const lang = useLang();
  const qrCodeRef = useRef<HTMLDivElement>();

  const isConnected = connectionState === 'connectionStateReady';
  const continueText = useLangString('AuthContinueOnThisLanguage', suggestedLanguage);
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();
  const [isQrMounted, markQrMounted, unmarkQrMounted] = useFlag();

  const accountsInfo = useMultiaccountInfo();
  const hasActiveAccount = Object.values(accountsInfo).length > 0;

  const { result: qrCode } = useAsync(async () => {
    const QrCodeStyling = (await ensureQrCodeStyling()).default;
    return new QrCodeStyling({
      width: QR_SIZE,
      height: QR_SIZE,
      image: blankUrl,
      margin: 10,
      type: 'svg',
      dotsOptions: {
        type: 'rounded',
      },
      cornersSquareOptions: {
        type: 'extra-rounded',
      },
      imageOptions: {
        imageSize: 0.4,
        margin: 8,
      },
      qrOptions: {
        errorCorrectionLevel: 'M',
      },
    });
  }, []);

  const transitionClassNames = useMediaTransitionDeprecated(isQrMounted);

  useLayoutEffect(() => {
    if (!authQrCode || !qrCode) {
      return () => {
        unmarkQrMounted();
      };
    }

    if (!isConnected) {
      return undefined;
    }

    const container = qrCodeRef.current!;
    const data = `${DATA_PREFIX}${authQrCode.token}`;

    if (STRICTERDOM_ENABLED) {
      disableStrict();
    }

    qrCode.update({
      data,
    });

    if (!isQrMounted) {
      qrCode.append(container);
      markQrMounted();
    }

    if (STRICTERDOM_ENABLED) {
      setTimeout(() => {
        enableStrict();
      }, QR_CODE_MUTATION_DURATION);
    }

    return undefined;
  }, [isConnected, authQrCode, isQrMounted, qrCode]);

  const handleBackNavigation = useLastCallback(() => {
    navigateBack();
  });

  const handleLangChange = useLastCallback(() => {
    markIsLoading();

    void oldSetLanguage(suggestedLanguage, () => {
      unmarkIsLoading();

      setSharedSettingOption({ language: suggestedLanguage });
    });
  });

  const handleReturnToAuthPhoneNumber = useLastCallback(() => {
    returnToAuthPhoneNumber();
  });

  const isAuthReady = authState === 'authorizationStateWaitQrCode';

  return (
    <div id="auth-qr-form" className="custom-scroll">
      {hasActiveAccount && (
        <Button size="smaller" round color="translucent" className="auth-close" onClick={handleBackNavigation}>
          <Icon name="close" />
        </Button>
      )}
      <div className="auth-form qr">
        <div className="qr-outer">
          <div
            className={buildClassName('qr-inner', transitionClassNames)}
            key="qr-inner"
          >
            <div
              key="qr-container"
              className="qr-container"
              ref={qrCodeRef}
              style={`width: ${QR_SIZE}px; height: ${QR_SIZE}px`}
            />
            <AnimatedIcon
              tgsUrl={LOCAL_TGS_URLS.QrPlane}
              size={QR_PLANE_SIZE}
              className="qr-plane"
              nonInteractive
              noLoop={false}
            />
          </div>
          {!isQrMounted && <div className="qr-loading"><Loading /></div>}
        </div>
        <h1>{lang('LoginQRTitle')}</h1>
        <ol>
          <li><span>{lang('LoginQRHelp1')}</span></li>
          <li><span>{lang('LoginQRHelp2', undefined, { withNodes: true, withMarkdown: true })}</span></li>
          <li><span>{lang('LoginQRHelp3')}</span></li>
        </ol>
        {isAuthReady && (
          <Button className="auth-button" isText onClick={handleReturnToAuthPhoneNumber}>
            {lang('LoginQRCancel')}
          </Button>
        )}
        {suggestedLanguage && suggestedLanguage !== language && continueText && (
          <Button className="auth-button" isText isLoading={isLoading} onClick={handleLangChange}>
            {continueText}
          </Button>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const {
      connectionState, authState, authQrCode,
    } = global;

    const { language } = selectSharedSettings(global);

    return {
      connectionState,
      authState,
      authQrCode,
      language,
    };
  },
)(AuthCode));
