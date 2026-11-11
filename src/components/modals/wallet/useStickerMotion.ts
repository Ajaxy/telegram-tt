import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect, useRef, useState } from '../../../lib/teact/teact';

import type { ApiMediaAreaCoordinates } from '../../../api/types';
import type {
  DragMotion, FlightMotion, MotionPose, MotionSpring,
} from './helpers/cardStickerMotion';
import type { StickerCanvas } from './helpers/stickerCanvas';
import type { StickerMotion, StickerMotionSnapshot } from './helpers/stickerMotionState';
import type { StickerTexture } from './helpers/stickerTexture';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { animate } from '../../../util/animation';
import {
  createMotionSpring,
  getCardMotionPose,
  getDragPose,
  getFlightPose,
  getIsDragMotionResting,
  getIsMotionSpringResting,
  getIsPlayOver,
  getMotionTime,
  getPlayOpacity,
  getPlayRise,
  getRectMotionPose,
  getTileBumpScale,
  PLAY_GROWTH,
  PLAY_LIFT,
  stepMotionSpring,
} from './helpers/cardStickerMotion';
import { holdStickerCurl, STICKER_CANVAS_SIZE, STICKER_LAYER_SCALE } from './helpers/stickerCanvas';
import {
  advanceStickerMotion,
  getAreStickerMotionSnapshotsEqual,
  getIsStickerMotionShown,
  getPlayEnd,
  getStickerMotionSnapshot,
  reuseStickerMotionItems,
} from './helpers/stickerMotionState';
import { STICKER_ART_FRACTION } from './helpers/stickerTexture';

import useEffectOnce from '../../../hooks/useEffectOnce';
import useLastCallback from '../../../hooks/useLastCallback';
import { useStateRef } from '../../../hooks/useStateRef';

import { TO_SLIDE_CLASS_NAME } from '../../ui/Transition';
import { TILE_MODEL_ATTRIBUTE } from './WalletCollectibleTile';

export type StickerMotionItem = {
  address: string;
  texture: StickerTexture;
};

export type StickerMotionView = {
  // Clips a sticking sticker to the card and shakes it
  clip: HTMLDivElement;
  element: HTMLDivElement;
  canvas: StickerCanvas;
};

// A sticker in motion, its canvas, and the callbacks that wait for it to show or to touch the card
type MotionEntry = {
  motion: StickerMotion;
  texture: StickerTexture;
  view?: StickerMotionView;
  // The last pose of the tile model, kept while the tile is out of the layout
  tilePose?: MotionPose;
  onDrawn?: NoneToVoidFunction;
  onHandOff?: NoneToVoidFunction;
};

type MotionStart = Omit<StickerMotion, 'address' | 'drawnFrames'> & Pick<MotionEntry, 'onDrawn' | 'onHandOff'>;

type Play = {
  address: string;
  start: number;
  end?: number;
  boop: MotionSpring;
};

type Params = {
  faceRef: ElementRef<HTMLDivElement>;
  gridRef: ElementRef<HTMLDivElement>;
  // Without the curl, the tilt and the shadow under the raised part, as in the iOS app with reduced motion
  isFlat?: boolean;
};

export const CARD_STICKER_ATTRIBUTE = 'data-card-sticker-address';
// The element of a card sticker that a tap grows and shadows
export const CARD_STICKER_LIFT_ATTRIBUTE = 'data-card-sticker-lift';
// The CSS pixels of the layer element, which its transform scales to the size of the sticker
export const STICKER_LAYER_SIZE = STICKER_CANVAS_SIZE / 2;
// The shake of the iOS app: its key times pass through the overall ease-out curve
export const SHAKE_KEYFRAMES: Keyframe[] = [
  { translate: '0', offset: 0 },
  { translate: '-8px', offset: 0.087 },
  { translate: '7px', offset: 0.208 },
  { translate: '-5px', offset: 0.342 },
  { translate: '3px', offset: 0.496 },
  { translate: '-1.5px', offset: 0.662 },
  { translate: '0', offset: 1 },
];
export const SHAKE_DURATION_MS = 450;

