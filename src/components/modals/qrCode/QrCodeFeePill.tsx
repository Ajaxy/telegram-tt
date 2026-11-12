import {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type {
  FeePillEffect, FeePillMode, FeePillState,
} from './helpers/feePillEffect';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { animate } from '../../../util/animation';
import buildClassName from '../../../util/buildClassName';
import {
  CANVAS_ABOVE, CANVAS_HEIGHT, CANVAS_WIDTH, createFeePillEffect,
} from './helpers/feePillEffect';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import { useStateRef } from '../../../hooks/useStateRef';
import useWindow from '../../../hooks/useWindow';

import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem, { MenuItemSubtitle, MenuItemTitle } from '../../ui/MenuItem';

import styles from './QrCodeFeePill.module.scss';

type OwnProps = {
  price: number;
  mode: FeePillMode;
  timerEndsAt?: number;
  ink: string;
  foreground: string;
  canAnimate?: boolean;
  onRemoveFee: NoneToVoidFunction;
  onToggleTimer: NoneToVoidFunction;
  onReset: NoneToVoidFunction;
  onRestoreFee: NoneToVoidFunction;
};

const AMOUNT_PLACEHOLDER = '\u0000';
const DEFAULT_MEDIUM_WEIGHT = '500';
const MAX_PIXEL_RATIO = 2;

const QrCodeFeePill = ({
  price,
  mode,
  timerEndsAt,
  ink,
  foreground,
  canAnimate,
  onRemoveFee,
  onToggleTimer,
  onReset,
  onRestoreFee,
}: OwnProps) => {
  const lang = useLang();

  const renderingWindow = useWindow();
  const pillRef = useRef<HTMLButtonElement>();
  const canvasRef = useRef<HTMLCanvasElement>();
  const effectRef = useRef<FeePillEffect>();
  const [menuMode, setMenuMode] = useState(mode);

  const [feeBefore, feeSuffix] = lang('QrFreeRemoveFee', { amount: AMOUNT_PLACEHOLDER }).split(AMOUNT_PLACEHOLDER);
  const state: FeePillState = {
    mode,
    timerEndsAt,
    feeBefore: feeBefore.trimEnd(),
    feeAfter: `${lang.number(price)}${feeSuffix}`.trimStart(),
    free: lang('QrFree'),
    noTimeLimit: lang('QrFreeNoTimeLimit'),
    formatExpiresIn: (time) => lang('QrFreeExpiresIn', { time }),
    canAnimate: Boolean(canAnimate),
    isRtl: Boolean(lang.isRtl),
  };
  const stateRef = useStateRef(state);
  const colorsRef = useStateRef({ ink, foreground });

  useLayoutEffect(() => {
    let isCancelled = false;

    requestMeasure(() => {
      const pill = pillRef.current;
      const canvas = canvasRef.current;
      if (isCancelled || !pill || !canvas) return;

      const { fontFamily, fontSize } = renderingWindow.getComputedStyle(pill);
      const mediumWeight = renderingWindow.getComputedStyle(renderingWindow.document.documentElement)
        .getPropertyValue('--font-weight-medium').trim();
      const fonts = {
        regular: `400 ${fontSize} ${fontFamily}`,
        medium: `${mediumWeight || DEFAULT_MEDIUM_WEIGHT} ${fontSize} ${fontFamily}`,
      };

      requestMutation(() => {
        if (isCancelled) return;
        effectRef.current = createFeePillEffect({
          canvas,
          pillElement: pill,
          fonts,
          colors: colorsRef.current,
          dpr: Math.min(renderingWindow.devicePixelRatio || 1, MAX_PIXEL_RATIO),
          schedule: (tick) => animate(tick, requestMutation),
        });
        effectRef.current.update(stateRef.current);
      });
    });

    return () => {
      isCancelled = true;
      effectRef.current?.destroy();
      effectRef.current = undefined;
    };
  }, [colorsRef, stateRef, renderingWindow, lang.code]);

  useEffect(() => {
    effectRef.current?.update(stateRef.current);
  }, [mode, timerEndsAt, price, canAnimate, lang, stateRef]);

  useEffect(() => {
    effectRef.current?.setColors({ ink, foreground });
  }, [ink, foreground]);

  const handleMenuOpen = useLastCallback(() => {
    setMenuMode(mode);
  });

  const handlePillContextMenu = useLastCallback((
    e: React.MouseEvent, onTrigger: NoneToVoidFunction, isMenuOpen?: boolean,
  ) => {
    e.preventDefault();
    if (!isMenuOpen) onTrigger();
  });

  const isFree = mode !== 'fee';
  const isTemporary = mode === 'temporary';
  const isMenuTemporary = menuMode === 'temporary';
  const ariaLabel = isFree
    ? `${lang('QrFree')}, ${lang(isTemporary ? 'QrFreeMenuEnableTimerAbout' : 'QrFreeNoTimeLimit')}`
    : lang('QrFreeRemoveFee', { amount: lang.number(price) });

  return (
    <div className={buildClassName(styles.root, isFree && styles.free)}>
      <DropdownMenu
        className="with-menu-transitions"
        positionX="center"
        positionY="bottom"
        onOpen={handleMenuOpen}
        trigger={({ onTrigger, isOpen }) => (
          <button
            ref={pillRef}
            type="button"
            className={buildClassName(styles.pill, isOpen && styles.active)}
            aria-label={ariaLabel}
            onClick={isFree ? onTrigger : onRemoveFee}
            onContextMenu={isFree ? (e) => handlePillContextMenu(e, onTrigger, isOpen) : undefined}
          />
        )}
      >
        <MenuItem icon="reload-arrows" onClick={onReset}>
          {lang('QrFreeMenuReset')}
        </MenuItem>
        <MenuItem icon={isMenuTemporary ? 'timer-off' : 'clock'} onClick={onToggleTimer}>
          <MenuItemTitle>
            {lang(isMenuTemporary ? 'QrFreeMenuDisableTimer' : 'QrFreeMenuEnableTimer')}
          </MenuItemTitle>
          <MenuItemSubtitle>
            {lang(isMenuTemporary ? 'QrFreeMenuDisableTimerAbout' : 'QrFreeMenuEnableTimerAbout')}
          </MenuItemSubtitle>
        </MenuItem>
        <MenuItem icon="star-outline" onClick={onRestoreFee}>
          {lang('QrFreeMenuRestoreFee')}
        </MenuItem>
      </DropdownMenu>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={`width: ${CANVAS_WIDTH}px; height: ${CANVAS_HEIGHT}px; top: -${CANVAS_ABOVE}px`}
      />
    </div>
  );
};

export default memo(QrCodeFeePill);
