import { useRef } from '../../../lib/teact/teact';

import type {
  ApiMediaAreaCoordinates, ApiStarGiftUnique, ApiWalletCardSticker, ApiWalletCollectible,
} from '../../../api/types';
import type { MotionPose, MotionSample } from './helpers/cardStickerMotion';
import type { Point, StickerPose } from './helpers/cardStickers';
import type { StickerMotionItem } from './useStickerMotion';

import getPointerPosition from '../../../util/events/getPointerPosition';
import { addMotionSample, getMotionTime } from './helpers/cardStickerMotion';
import { clampStickerScale } from './helpers/cardStickers';

import useEffectOnce from '../../../hooks/useEffectOnce';
import useLastCallback from '../../../hooks/useLastCallback';
import useWindow from '../../../hooks/useWindow';

export type GiftCollectible = ApiWalletCollectible & { type: 'gift'; gift: ApiStarGiftUnique };

// Viewport pixels of the center and the side; degrees
export type StickerFramePose = {
  x: number;
  y: number;
  side: number;
  rotation: number;
};

export type StickerPress = {
  type: 'press';
  pointerId: number;
  start: Point;
  last: Point;
  isTouch: boolean;
  isHeld?: boolean;
  // The pointer moved off a held tile, which closes its menu
  isMenuClosed?: boolean;
  // The pointer moved far enough to carry the sticker, which waits for its texture
  shouldCarry?: boolean;
  holdTimeout?: number;
} & ({ source: 'card'; sticker: ApiWalletCardSticker } | { source: 'tile'; collectible: GiftCollectible });

export type StickerCarry = {
  type: 'carry';
  pointerId: number;
  isTouch: boolean;
  item: StickerMotionItem;
  gift: ApiStarGiftUnique;
  sticker?: ApiWalletCardSticker;
  start: Point;
  offset: Point;
  center: Point;
  // Radians
  angle: number;
  scale: number;
  samples: MotionSample[];
  touches: Map<number, Point>;
  twist?: Twist;
  // A touch held on a tile opens its menu, and the sticker stays peeled off until the menu closes
  hasMenu?: boolean;
};

export type StickerHandle = {
  type: 'handle';
  pointerId: number;
  item: StickerMotionItem;
  sticker: ApiWalletCardSticker;
  from: StickerPose;
  center: Point;
  pressed: Point;
  pose: StickerFramePose;
  // What the release saves, set once the handle moves
  coordinates?: ApiMediaAreaCoordinates;
};

type StickerGesture = StickerPress | StickerCarry | StickerHandle;

// The carry the editor builds once the texture of the sticker is ready
type StickerCarryStart = Pick<StickerCarry, 'item' | 'gift' | 'sticker' | 'scale' | 'hasMenu'> & {
  original: MotionPose;
};

type Twist = {
  distance: number;
  lastAngle: number;
  turn: number;
  scale: number;
  angle: number;
  center: Point;
  midpoint: Point;
};

// What the editor does with the gestures this hook makes out of the pointer
type Delegate = {
  // Reacts to a hold and returns whether the held sticker peels off
  onHold: (press: StickerPress) => boolean;
  loadCarry: (press: StickerPress) => Promise<unknown> | undefined;
  getCarryStart: (press: StickerPress) => StickerCarryStart | undefined;
  onCarryStart: (carry: StickerCarry, original: MotionPose) => void;
  onCarryMove: (carry: StickerCarry) => void;
  onCarryMenuClose: NoneToVoidFunction;
  onTap: (press: StickerPress) => void;
  onRelease: (carry: StickerCarry) => void;
  onHandleMove: (handle: StickerHandle, point: Point, isSnapped: boolean) => void;
  onHandleRelease: (handle: StickerHandle) => void;
  onCancel: (gesture: StickerCarry | StickerHandle) => void;
};

// Moving 10 points before a hold lets a touch scroll, as in the iOS app
const TOUCH_SLOP = 10;
// Once held, moving this far carries the sticker; with a mouse button down, the drag starts sooner
const HELD_TOUCH_SLOP = 8;
const MOUSE_DRAG_THRESHOLD = 4;
// The click of a gesture comes right after its `pointerup`. A click that comes later is a new press by the user.
const SUPPRESSED_CLICK_WINDOW_MS = 100;