const MAX_FRAME_TIME = 1 / 30;
const EMPTY_SNAPSHOT: StickerMotionSnapshot = {
  hidden: [], lifted: [], uncontacted: [],
};
const PERSPECTIVE_SIDES = 3;
// The shadow of a raised sticker in the iOS app. A layer shadow radius blurs as much as twice the CSS blur radius.
const SHADOW_OPACITY = 0.3;
const SHADOW_RADIUS = 3;
const SHADOW_RADIUS_LIFT = 15;
const SHADOW_OFFSET = 2;
const SHADOW_OFFSET_LIFT = 18;
const SHADOW_BLUR_SCALE = 2;
const BOOP_STIFFNESS = 300;
const BOOP_DAMPING = 0.5;
const BOOP_VELOCITY = 3;

export default function useStickerMotion({ faceRef, gridRef, isFlat }: Params) {
  const entriesRef = useRef(new Map<string, MotionEntry>());
  // A canvas stays mounted until the render after its motion ends and does not register again if the same sticker
  // moves before that render, so a new motion takes its view from here
  const viewsRef = useRef(new Map<string, StickerMotionView>());
  // `animate` keeps calling the `tick` of the render that started the loop, so `tick` reads a later `isFlat` from here
  const isFlatRef = useStateRef(isFlat);
  const playRef = useRef<Play>();
  // Changes made from a gift screen wait until the wallet screen stops moving, as in the iOS app
  const settledCallbacksRef = useRef<NoneToVoidFunction[]>([]);
  const isUnmountedRef = useRef(false);
  const isRunningRef = useRef(false);
  const lastTickRef = useRef<number>();
  const cardRadiusRef = useRef<number>();
  const [items, setItems] = useState<StickerMotionItem[]>([]);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);

  // The changes waiting for the screen or for a sticker to show are made at once when the screen goes
  useEffectOnce(() => () => {
    const callbacks = [
      ...settledCallbacksRef.current,
      ...Array.from(entriesRef.current.values(), ({ onDrawn }) => onDrawn),
    ];
    settledCallbacksRef.current = [];
    entriesRef.current.clear();
    playRef.current = undefined;
    isUnmountedRef.current = true;
    callbacks.forEach((callback) => callback?.());
  });

  useEffect(() => (isFlat ? undefined : holdStickerCurl()), [isFlat]);

  // Stays the same, so a moving sticker keeps its canvas between renders
  const registerView = useLastCallback((address: string, view?: StickerMotionView) => {
    if (view) {
      viewsRef.current.set(address, view);
    } else {
      viewsRef.current.delete(address);
    }

    const entry = entriesRef.current.get(address);
    if (entry) {
      entry.view = view;
      if (view) run();
    }
  });

  function syncState() {
    const entries = Array.from(entriesRef.current.entries());
    const next = getStickerMotionSnapshot(entries.map(([, { motion }]) => motion));

    setSnapshot((current) => (getAreStickerMotionSnapshotsEqual(current, next) ? current : next));
    setItems((current) => reuseStickerMotionItems(
      current, entries.map(([address, { texture }]) => ({ address, texture })),
    ));
  }

  function run() {
    cardRadiusRef.current = undefined;
    syncState();
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    lastTickRef.current = undefined;
    animate(tick, requestMeasure);
  }

  function tick() {
    // Teact clears the refs of an unmounted component, so only `false` means the hook is still mounted
    if (isUnmountedRef.current !== false) return false;

    const now = getMotionTime();
    const dt = Math.min(MAX_FRAME_TIME, now - (lastTickRef.current ?? now));
    lastTickRef.current = now;

    const face = faceRef.current;
    const faceRect = face?.getBoundingClientRect();
    const writes: NoneToVoidFunction[] = [];
    let isChanged = false;

    entriesRef.current.forEach((entry, address) => {
      const { motion, events } = advanceStickerMotion(entry.motion, now);
      entry.motion = motion;
      if (events.length) isChanged = true;

      if (events.includes('ended')) {
        entriesRef.current.delete(address);
        return;
      }

      if (events.includes('handedOff') && entry.onHandOff) writes.push(entry.onHandOff);

      // Over the limit, the sticker stays stuck a moment and then peels off and flies home
      if (events.includes('rejected')) {
        const stuck = faceRect ? getCardMotionPose(motion.target!, faceRect) : motion.flight!.from;
        entry.motion = {
          ...motion, isContacted: false, flight: createHomeFlight(address, stuck, now, { isPeelFirst: true }),
        };
      }

      if (events.includes('landed')) {
        if (motion.flight!.type === 'return') writes.push(buildTileBump(address, 1));
        // A sticker the layer never drew still lets its change through
        flushDrawn(entry, writes);
      }

      const pose = getEntryPose(entry, now, faceRect);
      const { flight } = entry.motion;
      if (flight?.type === 'return' && entry.motion.landedFrames === undefined) {
        writes.push(buildTileBump(address, getTileBumpScale(flight, now - flight.start)));
      }

      if (!entry.view) return;

      const wasShown = getIsStickerMotionShown(entry.motion);
      entry.motion = { ...entry.motion, drawnFrames: entry.motion.drawnFrames + 1 };
      if (getIsStickerMotionShown(entry.motion)) {
        if (!wasShown) isChanged = true;
        flushDrawn(entry, writes);
      }

      const cardClip = entry.motion.isContacted && face && faceRect
        ? buildCardClip(faceRect, entry.view.clip.getBoundingClientRect(), getCardRadius(face))
        : undefined;
      // The canvas may change in this frame, so the write takes the view it finds
      writes.push(() => {
        if (entry.view) drawEntry(entry.view, pose, cardClip, isFlatRef.current);
      });
    });

    const play = playRef.current;
    if (play) writes.push(stepPlay(play, now, dt));

    requestMutation(() => writes.forEach((write) => write()));
    if (isChanged) syncState();

    const settledCallbacks = settledCallbacksRef.current;
    if (settledCallbacks.length && (!face || getIsScreenSettled(face))) {
      settledCallbacksRef.current = [];
      settledCallbacks.forEach((callback) => callback());
    }

    isRunningRef.current = Boolean(playRef.current) || settledCallbacksRef.current.length > 0;
    for (const { motion } of entriesRef.current.values()) {
      if (!getIsStickerMotionShown(motion) || !motion.drag || !getIsDragMotionResting(motion.drag, now)) {
        isRunningRef.current = true;
        break;
      }
    }

    return isRunningRef.current;
  }

  // Runs the callback waiting for the sticker to show, once, even if a new motion of the sticker took over
  function flushDrawn(entry: MotionEntry, writes: NoneToVoidFunction[]) {
    if (!entry.onDrawn) return;

    writes.push(entry.onDrawn);
    entry.onDrawn = undefined;
  }

  function getCardRadius(face: HTMLElement) {
    cardRadiusRef.current ??= parseFloat(getComputedStyle(face).borderTopLeftRadius) || 0;

    return cardRadiusRef.current;
  }

  function getEntryPose(entry: MotionEntry, now: number, faceRect?: DOMRect): MotionPose {
    const {
      address, drag, flight, pose, target: cardTarget,
    } = entry.motion;
    if (pose) return pose;
    if (drag) return faceRect ? getDragPose(drag, now, faceRect.width) : drag.original;

    let target = flight!.from;
    if (flight!.type === 'stick' && faceRect && cardTarget) {
      target = getCardMotionPose(cardTarget, faceRect);
    } else if (flight!.type === 'return') {
      entry.tilePose = getTilePose(address) ?? entry.tilePose;
      target = entry.tilePose ?? target;
    }

    return getFlightPose(flight!, now - flight!.start, target);
  }

  function getTilePose(address: string) {
    const model = findTileModel(address);

    return model && getRectMotionPose(model.getBoundingClientRect());
  }

  function createHomeFlight(
    address: string, from: MotionPose, start: number, options: Pick<FlightMotion, 'isPeelFirst' | 'isFast'>,
  ): FlightMotion {
    const model = findTileModel(address);
    const isVisible = Boolean(model && getIsInScrollViewport(model));

    return {
      ...options, from, start, type: isVisible ? 'return' : 'fade',
    };
  }

  function findTileModel(address: string) {
    return gridRef.current?.querySelector<HTMLElement>(`[${TILE_MODEL_ATTRIBUTE}="${CSS.escape(address)}"]`);
  }

  function buildTileBump(address: string, scale: number) {
    const tile = findTileModel(address)?.parentElement;

    return () => {
      if (tile) tile.style.scale = scale === 1 ? '' : String(scale);
    };
  }

  function stepPlay(play: Play, now: number, dt: number) {
    stepMotionSpring(play.boop, dt);
    play.end = getPlayEnd(play.start, play.end, now);

    const elapsed = now - play.start;
    const endElapsed = play.end !== undefined ? play.end - play.start : undefined;
    const isOver = getIsPlayOver(elapsed, endElapsed) && getIsMotionSpringResting(play.boop);
    if (isOver) playRef.current = undefined;

    // The iOS app grows the playing sticker in its layer and cross-fades it with the booped one on the card
    const rise = getPlayRise(elapsed, endElapsed);
    const share = getPlayOpacity(elapsed, endElapsed);
    const scale = (1 + play.boop.value) * (1 - share) + (1 + PLAY_GROWTH * rise) * share;
    // As in the iOS app with reduced motion, the playing sticker still rises with its shadow
    const lift = PLAY_LIFT * rise * share;
    const element = findPlayElement(play.address);

    return () => {
      if (!element) return;

      element.style.scale = isOver ? '' : String(scale);
      element.style.filter = isOver || !lift ? '' : buildShadow(lift, scale);
    };
  }

  function findPlayElement(address: string) {
    return faceRef.current?.querySelector<HTMLElement>(
      `[${CARD_STICKER_ATTRIBUTE}="${CSS.escape(address)}"] [${CARD_STICKER_LIFT_ATTRIBUTE}]`,
    ) || undefined;
  }

  // A new motion of a sticker already in motion keeps its canvas and the frames it was shown in
  function startMotion({ address, texture }: StickerMotionItem, { onDrawn, onHandOff, ...motion }: MotionStart) {
    const previous = entriesRef.current.get(address);
    entriesRef.current.set(address, {
      motion: { ...motion, address, drawnFrames: previous?.motion.drawnFrames ?? 0 },
      texture,
      view: viewsRef.current.get(address),
      onDrawn,
      onHandOff,
    });
    run();
  }

  return {
    items,
    hiddenAddresses: snapshot.hidden,
    liftedAddresses: snapshot.lifted,
    uncontactedAddresses: snapshot.uncontacted,
    getTilePose,
    getHasMotion: (address: string) => entriesRef.current.has(address),
    getPose: (address: string) => {
      const entry = entriesRef.current.get(address);

      return entry && getEntryPose(entry, getMotionTime(), faceRef.current?.getBoundingClientRect());
    },
    registerView,
    drag: (item: StickerMotionItem, drag: DragMotion) => {
      startMotion(item, { drag });
    },
    updateDrag: (address: string, update: Partial<DragMotion>) => {
      const entry = entriesRef.current.get(address);
      const { drag } = entry?.motion || {};
      if (entry && drag) entry.motion = { ...entry.motion, drag: { ...drag, ...update } };
    },
    hold: (item: StickerMotionItem, pose: MotionPose) => {
      startMotion(item, { pose });
    },
    stick: (
      item: StickerMotionItem, from: MotionPose, target: ApiMediaAreaCoordinates,
      options: Pick<FlightMotion, 'isThrown' | 'isRejected'> & { onHandOff?: NoneToVoidFunction } = {},
    ) => {
      const { onHandOff, ...flight } = options;
      startMotion(item, { target, onHandOff, flight: { ...flight, from, start: getMotionTime(), type: 'stick' } });
    },
    flyHome: (
      item: StickerMotionItem, from: MotionPose,
      options: Pick<FlightMotion, 'isPeelFirst' | 'isFast'> & { onDrawn?: NoneToVoidFunction } = {},
    ) => {
      const { onDrawn, ...flight } = options;
      startMotion(item, {
        isHandedOff: true, onDrawn, flight: createHomeFlight(item.address, from, getMotionTime(), flight),
      });
    },
    // The card already shows the held sticker in its new place, and the layer fades out over it
    settle: (address: string) => {
      const entry = entriesRef.current.get(address);
      const pose = entry?.motion.pose;
      if (!entry || !pose) return;

      startMotion({ address, texture: entry.texture }, {
        isHandedOff: true, flight: { from: pose, start: getMotionTime(), type: 'settle' },
      });
    },
    whenSettled: (callback: NoneToVoidFunction) => {
      settledCallbacksRef.current.push(callback);
      run();
    },
    shake: (address: string) => {
      entriesRef.current.get(address)?.view?.clip.animate(SHAKE_KEYFRAMES, SHAKE_DURATION_MS);
    },
    play: (address: string) => {
      // A tap on another sticker while one plays puts the playing one back to its size at once
      const previous = playRef.current;
      const previousElement = previous && previous.address !== address && findPlayElement(previous.address);
      if (previousElement) {
        requestMutation(() => {
          previousElement.style.scale = '';
          previousElement.style.filter = '';
        });
      }

      const boop = createMotionSpring(0, BOOP_STIFFNESS, BOOP_DAMPING);
      boop.velocity = BOOP_VELOCITY;
      playRef.current = { address, start: getMotionTime(), boop };
      run();
    },
    endPlay: (address: string) => {
      const play = playRef.current;
      if (play?.address === address && play.end === undefined) play.end = getMotionTime();
    },
  };
}

