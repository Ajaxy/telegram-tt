import { ChangeEvent } from 'react';

// @ts-ignore
import monkeyPath from '../../assets/monkey.svg';

import React, {
  FC, memo, useCallback, useEffect, useLayoutEffect, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions, GlobalState } from '../../global/types';
import { LangCode } from '../../types';

import { IS_SAFARI, IS_TOUCH_ENV } from '../../util/environment';
import { preloadImage } from '../../util/files';
import preloadFonts from '../../util/fonts';
import { pick } from '../../util/iteratees';
import { formatPhoneNumber, getCountryById, getCountryFromPhoneNumber } from '../../util/phoneNumber';
import { setLanguage } from '../../util/langProvider';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';
import useLangString from '../../hooks/useLangString';
import { getSuggestedLanguage } from './helpers/getSuggestedLanguage';

import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import InputText from '../ui/InputText';
import Loading from '../ui/Loading';
import CountryCodeInput from './CountryCodeInput';

type StateProps = Pick<GlobalState, (
  'connectionState' | 'authState' |
  'authPhoneNumber' | 'authIsLoading' | 'authIsLoadingQrCode' | 'authError' | 'authRememberMe' | 'authNearestCountry'
)> & {
  language?: LangCode;
};
type DispatchProps = Pick<GlobalActions, (
  'setAuthPhoneNumber' | 'setAuthRememberMe' | 'loadNearestCountry' | 'clearAuthError' | 'goToAuthQrCode' |
  'setSettingOption'
)>;

const MIN_NUMBER_LENGTH = 7;

let isPreloadInitiated = false;