export default function useStickerPointer(delegate: Delegate) {
  const gestureRef = useRef<StickerGesture>();
  // Clicks before this time are ignored, so the click at the end of a drag or a hold is not a tap
  const suppressedClickUntilRef = useRef(0);
  const delegateRef = useRef(delegate);
  delegateRef.current = delegate;
  const ownWindow = useWindow();
  // The window a gesture started in gets all its events, even if the modal moves to another one meanwhile
  const gestureWindowRef = useRef(ownWindow);

  useEffectOnce(() => endGesture);

  function startPress(press: StickerPress, holdMs: number) {
    gestureRef.current = press;
    listenToPointer();

    if (!press.isTouch) return;

    press.holdTimeout = window.setTimeout(() => {
      if (gestureRef.current !== press) return;

      press.isHeld = true;
      suppressedClickUntilRef.current = Infinity;
      gestureWindowRef.current.document.addEventListener('touchmove', preventTouchScroll, { passive: false });

      if (delegateRef.current.onHold(press)) requestCarry(press);
    }, holdMs);
  }

  function startHandle(handle: StickerHandle) {
    gestureRef.current = handle;
    listenToPointer();
  }

  // The sticker leaves once its texture is ready
  function requestCarry(press: StickerPress) {
    press.shouldCarry = true;
    suppressedClickUntilRef.current = Infinity;

    delegateRef.current.loadCarry(press)?.then(() => {
      if (gestureRef.current === press && press.shouldCarry) startCarry(press);
    });
  }

  function startCarry(press: StickerPress) {
    clearTimeout(press.holdTimeout);

    // The gesture goes on until the pointer is released. `shouldCarry` stays set, so the release is not a tap.
    const carryStart = delegateRef.current.getCarryStart(press);
    if (!carryStart) return;

    const { original, ...data } = carryStart;
    const { last } = press;
    const offset = { x: original.x - press.start.x, y: original.y - press.start.y };
    const carry: StickerCarry = {
      ...data,
      type: 'carry',
      pointerId: press.pointerId,
      isTouch: press.isTouch,
      start: press.start,
      offset,
      center: { x: last.x + offset.x, y: last.y + offset.y },
      angle: original.angle,
      samples: [],
      touches: new Map([[press.pointerId, last]]),
    };

    gestureRef.current = carry;
    if (press.isTouch) {
      gestureWindowRef.current.document.addEventListener('touchmove', preventTouchScroll, { passive: false });
    }
    delegateRef.current.onCarryStart(carry, original);
  }

  function listenToPointer() {
    gestureWindowRef.current = ownWindow;
    ownWindow.addEventListener('pointermove', handlePointerMove);
    ownWindow.addEventListener('pointerup', handlePointerUp);
    ownWindow.addEventListener('pointercancel', handlePointerCancel);
    ownWindow.addEventListener('pointerdown', handleExtraPointerDown);
  }

  function endGesture() {
    const gesture = gestureRef.current;
    if (gesture?.type === 'press') clearTimeout(gesture.holdTimeout);

    gestureRef.current = undefined;
    if (suppressedClickUntilRef.current === Infinity) {
      suppressedClickUntilRef.current = performance.now() + SUPPRESSED_CLICK_WINDOW_MS;
    }

    const gestureWindow = gestureWindowRef.current;
    gestureWindow.removeEventListener('pointermove', handlePointerMove);
    gestureWindow.removeEventListener('pointerup', handlePointerUp);
    gestureWindow.removeEventListener('pointercancel', handlePointerCancel);
    gestureWindow.removeEventListener('pointerdown', handleExtraPointerDown);
    gestureWindow.document.removeEventListener('touchmove', preventTouchScroll);
  }

  const handleExtraPointerDown = useLastCallback((e: PointerEvent) => {
    const gesture = gestureRef.current;
    if (gesture?.type !== 'carry' || !gesture.isTouch || gesture.touches.has(e.pointerId)) return;

    gesture.touches.set(e.pointerId, getPointerPosition(e));
    closeCarryMenu(gesture);
  });

  const handlePointerMove = useLastCallback((e: PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    const point = getPointerPosition(e);

    if (gesture.type === 'press') {
      if (e.pointerId !== gesture.pointerId) return;

      gesture.last = point;
      const distance = Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y);
      if (gesture.isTouch && !gesture.isHeld) {
        // The finger scrolls the screen
        if (distance > TOUCH_SLOP) endGesture();
        return;
      }

      if (distance <= (gesture.isTouch ? HELD_TOUCH_SLOP : MOUSE_DRAG_THRESHOLD)) return;

      if (gesture.isHeld && !gesture.isMenuClosed) {
        gesture.isMenuClosed = true;
        delegateRef.current.onCarryMenuClose();
      }
      if (!gesture.shouldCarry) requestCarry(gesture);
      return;
    }

    if (gesture.type === 'carry') {
      moveCarry(gesture, e.pointerId, point);
      return;
    }

    if (e.pointerId === gesture.pointerId) delegateRef.current.onHandleMove(gesture, point, e.shiftKey);
  });

  // One finger moves the sticker; two turn and resize it around their middle, as in the iOS app
  function moveCarry(carry: StickerCarry, pointerId: number, point: Point) {
    if (!carry.touches.has(pointerId)) return;

    carry.touches.set(pointerId, point);

    const [first, second] = Array.from(carry.touches.values());

    if (second) {
      twistCarry(carry, first, second);
    } else {
      carry.twist = undefined;
      carry.center = { x: first.x + carry.offset.x, y: first.y + carry.offset.y };
    }

    if (Math.hypot(first.x - carry.start.x, first.y - carry.start.y) > HELD_TOUCH_SLOP) closeCarryMenu(carry);

    carry.samples = addMotionSample(carry.samples, { time: getMotionTime(), ...first });

    delegateRef.current.onCarryMove(carry);
  }

  // Moving the held sticker takes it out from under its menu
  function closeCarryMenu(carry: StickerCarry) {
    if (!carry.hasMenu) return;

    carry.hasMenu = false;
    delegateRef.current.onCarryMenuClose();
  }

  const handlePointerUp = useLastCallback((e: PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    // One of two fingers leaves, and the other one carries on
    if (gesture.type === 'carry' && gesture.touches.size > 1) {
      if (gesture.touches.has(e.pointerId)) releaseTouch(gesture, e.pointerId);
      return;
    }

    if (e.pointerId !== gesture.pointerId) return;

    endGesture();

    if (gesture.type === 'press') {
      // A hold leaves its menu open, and a drag released before its texture came is not a tap
      if (!gesture.isHeld && !gesture.shouldCarry) delegateRef.current.onTap(gesture);
    } else if (gesture.type === 'handle') {
      delegateRef.current.onHandleRelease(gesture);
    } else {
      delegateRef.current.onRelease(gesture);
    }
  });

  const handlePointerCancel = useLastCallback((e: PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    // A cancelled second finger leaves the carry like a lifted one, so the gesture does not wait for it
    if (gesture.type === 'carry' && gesture.touches.size > 1 && gesture.touches.has(e.pointerId)) {
      releaseTouch(gesture, e.pointerId);
      return;
    }

    if (e.pointerId !== gesture.pointerId) return;

    endGesture();
    if (gesture.type !== 'press') delegateRef.current.onCancel(gesture);
  });

  return {
    getGesture: useLastCallback(() => gestureRef.current),
    startPress: useLastCallback(startPress),
    startHandle: useLastCallback(startHandle),
    // A new press clears the click suppression left by the previous gesture
    allowClick: useLastCallback(() => {
      suppressedClickUntilRef.current = 0;
    }),
    // A click that ends a drag or a hold is not a tap on the tile
    consumeClick: useLastCallback(() => {
      const isSuppressed = performance.now() < suppressedClickUntilRef.current;
      suppressedClickUntilRef.current = 0;

      return isSuppressed;
    }),
  };
}