function drawEntry(
  { clip, element, canvas }: StickerMotionView, pose: MotionPose, cardClip?: string, isFlat?: boolean,
) {
  const textureSide = pose.side / STICKER_ART_FRACTION;
  const scale = (textureSide * STICKER_LAYER_SCALE) / STICKER_LAYER_SIZE;
  const tilt = isFlat ? 0 : pose.tilt;

  element.style.transform = `translate(${pose.x}px, ${pose.y}px) perspective(${textureSide * PERSPECTIVE_SIDES}px) `
    + `rotate(${pose.angle}rad) rotate3d(${pose.axisX}, ${pose.axisY}, 0, ${tilt}deg) scale(${scale})`;
  element.style.opacity = String(pose.opacity);
  element.style.filter = pose.lift > 0 ? buildShadow(pose.lift, scale) : '';
  clip.style.clipPath = cardClip ?? '';

  canvas.draw({
    side: textureSide,
    front: pose.front,
    bend: isFlat ? 0 : pose.bend,
    shade: isFlat ? 0 : pose.shade,
    border: pose.border,
  });
}

// The element is scaled after its filter, so the shadow is divided by the scale to keep its size on screen
function buildShadow(lift: number, scale: number) {
  const offset = (SHADOW_OFFSET + SHADOW_OFFSET_LIFT * lift) / scale;
  const blur = (SHADOW_BLUR_SCALE * (SHADOW_RADIUS + SHADOW_RADIUS_LIFT * lift)) / scale;

  return `drop-shadow(0 ${offset}px ${blur}px rgb(0 0 0 / ${SHADOW_OPACITY * lift}))`;
}

// The clip path takes the pixels of the clip element, which may stand anywhere
function buildCardClip(faceRect: DOMRect, clipRect: DOMRect, radius: number) {
  const top = faceRect.top - clipRect.top;
  const left = faceRect.left - clipRect.left;
  const right = clipRect.right - faceRect.right;
  const bottom = clipRect.bottom - faceRect.bottom;

  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`;
}

// The wallet screen stops once its slide is shown and no longer slides in
function getIsScreenSettled(face: HTMLElement) {
  return face.getClientRects().length > 0 && !face.closest(`.${TO_SLIDE_CLASS_NAME}`);
}

// As in the iOS app, a tile counts as visible within the scrolled list, not only the window
function getIsInScrollViewport(element: HTMLElement) {
  const view = element.ownerDocument.defaultView!;
  const rect = element.getBoundingClientRect();
  let top = 0;
  let bottom = view.innerHeight;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = view.getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      const parentRect = parent.getBoundingClientRect();
      top = Math.max(top, parentRect.top);
      bottom = Math.min(bottom, parentRect.bottom);
      break;
    }
  }

  return rect.bottom > top && rect.top < bottom;
}
