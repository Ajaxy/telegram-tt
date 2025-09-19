import type { ChangeEvent } from 'react';
import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiCountryCode } from '../../api/types';
import type { GlobalState } from '../../global/types';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import { IS_SAFARI, IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import { preloadImage } from '../../util/files';
import preloadFonts from '../../util/fonts';
import { pick } from '../../util/iteratees';
import { getAccountSlotUrl } from '../../util/multiaccount';
import { oldSetLanguage } from '../../util/oldLangProvider';
import { formatPhoneNumber, getCountryCodeByIso, getCountryFromPhoneNumber } from '../../util/phoneNumber';
import { navigateBack } from './helpers/backNavigation';
import { getSuggestedLanguage } from './helpers/getSuggestedLanguage';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLangString from '../../hooks/useLangString';
import useLastCallback from '../../hooks/useLastCallback';
import useMultiaccountInfo from '../../hooks/useMultiaccountInfo';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import InputText from '../ui/InputText';
import Loading from '../ui/Loading';
import CountryCodeInput from './CountryCodeInput';

import monkeyPath from '../../assets/monkey.svg';

type StateProps = Pick<GlobalState, (
  'connectionState' | 'authState' |
  'authPhoneNumber' | 'authIsLoading' |
  'authIsLoadingQrCode' | 'authErrorKey' |
  'authRememberMe' | 'authNearestCountry'
)> & {
  language?: string;
  phoneCodeList: ApiCountryCode[];
  isTestServer?: boolean;
};

const MIN_NUMBER_LENGTH = 7;

let isPreloadInitiated = false;

const AuthPhoneNumber: FC<StateProps> = ({
  connectionState,
  authState,
  authPhoneNumber,
  authIsLoading,
  authIsLoadingQrCode,
  authErrorKey,
  authRememberMe,
  authNearestCountry,
  phoneCodeList,
  language,
  isTestServer,
}) => {
  const {
    setAuthPhoneNumber,
    setAuthRememberMe,
    loadNearestCountry,
    loadCountryList,
    clearAuthErrorKey,
    goToAuthQrCode,
    setSharedSettingOption,
  } = getActions();

  const lang = useLang();
  const inputRef = useRef<HTMLInputElement>();
  const suggestedLanguage = getSuggestedLanguage();

  const isConnected = connectionState === 'connectionStateReady';
  const continueText = useLangString('AuthContinueOnThisLanguage', suggestedLanguage);
  const [country, setCountry] = useState<ApiCountryCode | undefined>();
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>();
  const [isTouched, setIsTouched] = useState(false);
  const [lastSelection, setLastSelection] = useState<[number, number] | undefined>();
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();

  const accountsInfo = useMultiaccountInfo();
  const hasActiveAccount = Object.values(accountsInfo).length > 0;
  const phoneNumberSlots = useMemo(() => (
    Object.entries(accountsInfo)
      .filter(([, info]) => info.isTest === isTestServer)
      .reduce((acc, [key, { phone }]) => {
        if (phone) acc[phone] = Number(key);
        return acc;
      }, {} as Record<string, number>)
  ), [accountsInfo, isTestServer]);

  const fullNumber = country ? `+${country.countryCode} ${phoneNumber || ''}` : phoneNumber;
  const canSubmit = fullNumber && fullNumber.replace(/[^\d]+/g, '').length >= MIN_NUMBER_LENGTH;

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      inputRef.current!.focus();
    }
  }, [country]);

  useEffect(() => {
    if (isConnected && !authNearestCountry) {
      loadNearestCountry();
    }
  }, [isConnected, authNearestCountry]);

  useEffect(() => {
    if (isConnected) {
      loadCountryList({ langCode: language });
    }
  }, [isConnected, language]);

  useEffect(() => {
    if (authNearestCountry && phoneCodeList && !country && !isTouched) {
      setCountry(getCountryCodeByIso(phoneCodeList, authNearestCountry));
    }
  }, [country, authNearestCountry, isTouched, phoneCodeList]);

  const parseFullNumber = useLastCallback((newFullNumber: string) => {
    if (!newFullNumber.length) {
      setPhoneNumber('');
    }

    const suggestedCountry = phoneCodeList && getCountryFromPhoneNumber(phoneCodeList, newFullNumber);

    // Any phone numbers should be allowed, in some cases ignoring formatting
    const selectedCountry = !country
      || (suggestedCountry && suggestedCountry.iso2 !== country.iso2)
      || (!suggestedCountry && newFullNumber.length)
      ? suggestedCountry
      : country;

    if (!country || !selectedCountry || (selectedCountry && selectedCountry.iso2 !== country.iso2)) {
      setCountry(selectedCountry);
    }
    setPhoneNumber(formatPhoneNumber(newFullNumber, selectedCountry));
  });

  const handleLangChange = useLastCallback(() => {
    markIsLoading();

    void oldSetLanguage(suggestedLanguage, () => {
      unmarkIsLoading();

      setSharedSettingOption({ language: suggestedLanguage });
    });
  });

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
  const handlePaste = useLastCallback(() => {
    isJustPastedRef.current = true;
    requestMeasure(() => {
      isJustPastedRef.current = false;
    });
  });

  const handleBackNavigation = useLastCallback(() => {
    navigateBack();
  });

  const handleCountryChange = useLastCallback((value: ApiCountryCode) => {
    setCountry(value);
    setPhoneNumber('');
  });

  const handlePhoneNumberChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (authErrorKey) {
      clearAuthErrorKey();
    }

    // This is for further screens. We delay it until user input to speed up the initial loading.
    if (!isPreloadInitiated) {
      isPreloadInitiated = true;
      preloadFonts();
      void preloadImage(monkeyPath);
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
    parseFullNumber(shouldFixSafariAutoComplete ? `${country.countryCode} ${value}` : value);
  });

  const handleKeepSessionChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setAuthRememberMe({ value: e.target.checked });
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authIsLoading) {
      return;
    }

    const adaptedPhoneNumber = fullNumber?.replace(/[^\d]/g, '');
    if (adaptedPhoneNumber && phoneNumberSlots[adaptedPhoneNumber]) {
      window.location.replace(getAccountSlotUrl(phoneNumberSlots[adaptedPhoneNumber]));
      return;
    }

    if (canSubmit) {
      setAuthPhoneNumber({ phoneNumber: fullNumber });
    }
  }

  const handleGoToAuthQrCode = useLastCallback(() => {
    goToAuthQrCode();
  });

  const isAuthReady = authState === 'authorizationStateWaitPhoneNumber';

  return (
    <div id="auth-phone-number-form" className="custom-scroll">
      {hasActiveAccount && (
        <Button size="smaller" round color="translucent" className="auth-close" onClick={handleBackNavigation}>
          <Icon name="close" />
        </Button>
      )}
      <div className="auth-form">
        <div id="logo" />
        <h1>{lang('AuthTitle')}</h1>
        <p className="note">{lang('StartText')}</p>
        <form className="form" action="" onSubmit={handleSubmit}>
          <CountryCodeInput
            id="sign-in-phone-code"
            value={country}
            isLoading={!authNearestCountry && !country}
            onChange={handleCountryChange}
          />
          <InputText
            ref={inputRef}
            id="sign-in-phone-number"
            label={lang('LoginPhonePlaceholder')}
            value={fullNumber}
            error={authErrorKey && lang.withRegular(authErrorKey)}
            inputMode="tel"
            onChange={handlePhoneNumberChange}
            onPaste={IS_SAFARI ? handlePaste : undefined}
          />
          <Checkbox
            id="sign-in-keep-session"
            label={lang('AuthKeepSignedIn')}
            checked={Boolean(authRememberMe)}
            onChange={handleKeepSessionChange}
          />
          {canSubmit && (
            isAuthReady ? (
              <Button
                className="auth-button"
                type="submit"
                ripple
                isLoading={authIsLoading}
              >
                {lang('LoginNext')}
              </Button>
            ) : (
              <Loading />
            )
          )}
          {isAuthReady && (
            <Button
              className="auth-button"
              isText
              ripple
              isLoading={authIsLoadingQrCode}
              onClick={handleGoToAuthQrCode}
            >
              {lang('LoginQRLogin')}
            </Button>
          )}
          {suggestedLanguage && suggestedLanguage !== language && continueText && (
            <Button
              className="auth-button"
              isText
              isLoading={isLoading}
              onClick={handleLangChange}
            >
              {continueText}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const {
      sharedState: { settings: { language } },
      countryList: { phoneCodes: phoneCodeList },
      config,
    } = global;

    return {
      ...pick(global, [
        'connectionState',
        'authState',
        'authPhoneNumber',
        'authIsLoading',
        'authIsLoadingQrCode',
        'authErrorKey',
        'authRememberMe',
        'authNearestCountry',
      ]),
      language,
      phoneCodeList,
      isTestServer: config?.isTestServer,
    } as Complete<StateProps>;
  },
)(AuthPhoneNumber));
