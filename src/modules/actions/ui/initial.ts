import { addReducer } from '../../../lib/teact/teactn';

import {
  IS_ANDROID, IS_IOS, IS_SAFARI, IS_TOUCH_ENV,
} from '../../../util/environment';
import { setLanguage } from '../../../util/langProvider';
import switchTheme from '../../../util/switchTheme';
import { HistoryWrapper } from '../../../util/history';

addReducer('init', (global) => {
  const {
    theme, animationLevel, messageTextSize, language,
  } = global.settings.byKey;

  setLanguage(language);

  document.documentElement.style.setProperty('--message-text-size', `${messageTextSize}px`);
  document.body.classList.add('initial');
  document.body.classList.add(`animation-level-${animationLevel}`);
  document.body.classList.add(IS_TOUCH_ENV ? 'is-touch-env' : 'is-pointer-env');
  switchTheme(theme, animationLevel > 0);

  if (IS_SAFARI) {
    document.body.classList.add('is-safari');
  }
  if (IS_IOS) {
    document.body.classList.add('is-ios');
  } else if (IS_ANDROID) {
    document.body.classList.add('is-android');
  }
});

addReducer('setIsUiReady', (global, actions, payload) => {
  const { uiReadyState } = payload!;

  if (uiReadyState === 2) {
    document.body.classList.remove('initial');
  }

  return {
    ...global,
    uiReadyState,
  };
});

addReducer('setAuthPhoneNumber', (global, actions, payload) => {
  const { phoneNumber } = payload!;

  HistoryWrapper.pushState({
    type: 'login',
    contentKey: 'authCode',
  });

  return {
    ...global,
    authPhoneNumber: phoneNumber,
  };
});

addReducer('setAuthRememberMe', (global, actions, payload) => {
  return {
    ...global,
    authRememberMe: Boolean(payload),
  };
});

addReducer('clearAuthError', (global) => {
  return {
    ...global,
    authError: undefined,
  };
});

addReducer('setShouldSkipUiLoaderTransition', (global, actions, payload) => {
  const { shouldSkipUiLoaderTransition } = payload;

  return {
    ...global,
    shouldSkipUiLoaderTransition,
  };
});
