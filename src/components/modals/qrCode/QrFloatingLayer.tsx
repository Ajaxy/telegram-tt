import type { ElementRef } from '../../../lib/teact/teact';
import {
  memo, useLayoutEffect, useMemo, useRef, useState, useUnmountCleanup,
} from '../../../lib/teact/teact';

import type {
  ApiAvailableReaction, ApiReaction, ApiStarGiftUnique, ApiSticker,
} from '../../../api/types';
import type { LayerItem, LayerMotion, LayerRect, Point } from './helpers/floatingLayer';
import type { WaveFrame } from './helpers/themeWave';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getDocumentMediaHash, getReactionKey, getStickerMediaHash, isSameReaction } from '../../../global/helpers';
import { animate } from '../../../util/animation';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { clamp } from '../../../util/math';
import { getGiftAttributes } from '../../common/helpers/gifts';
import {
  enumerateEmojiItems,
  enumerateGiftModels,
  enumerateGiftSymbols,
  getIsCoveredByCard,
  getPickIndex,
  MAX_EMOJI_ITEM_SIZE,
  MAX_GIFT_MODEL_SIZE,
  MAX_GIFT_SYMBOL_SIZE,
} from './helpers/floatingLayer';
import { getWaveMaxRadius, getWavePush, WAVE_PUSH_DURATION } from './helpers/themeWave';

import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useResizeObserver from '../../../hooks/useResizeObserver';
import { useStateRef } from '../../../hooks/useStateRef';

import AnimatedSticker from '../../common/AnimatedSticker';
import CustomEmoji from '../../common/CustomEmoji';
import StickerView from '../../common/StickerView';

import styles from './QrFloatingLayer.module.scss';

type OwnProps = {
  emojis?: ApiReaction[];
  gift?: ApiStarGiftUnique;
  availableReactions?: ApiAvailableReaction[];
  foregroundColor: string;
  cardRef: ElementRef<HTMLDivElement>;
  // Changes when the card moves without resizing the layer
  cardLayoutKey?: string;
  motion: LayerMotion;
  waveStartedAt?: number;
  noAnimation?: boolean;
  canPlayEmojis?: boolean;
  onClick?: NoneToVoidFunction;
};

type LayerKind = 'emoji' | 'model' | 'symbol';

type RenderedTiles = {
  signature: string;
  emoji: LayerItem[];
  model: LayerItem[];
  symbol: LayerItem[];
};

type EntryAnimation = {
  duration: number;
  stagger: number;
  isFade?: boolean;
};

type TileFrame = {
  card?: LayerRect;
  now: number;
  entryAt: number;
  wave?: WaveFrame;
};

const EMOJI_RENDER_SIZE = Math.ceil(MAX_EMOJI_ITEM_SIZE);
const MODEL_RENDER_SIZE = Math.ceil(MAX_GIFT_MODEL_SIZE);
const SYMBOL_RENDER_SIZE = Math.ceil(MAX_GIFT_SYMBOL_SIZE);
// Custom emoji take their size from the variable and would stay text-sized in a tile
const CUSTOM_EMOJI_STYLE = `--custom-emoji-size: ${EMOJI_RENDER_SIZE}px`;
const SYMBOL_OPACITY = 0.37;
// Covers the card wrapper's transform, which lands after the layer measures the card
const CARD_SETTLE_DURATION = 300;
const BACK_OVERSHOOT = 1.70158;

const RENDER_SIZE_BY_KIND: Record<LayerKind, number> = {
  emoji: EMOJI_RENDER_SIZE,
  model: MODEL_RENDER_SIZE,
  symbol: SYMBOL_RENDER_SIZE,
};

const TILE_STYLE_BY_KIND: Record<LayerKind, string> = {
  emoji: buildTileStyle(EMOJI_RENDER_SIZE),
  model: buildTileStyle(MODEL_RENDER_SIZE),
  symbol: buildTileStyle(SYMBOL_RENDER_SIZE),
};

const ENTRY_BY_KIND: Record<LayerKind, EntryAnimation> = {
  emoji: { duration: 315, stagger: 300 },
  model: { duration: 380, stagger: 300 },
  symbol: { duration: 300, stagger: 300, isFade: true },
};

