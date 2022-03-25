import QrCodeStyling from 'qr-code-styling';
import React, {
  FC, useEffect, useRef, memo, useCallback, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { GlobalState } from '../../global/types';
import { LangCode } from '../../types';

import { DEFAULT_LANG_CODE } from '../../config';
import { setLanguage } from '../../util/langProvider';
import renderText from '../common/helpers/renderText';
import { getSuggestedLanguage } from './helpers/getSuggestedLanguage';
import getAnimationData from '../common/helpers/animatedAssets';

import useLangString from '../../hooks/useLangString';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import Loading from '../ui/Loading';
import Button from '../ui/Button';
import AnimatedSticker from '../common/AnimatedSticker';
import blankUrl from '../../assets/blank.png';

type StateProps =
  Pick<GlobalState, 'connectionState' | 'authState' | 'authQrCode'>
  & {
    language?: LangCode;
  };

const DATA_PREFIX = 'tg://login?token=';
const QR_SIZE = 280;
const QR_PLANE_SIZE = 54;

const QR_CODE = new QrCodeStyling({
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
  const continueText = useLangString(suggestedLanguage, 'ContinueOnThisLanguage');
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();
  const [isQrMounted, markQrMounted, unmarkQrMounted] = useFlag();

  const [animationData, setAnimationData] = useState<string>();
  const [isAnimationLoaded, setIsAnimationLoaded] = useState(false);
  const handleAnimationLoad = useCallback(() => setIsAnimationLoaded(true), []);

  useEffect(() => {
    if (!animationData) {
      getAnimationData('QrPlane').then(setAnimationData);
    }
  }, [animationData]);

  useEffect(() => {
    if (!authQrCode) {
      return () => {
        unmarkQrMounted();
      };
    }

    if (connectionState !== 'connectionStateReady') {
      return undefined;
    }

    const container = qrCodeRef.current!;

    container.parentElement!.classList.remove('pre-animate');

    const data = `${DATA_PREFIX}${authQrCode.token}`;

    QR_CODE.update({
      data,
    });

    if (!isQrMounted) {
      QR_CODE.append(container);
      markQrMounted();
    }
    return undefined;
  }, [connectionState, authQrCode, isQrMounted, markQrMounted, unmarkQrMounted]);

  useEffect(() => {
    if (connectionState === 'connectionStateReady') {
      void setLanguage(DEFAULT_LANG_CODE);
    }
  }, [connectionState]);

  const handleLangChange = useCallback(() => {
    markIsLoading();

    void setLanguage(suggestedLanguage, () => {
      unmarkIsLoading();

      setSettingOption({ language: suggestedLanguage });
    });
  }, [markIsLoading, setSettingOption, suggestedLanguage, unmarkIsLoading]);

  const isAuthReady = authState === 'authorizationStateWaitQrCode';

  return (
    <div id="auth-qr-form" className="custom-scroll">
      <div className="auth-form qr">
        {authQrCode ? (
          <div className="qr-wrapper pre-animate" key="qr-wrapper">
            <div
              key="qr-container"
              className="qr-container"
              ref={qrCodeRef}
              style={`width: ${QR_SIZE}px; height: ${QR_SIZE}px`}
            />
            {animationData && (
              <AnimatedSticker
                id="qrPlane"
                className="qr-plane"
                size={QR_PLANE_SIZE}
                animationData={animationData}
                play={isAnimationLoaded}
                onLoad={handleAnimationLoad}
                key="qrPlane"
              />
            )}
          </div>
        ) : (
          <div key="qr-loading" className="qr-loading"><Loading /></div>
        )}
        <h3>{lang('Login.QR.Title')}</h3>
        <ol>
          <li><span>{lang('Login.QR.Help1')}</span></li>
          <li><span>{renderText(lang('Login.QR2.Help2'), ['simple_markdown'])}</span></li>
          <li><span>{lang('Login.QR.Help3')}</span></li>
        </ol>
        {isAuthReady && (
          <Button isText onClick={returnToAuthPhoneNumber}>{lang('Login.QR.Cancel')}</Button>
        )}
        {suggestedLanguage && suggestedLanguage !== language && continueText && (
          <Button isText isLoading={isLoading} onClick={handleLangChange}>{continueText}</Button>
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