function twistCarry(carry: StickerCarry, first: Point, second: Point) {
  const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
  const angle = Math.atan2(second.y - first.y, second.x - first.x);

  carry.twist ??= {
    distance, lastAngle: angle, turn: 0, scale: carry.scale, angle: carry.angle, center: carry.center, midpoint,
  };

  const { twist } = carry;
  twist.turn += Math.atan2(Math.sin(angle - twist.lastAngle), Math.cos(angle - twist.lastAngle));
  twist.lastAngle = angle;

  carry.scale = clampStickerScale((twist.scale * distance) / twist.distance);
  carry.angle = twist.angle + twist.turn;

  const ratio = carry.scale / twist.scale;
  const dx = twist.center.x - twist.midpoint.x;
  const dy = twist.center.y - twist.midpoint.y;
  const cos = Math.cos(twist.turn);
  const sin = Math.sin(twist.turn);
  carry.center = {
    x: midpoint.x + (dx * cos - dy * sin) * ratio,
    y: midpoint.y + (dx * sin + dy * cos) * ratio,
  };
}

function releaseTouch(carry: StickerCarry, pointerId: number) {
  carry.touches.delete(pointerId);
  carry.twist = undefined;

  if (pointerId === carry.pointerId) carry.pointerId = carry.touches.keys().next().value!;

  const rest = carry.touches.get(carry.pointerId)!;
  carry.offset = { x: carry.center.x - rest.x, y: carry.center.y - rest.y };
  carry.samples = [];
}

function preventTouchScroll(e: TouchEvent) {
  e.preventDefault();
}