const PUSH_MASS_SIZE_BY_KIND: Record<LayerKind, number> = {
  emoji: 24,
  model: 40,
  symbol: 15,
};

// Emoji tiles stay mounted when their pick changes, so only the changed ones pop in
const emojiTileStates = new WeakMap<HTMLElement, { reaction?: string; appearAt: number }>();

const NO_TILES: LayerItem[] = [];

const EMPTY_TILES: RenderedTiles = {
  signature: '', emoji: [], model: [], symbol: [],
};

const QrFloatingLayer = ({
  emojis,
  gift,
  availableReactions,
  foregroundColor,
  cardRef,
  cardLayoutKey,
  motion,
  waveStartedAt,
  noAnimation,
  canPlayEmojis,
  onClick,
}: OwnProps) => {
  const rootRef = useRef<HTMLDivElement>();
  const entryAtRef = useRef(0);
  const settleUntilRef = useRef(0);
  const isLoopActiveRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const [tiles, setTiles] = useState<RenderedTiles>(EMPTY_TILES);
  const tilesRef = useStateRef(tiles);
  const emojisRef = useStateRef(emojis);
  const giftRef = useStateRef(gift);
  const noAnimationRef = useStateRef(noAnimation);
  const waveStartedAtRef = useStateRef(waveStartedAt);

  const { model, pattern, backdrop } = (gift && getGiftAttributes(gift)) || {};
  const patternUrl = useMedia(pattern && getStickerMediaHash(pattern.sticker, 'preview'));
  const contentKey = gift ? gift.id : emojis?.map(getReactionKey).join(',');
  const contentKeyRef = useStateRef(contentKey);
  // A layer revealed by a wave shows its initial emojis and symbols at once, like the native apps
  const waveContentKeyRef = useRef(waveStartedAt ? contentKey : undefined);

  const tick = useLastCallback(() => {
    const root = rootRef.current;
    if (!root || isUnmountedRef.current) {
      isLoopActiveRef.current = false;
      return false;
    }

    const now = performance.now();
    const isStatic = noAnimationRef.current;
    const rootRect = root.getBoundingClientRect();
    const cardRect = cardRef.current?.getBoundingClientRect();
    // Client rects include the modal's opening scale, while tiles are positioned in the layer's own pixels
    const ratio = root.offsetWidth ? rootRect.width / root.offsetWidth : 1;
    const area: LayerRect = {
      left: 0, top: 0, width: root.offsetWidth, height: root.offsetHeight,
    };
    const card: LayerRect | undefined = cardRect && {
      left: (cardRect.left - rootRect.left) / ratio,
      top: (cardRect.top - rootRect.top) / ratio,
      width: cardRect.width / ratio,
      height: cardRect.height / ratio,
    };

    const elapsed = motion.getElapsed(now);
    if (!isStatic) {
      motion.advance(now, elapsed);
    }

    const offset = motion.getOffset();
    const center = card || area;
    const origin: Point = {
      x: center.left + center.width / 2 + offset.x,
      y: center.top + center.height / 2 + offset.y,
    };
    const seconds = isStatic ? 0 : elapsed / 1000;
    const emojiCount = emojisRef.current?.length || 0;
    const hasGift = Boolean(giftRef.current);

    const nextTiles: Omit<RenderedTiles, 'signature'> = {
      emoji: emojiCount ? enumerateEmojiItems(area, origin, emojiCount, seconds) : [],
      model: hasGift ? enumerateGiftModels(area, origin) : [],
      symbol: hasGift ? enumerateGiftSymbols(area, origin) : [],
    };
    const signature = buildTilesSignature(nextTiles);
    if (signature !== tilesRef.current.signature) {
      setTiles({ ...nextTiles, signature });
    }

    const waveElapsed = waveStartedAtRef.current ? now - waveStartedAtRef.current : undefined;
    const waveOrigin: Point = { x: center.left + center.width / 2, y: center.top + center.height / 2 };
    const wave: WaveFrame | undefined = !isStatic && waveElapsed !== undefined && waveElapsed < WAVE_PUSH_DURATION
      ? { origin: waveOrigin, maxRadius: getWaveMaxRadius(area, waveOrigin), elapsed: waveElapsed }
      : undefined;
    const entryAt = isStatic ? 0 : entryAtRef.current;
    const isWaveContent = contentKeyRef.current !== undefined && contentKeyRef.current === waveContentKeyRef.current;

    requestMutation(() => {
      (Object.keys(nextTiles) as LayerKind[]).forEach((kind) => {
        applyTiles(root, kind, nextTiles[kind], {
          card,
          now,
          entryAt: isWaveContent && kind !== 'model' ? 0 : entryAt,
          wave,
        });
      });
    });

    const hasContent = Boolean(emojiCount) || hasGift;
    const isSettling = now < settleUntilRef.current;
    const shouldContinue = hasContent && (!isStatic || isSettling || motion.getIsAnimating());
    isLoopActiveRef.current = shouldContinue;
    return shouldContinue;
  });

  const startLoop = useLastCallback(() => {
    if (isLoopActiveRef.current) return;

    isLoopActiveRef.current = true;
    animate(tick, requestMeasure);
  });

  useUnmountCleanup(() => {
    isUnmountedRef.current = true;
  });

  useLayoutEffect(() => {
    entryAtRef.current = performance.now();
  }, [contentKey]);

  // Symbol tiles mount once the pattern loads, which a static layer must still place
  useLayoutEffect(() => {
    startLoop();
  }, [tiles, contentKey, noAnimation, patternUrl, startLoop]);

  // A static layer keeps following the card until its new transform lands
  useLayoutEffect(() => {
    settleUntilRef.current = performance.now() + CARD_SETTLE_DURATION;
    startLoop();
  }, [cardLayoutKey, startLoop]);

  useResizeObserver(rootRef, startLoop);

  const handlePointerDown = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    motion.press({ x: e.clientX, y: e.clientY }, performance.now());
  });

  const handlePointerMove = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.buttons) return;

    motion.move({ x: e.clientX, y: e.clientY }, performance.now());
    startLoop();
  });

  const handlePointerUp = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    const wasDragged = motion.release(performance.now(), noAnimationRef.current);
    startLoop();
    if (!wasDragged) {
      onClick?.();
    }
  });

  const handlePointerCancel = useLastCallback(() => {
    motion.release(performance.now(), noAnimationRef.current);
    startLoop();
  });

  const patternColor = backdrop?.patternColor;
  const symbolStyle = useMemo(() => (
    patternUrl && buildStyle(
      TILE_STYLE_BY_KIND.symbol,
      `mask-image: url(${patternUrl})`,
      `background-color: ${patternColor}`,
    )
  ), [patternColor, patternUrl]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      style={`color: ${foregroundColor}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Keyed lists keep tiles mounted while others enter and leave, so animations are not restarted */}
      <div className={styles.group} teactFastList>
        {(symbolStyle ? tiles.symbol : NO_TILES).map((item) => (
          <div
            key={item.key}
            className={buildClassName(styles.tile, styles.symbol)}
            data-kind="symbol"
            data-key={item.key}
            style={symbolStyle}
          />
        ))}
      </div>
      <div className={styles.group} teactFastList>
        {(model ? tiles.model : NO_TILES).map((item) => (
          <div
            key={item.key}
            className={styles.tile}
            style={TILE_STYLE_BY_KIND.model}
            data-kind="model"
            data-key={item.key}
          >
            <ModelTile sticker={model!.sticker} />
          </div>
        ))}
      </div>
      <div className={styles.group} teactFastList>
        {(emojis?.length ? tiles.emoji : NO_TILES).map((item) => {
          // Tiles may come from a frame with another emoji count, so the pick follows the current one.
          // The emoji is keyed, as a sticker animation does not switch to another source once started
          const pick = getPickIndex(item.row, item.column, emojis!.length);

          return (
            <div
              key={item.key}
              className={styles.tile}
              style={TILE_STYLE_BY_KIND.emoji}
              data-kind="emoji"
              data-key={item.key}
              data-pick={pick}
              data-reaction={getReactionKey(emojis![pick])}
            >
              <EmojiTile
                key={getReactionKey(emojis![pick])}
                reaction={emojis![pick]}
                availableReactions={availableReactions}
                canPlay={canPlayEmojis}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EmojiTile = memo(({
  reaction,
  availableReactions,
  canPlay,
}: {
  reaction: ApiReaction;
  availableReactions?: ApiAvailableReaction[];
  canPlay?: boolean;
}) => {
  const selectAnimation = reaction.type === 'emoji'
    ? availableReactions?.find((available) => isSameReaction(available.reaction, reaction))?.selectAnimation
    : undefined;
  const tgsUrl = useMedia(selectAnimation && getDocumentMediaHash(selectAnimation, 'full'));

  if (reaction.type === 'custom') {
    return (
      <CustomEmoji
        documentId={reaction.documentId}
        size={EMOJI_RENDER_SIZE}
        style={CUSTOM_EMOJI_STYLE}
        withSharedAnimation
        forceAlways
      />
    );
  }

  return (
    <AnimatedSticker
      renderId={`qr-reaction-${reaction.emoticon}`}
      tgsUrl={tgsUrl}
      size={EMOJI_RENDER_SIZE}
      play={canPlay}
      forceAlways
    />
  );
});

const ModelTile = memo(({ sticker }: { sticker: ApiSticker }) => {
  const ref = useRef<HTMLDivElement>();

  return (
    <div ref={ref} className={styles.sticker}>
      <StickerView
        containerRef={ref}
        sticker={sticker}
        size={MODEL_RENDER_SIZE}
        shouldLoop
        withSharedAnimation
        forceAlways
      />
    </div>
  );
});

export default memo(QrFloatingLayer);

function buildTileStyle(size: number) {
  return `width: ${size}px; height: ${size}px`;
}

function buildTilesSignature(tiles: Omit<RenderedTiles, 'signature'>) {
  return [
    tiles.emoji.map(({ key, pick }) => `${key}/${pick}`).join(','),
    tiles.model.map(({ key }) => key).join(','),
    tiles.symbol.map(({ key }) => key).join(','),
  ].join('|');
}

function applyTiles(root: HTMLElement, kind: LayerKind, items: LayerItem[], frame: TileFrame) {
  const {
    card, now, entryAt, wave,
  } = frame;
  const elements = root.querySelectorAll<HTMLElement>(`[data-kind="${kind}"]`);
  const elementsByKey = new Map<string, HTMLElement>();
  elements.forEach((element) => elementsByKey.set(element.dataset.key!, element));

  const renderSize = RENDER_SIZE_BY_KIND[kind];
  const entry = ENTRY_BY_KIND[kind];

  items.forEach((item) => {
    const element = elementsByKey.get(item.key);
    if (!element) return;

    const appearAt = kind === 'emoji' ? getEmojiAppearAt(element, entryAt, now) : entryAt;
    const progress = appearAt ? (now - appearAt - item.delay * entry.stagger) / entry.duration : 1;
    const entryValue = entry.isFade ? clamp(progress, 0, 1) : getPopScale(progress);
    const push = wave && getWavePush(item, wave, PUSH_MASS_SIZE_BY_KIND[kind]);
    const scale = (item.size / renderSize) * (entry.isFade ? 1 : entryValue) * (push?.scale ?? 1);
    const isHidden = scale <= 0 || entryValue <= 0 || (card && getIsCoveredByCard(card, item.x, item.y, item.size));
    const x = item.x + (push?.x ?? 0) - renderSize / 2;
    const y = item.y + (push?.y ?? 0) - renderSize / 2;

    element.style.transform = `translate(${x}px, ${y}px) rotate(${item.rotation + (push?.rotation ?? 0)}deg) `
      + `scale(${scale})`;
    element.style.visibility = isHidden ? 'hidden' : 'visible';
    if (entry.isFade) {
      element.style.opacity = String(SYMBOL_OPACITY * entryValue);
    }
  });
}

function getEmojiAppearAt(element: HTMLElement, entryAt: number, now: number) {
  const { reaction } = element.dataset;
  const state = emojiTileStates.get(element);
  if (!state) {
    emojiTileStates.set(element, { reaction, appearAt: entryAt });
    return entryAt;
  }

  if (state.reaction !== reaction) {
    state.reaction = reaction;
    state.appearAt = entryAt ? now : 0;
  }

  return state.appearAt;
}

function getPopScale(progress: number) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  const t = progress - 1;
  return 1 + (BACK_OVERSHOOT + 1) * t * t * t + BACK_OVERSHOOT * t * t;
}
