import QrCreator from 'qr-creator';
import React, {
  FC, useEffect, useRef, memo, useCallback,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalState, GlobalActions } from '../../global/types';
import { LangCode } from '../../types';

import { DEFAULT_LANG_CODE } from '../../config';
import { pick } from '../../util/iteratees';
import { setLanguage } from '../../util/langProvider';
import renderText from '../common/helpers/renderText';
import useLangString from '../../hooks/useLangString';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import { getSuggestedLanguage } from './helpers/getSuggestedLanguage';

import Loading from '../ui/Loading';
import Button from '../ui/Button';

type StateProps = Pick<GlobalState, 'connectionState' | 'authState' | 'authQrCode'> & {
  language?: LangCode;
};
type DispatchProps = Pick<GlobalActions, (
  'returnToAuthPhoneNumber' | 'setSettingOption'
)>;

const DATA_PREFIX = 'tg://login?token=';

const AuthCode: FC<StateProps & DispatchProps> = ({
  connectionState,
  authState,
  authQrCode,
  language,
  returnToAuthPhoneNumber,
  setSettingOption,
}) => {
  const suggestedLanguage = getSuggestedLanguage();
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const continueText = useLangString(suggestedLanguage, 'ContinueOnThisLanguage');
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();

  useEffect(() => {
    if (!authQrCode || connectionState !== 'connectionStateReady') {
      return;
    }

    const container = qrCodeRef.current!;

    container.innerHTML = '';
    container.classList.remove('pre-animate');

    QrCreator.render({
      text: `${DATA_PREFIX}${authQrCode.token}`,
      radius: 0.5,
      ecLevel: 'M',
      fill: '#4E96D4',
      size: 280,
    }, container);
  }, [connectionState, authQrCode]);

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
          <div key="qr-container" className="qr-container pre-animate" ref={qrCodeRef} />
        ) : (
          <div key="qr-loading" className="qr-loading"><Loading /></div>
        )}
        <h3>{lang('Login.QR.Title')}</h3>
        <ol>
          <li><span>{lang('Login.QR.Help1')}</span></li>
          <li><span>{renderText(lang('Login.QR.Help2'), ['simple_markdown'])}</span></li>
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
  (setGlobal, actions): DispatchProps => pick(actions, [
    'returnToAuthPhoneNumber', 'setSettingOption',
  ]),
)(AuthCode));