const AuthPhoneNumber: FC<StateProps & DispatchProps> = ({
  connectionState,
  authState,
  authPhoneNumber,
  authIsLoading,
  authIsLoadingQrCode,
  authError,
  authRememberMe,
  authNearestCountry,
  language,
  setAuthPhoneNumber,
  setAuthRememberMe,
  loadNearestCountry,
  clearAuthError,
  goToAuthQrCode,
  setSettingOption,
}) => {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestedLanguage = getSuggestedLanguage();

  const continueText = useLangString(suggestedLanguage, 'ContinueOnThisLanguage');
  const [country, setCountry] = useState<Country | undefined>();
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>();
  const [isTouched, setIsTouched] = useState(false);
  const [lastSelection, setLastSelection] = useState<[number, number] | undefined>();
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();

  const fullNumber = country ? `${country.code} ${phoneNumber || ''}` : phoneNumber;
  const canSubmit = fullNumber && fullNumber.replace(/[^\d]+/g, '').length >= MIN_NUMBER_LENGTH;

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      inputRef.current!.focus();
    }
  }, [country]);

  useEffect(() => {
    if (connectionState === 'connectionStateReady' && !authNearestCountry) {
      loadNearestCountry();
    }
  }, [connectionState, authNearestCountry, loadNearestCountry]);

  useEffect(() => {
    if (authNearestCountry && !country && !isTouched) {
      setCountry(getCountryById(authNearestCountry));
    }
  }, [country, authNearestCountry, isTouched]);

  const parseFullNumber = useCallback((newFullNumber: string) => {
    if (!newFullNumber.length) {
      setPhoneNumber('');
    }

    const suggestedCountry = getCountryFromPhoneNumber(newFullNumber);

    // Any phone numbers should be allowed, in some cases ignoring formatting
    const selectedCountry = !country
    || (suggestedCountry && suggestedCountry.id !== country.id)
    || (!suggestedCountry && newFullNumber.length)
      ? suggestedCountry
      : country;

    if (!country || !selectedCountry || (selectedCountry && selectedCountry.code !== country.code)) {
      setCountry(selectedCountry);
    }

    setPhoneNumber(formatPhoneNumber(newFullNumber, selectedCountry));
  }, [country]);

  const handleLangChange = useCallback(() => {
    markIsLoading();

    setLanguage(suggestedLanguage!, () => {
      unmarkIsLoading();

      setSettingOption({ language: suggestedLanguage });
    });
  }, [markIsLoading, setSettingOption, suggestedLanguage, unmarkIsLoading]);

  useEffect(() => {
    if (phoneNumber === undefined && authPhoneNumber) {
      parseFullNumber(authPhoneNumber);
    }
  }, [authPhoneNumber, phoneNumber, parseFullNumber]);

  useLayoutEffect(() => {
    if (inputRef.current && lastSelection) {
      inputRef.current.setSelectionRange(...lastSelection);
    }
  }, [lastSelection]);

  const isJustPastedRef = useRef(false);
  const handlePaste = useCallback(() => {
    isJustPastedRef.current = true;
    requestAnimationFrame(() => {
      isJustPastedRef.current = false;
    });
  }, []);

  const handlePhoneNumberChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (authError) {
      clearAuthError();
    }

    // This is for further screens. We delay it until user input to speed up the initial loading.
    if (!isPreloadInitiated) {
      isPreloadInitiated = true;
      preloadFonts();
      preloadImage(monkeyPath);
    }

    const { value, selectionStart, selectionEnd } = e.target;
    setLastSelection(
      selectionStart && selectionEnd && selectionEnd < value.length
        ? [selectionStart, selectionEnd]
        : undefined,
    );

    setIsTouched(true);

    const shouldFixSafariAutoComplete = (
      IS_SAFARI && country && fullNumber !== undefined
      && value.length - fullNumber.length > 1 && !isJustPastedRef.current
    );
    parseFullNumber(shouldFixSafariAutoComplete ? `${country!.code} ${value}` : value);
  }, [authError, clearAuthError, country, fullNumber, parseFullNumber]);

  const handleKeepSessionChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setAuthRememberMe(e.target.checked);
  }, [setAuthRememberMe]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authIsLoading) {
      return;
    }

    if (canSubmit) {
      setAuthPhoneNumber({ phoneNumber: fullNumber });
    }
  }

  const isAuthReady = authState === 'authorizationStateWaitPhoneNumber';

  return (
    <div id="auth-phone-number-form" className="custom-scroll">
      <div className="auth-form">
        <div id="logo" />
        <h2>Telegram</h2>
        <p className="note">{lang('StartText')}</p>
        <form action="" onSubmit={handleSubmit}>
          <CountryCodeInput
            id="sign-in-phone-code"
            value={country}
            isLoading={!authNearestCountry && !country}
            onChange={setCountry}
          />
          <InputText
            ref={inputRef}
            id="sign-in-phone-number"
            label={lang('Login.PhonePlaceholder')}
            value={fullNumber}
            error={authError && lang(authError)}
            inputMode="tel"
            onChange={handlePhoneNumberChange}
            onPaste={IS_SAFARI ? handlePaste : undefined}
          />
          <Checkbox
            id="sign-in-keep-session"
            label="Keep me signed in"
            checked={Boolean(authRememberMe)}
            onChange={handleKeepSessionChange}
          />
          {canSubmit && (
            isAuthReady ? (
              <Button type="submit" ripple isLoading={authIsLoading}>{lang('Login.Next')}</Button>
            ) : (
              <Loading />
            )
          )}
          {isAuthReady && (
            <Button isText ripple isLoading={authIsLoadingQrCode} onClick={goToAuthQrCode}>
              {lang('Login.QR.Login')}
            </Button>
          )}
          {suggestedLanguage && suggestedLanguage !== language && continueText && (
            <Button isText isLoading={isLoading} onClick={handleLangChange}>{continueText}</Button>
          )}
        </form>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const {
      settings: { byKey: { language } },
    } = global;

    return {
      ...pick(global, [
        'connectionState',
        'authState',
        'authPhoneNumber',
        'authIsLoading',
        'authIsLoadingQrCode',
        'authError',
        'authRememberMe',
        'authNearestCountry',
      ]),
      language,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'setAuthPhoneNumber',
    'setAuthRememberMe',
    'clearAuthError',
    'loadNearestCountry',
    'goToAuthQrCode',
    'setSettingOption',
  ]),
)(AuthPhoneNumber));
