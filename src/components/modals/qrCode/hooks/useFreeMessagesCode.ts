import { useEffect, useRef, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { IconName } from '../../../../types/icons';
import type { RegularLangKey } from '../../../../types/language';
import type { FeePillMode } from '../helpers/feePillEffect';

import { getServerTime } from '../../../../util/serverTime';
import { callApi } from '../../../../api/gramjs';
import { FREE_WINDOW_MS } from '../helpers/feePillEffect';

import useLastCallback from '../../../../hooks/useLastCallback';

type FreeMode = Exclude<FeePillMode, 'fee'>;

type FreeCode = {
  url: string;
  isTemporary: boolean;
  expires?: number;
  receivedAt: number;
};

type State = {
  mode: FeePillMode;
  code?: FreeCode;
  timerEndsAt?: number;
  timerEndsAtBeforeReset?: number;
  failedAt?: number;
  isReplacingCode?: boolean;
  isCodeExpired?: boolean;
};

type CodeRequestOptions = {
  shouldRevoke?: boolean;
  shouldRevokePermanent?: boolean;
  isRotation?: boolean;
};

type RestoreReason = 'restored' | 'expired' | 'error';

const ROTATION_INTERVAL = 30000;
const ROTATION_MARGIN = 5000;
const ROTATION_MIN_DELAY = 1000;
const ROTATION_RETRY_DELAY = 3000;
const COPY_CUTOFF = 3;
const MS_IN_SECOND = 1000;

const RESTORE_TOAST_KEYS: Record<RestoreReason, RegularLangKey> = {
  restored: 'QrFreeToastRestored',
  expired: 'QrFreeToastExpired',
  error: 'GeneralError',
};

export default function useFreeMessagesCode({
  isOpen, price, plainLink, permanentLink,
}: {
  isOpen: boolean;
  price?: number;
  plainLink?: string;
  permanentLink?: string;
}) {
  const { showNotification, setSettingOption } = getActions();

  const [state, setState] = useState<State>(() => getInitialState(permanentLink));
  const generationRef = useRef(0);
  const savedLinkGenerationRef = useRef(0);
  const closedWindowRevokeRef = useRef<number>();

  const notify = useLastCallback((key: RegularLangKey, icon: IconName, withMarkdown?: boolean) => {
    showNotification({
      message: { key, options: withMarkdown ? { withNodes: true, withMarkdown: true } : undefined },
      icon,
    });
  });

  const requestCode = useLastCallback(async (
    mode: FreeMode, { shouldRevoke, shouldRevokePermanent, isRotation }: CodeRequestOptions = {},
  ) => {
    generationRef.current += 1;
    const generation = generationRef.current;
    const isTemporary = mode === 'temporary';

    if (shouldRevokePermanent) {
      const revoked = await callApi('exportNoPaidMessagesToken', { shouldRevoke: true });
      if (revoked) savePermanentLink(generation);
      if (generation !== generationRef.current) return;

      if (!revoked) {
        handleCodeError();
        return;
      }
    }

    const result = await callApi('exportNoPaidMessagesToken', {
      isTemporary: isTemporary ? true : undefined,
      shouldRevoke: shouldRevoke ? true : undefined,
    });
    if (result && !isTemporary) savePermanentLink(generation, result.url);
    if (generation !== generationRef.current) return;

    if (!result) {
      if (shouldRevokePermanent) {
        endFreeMode('error');
      } else {
        handleCodeError(isRotation);
      }
      return;
    }

    const now = Date.now();
    setState((current) => {
      if (current.mode !== mode) return current;

      return {
        mode,
        code: {
          url: result.url, isTemporary, expires: result.expires, receivedAt: now,
        },
        timerEndsAt: isTemporary ? current.timerEndsAt ?? now + FREE_WINDOW_MS : undefined,
      };
    });
  });

  const handleCodeError = useLastCallback((isRotation?: boolean) => {
    const { code, failedAt } = state;
    if (!code) {
      endFreeMode('error');
      return;
    }

    if (!isRotation || !failedAt) notify('GeneralError', 'warning');
    const now = Date.now();
    setState((current) => ({
      ...current,
      mode: code.isTemporary ? 'temporary' : 'permanent',
      timerEndsAt: code.isTemporary
        ? current.timerEndsAt ?? current.timerEndsAtBeforeReset ?? now + FREE_WINDOW_MS
        : undefined,
      timerEndsAtBeforeReset: undefined,
      failedAt: now,
      isReplacingCode: undefined,
    }));
  });

  const savePermanentLink = useLastCallback((generation: number, link?: string) => {
    if (generation < savedLinkGenerationRef.current) return;

    savedLinkGenerationRef.current = generation;
    setSettingOption({ permanentFreeMessagesLink: link });
  });

  const revokeTemporaryCodes = useLastCallback(async () => {
    const result = await callApi('exportNoPaidMessagesToken', { isTemporary: true, shouldRevoke: true });
    if (!result) notify('GeneralError', 'warning');
  });

  const endFreeMode = useLastCallback((reason?: RestoreReason) => {
    if (state.mode === 'fee') return;
    generationRef.current += 1;
    setState({ mode: 'fee' });
    if (reason) notify(RESTORE_TOAST_KEYS[reason], 'star');
  });

  const scheduleClosedWindowRevoke = useLastCallback(() => {
    const { mode: currentMode, timerEndsAt: currentTimerEndsAt } = state;
    if (currentMode !== 'temporary' || currentTimerEndsAt === undefined) return;

    window.clearTimeout(closedWindowRevokeRef.current);
    closedWindowRevokeRef.current = window.setTimeout(
      revokeTemporaryCodes,
      Math.max(0, currentTimerEndsAt - Date.now()),
    );
  });

  const removeFee = useLastCallback(() => {
    if (state.mode !== 'fee') return;
    window.clearTimeout(closedWindowRevokeRef.current);
    setState({ mode: 'temporary' });
    notify('QrFreeToastExpires', 'clock', true);
    requestCode('temporary');
  });

  const toggleTimer = useLastCallback(() => {
    if (state.mode === 'fee') return;
    const mode = state.mode === 'temporary' ? 'permanent' : 'temporary';
    setState((current) => ({
      ...current,
      mode,
      timerEndsAt: mode === 'temporary' ? undefined : current.timerEndsAt,
      isReplacingCode: true,
    }));
    if (mode === 'temporary') {
      notify('QrFreeToastExpires', 'clock', true);
    } else {
      notify('QrFreeToastPermanent', 'clock');
    }
    requestCode(mode, { shouldRevokePermanent: mode === 'temporary' });
  });

  const resetCode = useLastCallback(() => {
    if (state.mode === 'fee') return;
    setState((current) => ({
      ...current,
      timerEndsAt: undefined,
      timerEndsAtBeforeReset: current.timerEndsAt ?? current.timerEndsAtBeforeReset,
      isReplacingCode: true,
    }));
    if (state.mode === 'temporary') {
      notify('QrFreeToastExpires', 'clock', true);
    } else {
      notify('QrFreeToastReset', 'check');
    }
    requestCode(state.mode, { shouldRevoke: true });
  });

  const restoreFee = useLastCallback(async () => {
    if (state.mode === 'fee') return;
    generationRef.current += 1;
    const generation = generationRef.current;
    setState((current) => ({ ...current, isReplacingCode: true }));

    const result = await callApi('exportNoPaidMessagesToken', { shouldRevoke: true });
    if (result) savePermanentLink(generation);
    if (generation !== generationRef.current) return;

    if (!result) {
      handleCodeError();
      return;
    }

    endFreeMode('restored');
  });

  const handleOpen = useLastCallback(() => {
    if (!price) {
      endFreeMode();
    } else if (state.mode === 'permanent') {
      requestCode('permanent');
    }
  });

  useEffect(() => {
    if (isOpen) handleOpen();
  }, [isOpen, price, handleOpen]);

  useEffect(() => {
    if (isOpen) {
      setState((current) => getStateWithPermanentLink(current, permanentLink));
      return;
    }

    scheduleClosedWindowRevoke();
    generationRef.current += 1;
    setState(getInitialState(permanentLink));
  }, [isOpen, permanentLink, scheduleClosedWindowRevoke]);

  const {
    mode, code, timerEndsAt, failedAt, isReplacingCode, isCodeExpired,
  } = state;
  const isTimerRunning = mode === 'temporary' && timerEndsAt !== undefined;
  const codeExpires = code?.isTemporary ? code.expires : undefined;

  const handleTimerEnd = useLastCallback(() => {
    revokeTemporaryCodes();
    endFreeMode('expired');
  });
  useEffect(() => {
    if (!isTimerRunning) return undefined;

    const timeout = window.setTimeout(handleTimerEnd, Math.max(0, timerEndsAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [isTimerRunning, timerEndsAt, handleTimerEnd]);

  const handleRotate = useLastCallback(() => requestCode('temporary', { isRotation: true }));
  useEffect(() => {
    const delay = isTimerRunning && code?.isTemporary && !isReplacingCode
      ? getRotationDelay(code, timerEndsAt, failedAt)
      : undefined;
    if (delay === undefined) return undefined;

    const timeout = window.setTimeout(handleRotate, delay);
    return () => window.clearTimeout(timeout);
  }, [isTimerRunning, code, timerEndsAt, failedAt, isReplacingCode, handleRotate]);

  useEffect(() => {
    if (!code || codeExpires === undefined) return undefined;

    const timeout = window.setTimeout(() => {
      setState((current) => (current.code === code ? { ...current, isCodeExpired: true } : current));
    }, Math.max(0, (codeExpires - getServerTime()) * MS_IN_SECOND));
    return () => window.clearTimeout(timeout);
  }, [code, codeExpires]);

  const getIsCodeExpiring = useLastCallback(() => (
    (codeExpires !== undefined && codeExpires - getServerTime() < COPY_CUTOFF)
    || (timerEndsAt !== undefined && timerEndsAt - Date.now() < COPY_CUTOFF * MS_IN_SECOND)
  ));

  const isFree = Boolean(price) && mode !== 'fee';
  const shownCode = isFree && !isCodeExpired ? code : undefined;
  const hasReadyCode = code?.isTemporary === (mode === 'temporary') && !isReplacingCode && !isCodeExpired;

  return {
    mode,
    timerEndsAt,
    link: shownCode?.url || plainLink,
    isLinkPending: isFree && !hasReadyCode,
    getIsCodeExpiring,
    removeFee,
    toggleTimer,
    resetCode,
    restoreFee,
  };
}

function getInitialState(permanentLink?: string): State {
  if (!permanentLink) return { mode: 'fee' };

  return {
    mode: 'permanent',
    code: { url: permanentLink, isTemporary: false, receivedAt: Date.now() },
  };
}

function getStateWithPermanentLink(state: State, permanentLink?: string): State {
  const { mode, code, isReplacingCode } = state;
  if (!permanentLink || mode !== 'permanent' || isReplacingCode || !code || code.url === permanentLink) return state;

  return { ...state, code: { ...code, url: permanentLink } };
}

function getRotationDelay(code: FreeCode, timerEndsAt: number, failedAt?: number) {
  const now = Date.now();
  const byAge = code.receivedAt + ROTATION_INTERVAL - now;
  const byExpiry = code.expires !== undefined
    ? (code.expires - getServerTime()) * MS_IN_SECOND - ROTATION_MARGIN
    : byAge;
  const byRetry = failedAt !== undefined ? failedAt + ROTATION_RETRY_DELAY - now : 0;
  const delay = Math.max(ROTATION_MIN_DELAY, byRetry, Math.min(byAge, byExpiry));
  return now + delay < timerEndsAt ? delay : undefined;
}
