import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useLayoutEffect, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';
import type { LangCode } from '../../types';

import { DEFAULT_LANG_CODE } from '../../config';
import { disableStrict, enableStrict } from '../../lib/fasterdom/stricterdom';
import buildClassName from '../../util/buildClassName';
import { setLanguage } from '../../util/langProvider';
import { LOCAL_TGS_URLS } from '../common/helpers/animatedAssets';
import renderText from '../common/helpers/renderText';
import { getSuggestedLanguage } from './helpers/getSuggestedLanguage';

import useAsync from '../../hooks/useAsync';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLangString from '../../hooks/useLangString';
import useMediaTransition from '../../hooks/useMediaTransition';

import AnimatedIcon from '../common/AnimatedIcon';
import Button from '../ui/Button';
import Loading from '../ui/Loading';

import blankUrl from '../../assets/blank.png';

type StateProps =
  Pick<GlobalState, 'connectionState' | 'authState' | 'authQrCode'>
  & { language?: LangCode };

const DATA_PREFIX = 'tg://login?token=';
const QR_SIZE = 280;
const QR_PLANE_SIZE = 54;
const QR_CODE_MUTATION_DURATION = 50; // The library is asynchronous and we need to wait for its mutation code

let qrCodeStylingPromise: Promise<typeof import('qr-code-styling')>;

function ensureQrCodeStyling() {
  if (!qrCodeStylingPromise) {
    qrCodeStylingPromise = import('qr-code-styling');
  }
  return qrCodeStylingPromise;
}

const AuthCode: FC<StateProps> = ({
  connectionState,
  authState,
  authQrCode,
  language,
}) => {
  const {
    returnToAuthPhoneNumber,
    setSettingOption,
  } = getActions();

  const suggestedLanguage = getSuggestedLanguage();
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const qrCodeRef = useRef<HTMLDivElement>(null);

  const isConnected = connectionState === 'connectionStateReady';
  const continueText = useLangString(isConnected ? suggestedLanguage : undefined, 'ContinueOnThisLanguage', true);
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();
  const [isQrMounted, markQrMounted, unmarkQrMounted] = useFlag();

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

  const transitionClassNames = useMediaTransition(isQrMounted);

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

    disableStrict();

    qrCode.update({
      data,
    });

    if (!isQrMounted) {
      qrCode.append(container);
      markQrMounted();
    }

    setTimeout(() => {
      enableStrict();
    }, QR_CODE_MUTATION_DURATION);

    return undefined;
  }, [isConnected, authQrCode, isQrMounted, markQrMounted, unmarkQrMounted, qrCode]);

  useEffect(() => {
    if (isConnected) {
      void setLanguage(DEFAULT_LANG_CODE);
    }
  }, [isConnected]);

  const handleLangChange = useCallback(() => {
    markIsLoading();

    void setLanguage(suggestedLanguage, () => {
      unmarkIsLoading();

      setSettingOption({ language: suggestedLanguage });
    });
  }, [markIsLoading, setSettingOption, suggestedLanguage, unmarkIsLoading]);

  const habdleReturnToAuthPhoneNumber = useCallback(() => {
    returnToAuthPhoneNumber();
  }, [returnToAuthPhoneNumber]);

  const isAuthReady = authState === 'authorizationStateWaitQrCode';

  return (
    <div id="auth-qr-form" className="custom-scroll">
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
        <h1>{lang('Login.QR.Title')}</h1>
        <ol>
          <li><span>{lang('Login.QR.Help1')}</span></li>
          <li><span>{renderText(lang('Login.QR2.Help2'), ['simple_markdown'])}</span></li>
          <li><span>{lang('Login.QR.Help3')}</span></li>
        </ol>
        {isAuthReady && (
          <Button onClick={habdleReturnToAuthPhoneNumber}>{lang('Login.QR.Cancel')}</Button>
        )}
        {suggestedLanguage && suggestedLanguage !== language && continueText && (
          <Button isText color="secondary" isLoading={isLoading} onClick={handleLangChange}>{continueText}</Button>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const {
      connectionState, authState, authQrCode, settings: { byKey: { language } },
    } = global;

    return {
      connectionState,
      authState,
      authQrCode,
      language,
    };
  },
)(AuthCode));
