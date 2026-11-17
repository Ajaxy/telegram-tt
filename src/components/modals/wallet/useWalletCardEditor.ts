import { onFullyIdle } from '../../../lib/teact/heavyAnimation';
import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect, useRef, useState } from '../../../lib/teact/teact';

import type { ApiStarGiftUnique, ApiWalletCardSticker, ApiWalletCollectible } from '../../../api/types';
import type { WalletCardLayout } from '../../../global/helpers/wallet';
import type { IAnchorPosition } from '../../../types';
import type {
  CardEditorRef, CardMetrics, CardStickerRequest,
} from './helpers/cardEditing';
import type { MotionPose } from './helpers/cardStickerMotion';
import type { StickerMotionItem } from './useStickerMotion';
import type {
  GiftCollectible, StickerCarry, StickerFramePose, StickerHandle, StickerPress,
} from './useStickerPointer';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import getPointerPosition from '../../../util/events/getPointerPosition';
import { getStickerFromGift } from '../../common/helpers/gifts';
import {
  getIsCardControl,
  getIsStickerOnCard,
  measureCardMetrics,
  moveStickerOnCard,
  removeStickerFromCard,
  saveCardDecoration,
  showStickerLimitError,
} from './helpers/cardEditing';
import { planStickerChange, planStickerDrop } from './helpers/cardStickerCommands';
import {
  createMotionPose, getCardMotionPose, getMotionTime, getMotionVelocity, getRectMotionPose,
} from './helpers/cardStickerMotion';
import {
  buildStickerCoordinates,
  clampStickerScale,
  findStickerAt,
  getHandlePose,
  getStickerPose,
  getStickerSide,
} from './helpers/cardStickers';
import { prepareStickerCurl } from './helpers/stickerCanvas';
import { clearStickerTextures, getLoadedStickerTexture, loadStickerTexture } from './helpers/stickerTexture';
import useStickerMotion, { SHAKE_DURATION_MS, SHAKE_KEYFRAMES } from './useStickerMotion';
import useStickerPointer from './useStickerPointer';

import useLastCallback from '../../../hooks/useLastCallback';
import useWindow from '../../../hooks/useWindow';

type Params = {
  faceRef: ElementRef<HTMLDivElement>;
  foldRef: ElementRef<HTMLDivElement>;
  gridRef: ElementRef<HTMLDivElement>;
  decoration?: WalletCardLayout;
  backgroundCollections?: string[];
  // Filled while the editor works, for a gift screen above it
  cardEditorRef?: CardEditorRef;
  isEnabled?: boolean;
  isFlat?: boolean;
};

// Where a change starts its flight: a sticker held under the menu, or the gift model of a gift screen
type ChangeSource = {
  pose: MotionPose;
  isHeld?: boolean;
  // The wallet screen is hidden under the gift screen
  isFromGiftScreen?: boolean;
};

// The iOS app peels a sticker off the card after 0.3 s and a gift off its tile after 0.25 s. A gift already on the
// card opens its menu after 0.32 s.
const CARD_HOLD_MS = 300;
const TILE_HOLD_MS = 250;
const PLACED_TILE_HOLD_MS = 320;
// Points per second down, after which a sticker thrown off the card flies home faster
const FAST_THROW_SPEED = 650;

// Coordinates the gestures, the menu and the gift screen with the motion of the stickers and the saved card
export default function useWalletCardEditor({
  faceRef, foldRef, gridRef, decoration, backgroundCollections, cardEditorRef, isEnabled, isFlat,
}: Params) {
  const [selectedAddress, setSelectedAddress] = useState<string>();
  const [framePose, setFramePose] = useState<StickerFramePose>();
  const [playingAddress, setPlayingAddress] = useState<string>();
  const [menu, setMenu] = useState<{ collectible: GiftCollectible; anchor: IAnchorPosition }>();

  // The tile whose sticker is peeled off under its open menu
  const heldRef = useRef<StickerCarry>();
  // A gift screen hides the wallet screen, so its changes place stickers by the last card that was seen
  const cardMetricsRef = useRef<CardMetrics>();
  const frameRef = useRef<HTMLDivElement>();
  const ownWindow = useWindow();

  const motion = useStickerMotion({ faceRef, gridRef, isFlat });
  const {
    getGesture, startPress, startHandle, allowClick, consumeClick,
  } = useStickerPointer({
    onHold: (press) => {
      if (press.source === 'card') return true;

      // As in the iOS app, a gift off the card peels off together with its menu
      setMenu({ collectible: press.collectible, anchor: { x: press.start.x, y: press.start.y } });
      return !getIsStickerOnCard(decoration, press.collectible.address);
    },
    loadCarry: (press) => loadGiftTexture(getPressGift(press)),
    getCarryStart,
    onCarryStart: (carry, original) => {
      if (!carry.hasMenu) setMenu(undefined);
      motion.endPlay(carry.item.address);
      setSelectedAddress(undefined);
      motion.drag(carry.item, {
        original,
        start: getMotionTime(),
        isFromCard: Boolean(carry.sticker),
        x: carry.center.x,
        y: carry.center.y,
        angle: carry.angle,
        scale: carry.scale,
        samples: carry.samples,
      });
    },
    onCarryMove: (carry) => {
      motion.updateDrag(carry.item.address, {
        x: carry.center.x,
        y: carry.center.y,
        angle: carry.angle,
        scale: carry.scale,
        samples: carry.samples,
        isTwisting: Boolean(carry.twist),
      });
    },
    onCarryMenuClose: () => setMenu(undefined),
    onTap: (press) => {
      if (press.source !== 'card') return;

      setPlayingAddress(press.sticker.address);
      motion.play(press.sticker.address);
    },
    onRelease: (carry) => {
      // Released where it peeled off, the sticker waits for a choice in its menu
      if (carry.hasMenu) {
        heldRef.current = carry;
        motion.updateDrag(carry.item.address, { isReleased: true });
        return;
      }

      landCarry(carry);
    },
    onHandleMove: moveHandle,
    onHandleRelease: landHandle,
    onCancel: (gesture) => {
      // A cancelled handle keeps what it did, as a released one
      if (gesture.type === 'handle') {
        landHandle(gesture);
        return;
      }

      const pose = motion.getPose(gesture.item.address);
      if (!pose) return;

      // The card keeps the sticker where it was
      if (gesture.sticker) {
        motion.stick(gesture.item, pose, gesture.sticker.coordinates);
      } else {
        motion.flyHome(gesture.item, pose);
      }
    },
  });

  const measureCard = useLastCallback(() => {
    const face = faceRef.current;
    const metrics = face && measureCardMetrics(face);
    if (metrics?.card.width) cardMetricsRef.current = metrics;

    return cardMetricsRef.current;
  });

  const stickers = decoration?.stickers;
  const selectedSticker = selectedAddress ? stickers?.find(({ address }) => address === selectedAddress) : undefined;

  useEffect(() => {
    if (!isEnabled) return undefined;

    prepareStickerCurl();

    // The textures take the main thread, so they wait until the screen settles and go one by one
    let isCancelled = false;
    onFullyIdle(() => {
      measureCard();
      stickers?.reduce<Promise<unknown>>((previous, { gift }) => previous.then(() => (
        isCancelled ? undefined : loadGiftTexture(gift)
      )), Promise.resolve());
    });

    return () => {
      isCancelled = true;
    };
  }, [isEnabled, stickers, measureCard]);

  useEffect(() => {
    if (!isEnabled) return undefined;

    if (cardEditorRef) cardEditorRef.current = { requestSticker: handleCardStickerRequest };

    return () => {
      if (cardEditorRef) cardEditorRef.current = undefined;
      clearStickerTextures();
    };
  }, [cardEditorRef, isEnabled]);

  // The frame stands over the card in the viewport, measured after each change of the sticker. The measure waits for
  // the mutations of this frame, which straighten a card tilted by the pointer.
  useEffect(() => {
    if (!selectedSticker) {
      setFramePose(undefined);
      return;
    }

    requestMutation(() => requestMeasure(() => {
      const face = faceRef.current;
      if (face) setFramePose(getFramePose(face.getBoundingClientRect(), selectedSticker));
    }));
  }, [faceRef, selectedSticker]);

  useEffect(() => {
    if (!isEnabled) deselect();
  }, [isEnabled]);

  useEffect(() => (
    selectedSticker ? captureKeyboardListeners({ onEsc: deselect }, ownWindow.document) : undefined
  ), [selectedSticker, ownWindow]);

  // As in the desktop app, a press off the card and the frame deselects. The frame does not follow the card, so it
  // also goes once the screen scrolls or resizes.
  useEffect(() => {
    if (!selectedSticker) return undefined;

    const handleDeselect = () => {
      if (!getGesture()) deselect();
    };
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!faceRef.current?.contains(target) && !frameRef.current?.contains(target)) handleDeselect();
    };

    const { document } = ownWindow;
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('scroll', handleDeselect, true);
    ownWindow.addEventListener('resize', handleDeselect);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('scroll', handleDeselect, true);
      ownWindow.removeEventListener('resize', handleDeselect);
    };
  }, [selectedSticker, getGesture, faceRef, ownWindow]);

  useEffect(() => {
    const face = faceRef.current;
    if (!face || !isEnabled) return undefined;

    face.addEventListener('pointerdown', handleFacePointerDown);

    return () => {
      face.removeEventListener('pointerdown', handleFacePointerDown);
    };
  }, [faceRef, isEnabled]);

  const deselect = useLastCallback(() => {
    setSelectedAddress(undefined);
  });

  const handleFacePointerDown = useLastCallback((e: PointerEvent) => {
    if (getGesture() || !stickers?.length || (e.pointerType === 'mouse' && e.button !== 0)) return;

    const face = faceRef.current!;
    const faceRect = face.getBoundingClientRect();
    const sticker = !getIsCardControl(e.target) ? findStickerAt(stickers.filter(({ address }) => (
      !motion.getHasMotion(address)
    )), { x: e.clientX - faceRect.left, y: e.clientY - faceRect.top }, faceRect) : undefined;

    if (!sticker) {
      deselect();
      return;
    }

    // The card does not grow under a press that takes a sticker
    e.stopPropagation();
    prepareStickerCurl();
    loadGiftTexture(sticker.gift);

    const isTouch = e.pointerType !== 'mouse';
    if (!isTouch) {
      e.preventDefault();
      setSelectedAddress(sticker.address);
    }

    const point = getPointerPosition(e);
    startPress({
      type: 'press', source: 'card', sticker, pointerId: e.pointerId, start: point, last: point, isTouch,
    }, CARD_HOLD_MS);
  });

  const handleTilePointerDown = useLastCallback((e: React.PointerEvent, collectible: ApiWalletCollectible) => {
    allowClick();
    if (!isEnabled || getGesture() || !getIsGiftCollectible(collectible)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    prepareStickerCurl();
    measureCard();
    loadGiftTexture(collectible.gift);

    const isTouch = e.pointerType !== 'mouse';
    if (!isTouch) e.preventDefault();

    const point = getPointerPosition(e);
    const isOnCard = getIsStickerOnCard(decoration, collectible.address);
    startPress({
      type: 'press', source: 'tile', collectible, pointerId: e.pointerId, start: point, last: point, isTouch,
    }, isOnCard ? PLACED_TILE_HOLD_MS : TILE_HOLD_MS);
  });

  const handleTileContextMenu = useLastCallback((e: React.MouseEvent, collectible: ApiWalletCollectible) => {
    if (!isEnabled || !getIsGiftCollectible(collectible)) return;

    e.preventDefault();
    // A long touch fires this after its hold has opened the menu
    if (getGesture()) return;

    measureCard();
    loadGiftTexture(collectible.gift);

    setMenu({ collectible, anchor: { x: e.clientX, y: e.clientY } });
  });

  // A sticker peeled off under the menu flies back once the menu closes without a choice
  const closeMenu = useLastCallback(() => {
    setMenu(undefined);

    const held = heldRef.current;
    if (!held) return;

    heldRef.current = undefined;
    const pose = motion.getPose(held.item.address);
    if (pose) motion.flyHome(held.item, pose);
  });

  const handleMenuAction = useLastCallback((isColor?: boolean) => {
    const collectible = menu?.collectible;
    setMenu(undefined);
    if (!collectible) return;

    const held = heldRef.current?.item.address === collectible.address ? heldRef.current : undefined;
    heldRef.current = undefined;
    const heldPose = held && motion.getPose(collectible.address);

    changeSticker(collectible, isColor, heldPose && { pose: heldPose, isHeld: true });
  });

  // A new sticker flies off the gift model while the gift screen slides away. Other changes wait until the wallet
  // screen shows.
  const handleCardStickerRequest = useLastCallback(({
    address, gift, isColor, source,
  }: CardStickerRequest) => {
    const isPlaced = planStickerChange(decoration, { address, gift, isColor }, backgroundCollections).type === 'place';
    const sourceRect = source?.getBoundingClientRect();
    if (!isPlaced || !source || !sourceRect || !buildMotionItem(address, gift)) {
      motion.whenSettled(() => changeSticker({ address, gift }, isColor));
      return;
    }

    requestMutation(() => {
      source.style.visibility = 'hidden';
    });
    // The gift screen is out of sight once the wallet screen stops, and only then can the card scroll into view
    motion.whenSettled(() => requestMutation(() => {
      source.style.visibility = '';
      scrollCardIntoView();
    }));
    changeSticker({ address, gift }, isColor, {
      pose: getRectMotionPose(sourceRect),
      isFromGiftScreen: true,
    });
  });

  // The change of a menu or of a gift screen. A new sticker is thrown onto the card from where the gift is shown.
  const changeSticker = useLastCallback((
    { address, gift }: { address: string; gift: ApiStarGiftUnique }, isColor?: boolean, source?: ChangeSource,
  ) => {
    const item = buildMotionItem(address, gift);
    const change = planStickerChange(decoration, { address, gift, isColor }, backgroundCollections, measureCard());

    if (change.type === 'background') {
      saveCardDecoration(change.decoration);
      return;
    }

    if (change.type === 'remove') {
      peelOff(change.sticker);
      return;
    }

    if (change.type !== 'place') {
      if (change.type === 'limit') rejectOverLimit();
      if (item && source?.isHeld) motion.flyHome(item, source.pose);
      return;
    }

    const pose = source?.pose ?? motion.getTilePose(address);
    if (item && pose) motion.stick(item, pose, change.coordinates, { isThrown: true });

    saveCardDecoration(change.decoration);
    if (!source?.isFromGiftScreen) requestMutation(scrollCardIntoView);
  });

  function scrollCardIntoView() {
    faceRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // Reads the card when called, so a change saved meanwhile stays
  const removeFromCard = useLastCallback((address: string) => {
    saveCardDecoration(removeStickerFromCard(decoration, address));
  });

  const handlePlayEnd = useLastCallback(() => {
    if (playingAddress) motion.endPlay(playingAddress);
    setPlayingAddress(undefined);
  });

  const handleHandlePointerDown = useLastCallback((e: React.PointerEvent) => {
    const face = faceRef.current;
    if (!face || !selectedSticker || getGesture() || e.button !== 0) return;

    const item = buildMotionItem(selectedSticker.address, selectedSticker.gift);
    if (!item) return;

    e.preventDefault();
    e.stopPropagation();

    const pose = getFramePose(face.getBoundingClientRect(), selectedSticker);
    startHandle({
      type: 'handle',
      pointerId: e.pointerId,
      item,
      sticker: selectedSticker,
      from: getStickerPose(selectedSticker.coordinates),
      center: { x: pose.x, y: pose.y },
      pressed: getPointerPosition(e),
      pose,
    });
    motion.hold(item, buildMotionPose(pose));
  });

  function getCarryStart(press: StickerPress) {
    const face = faceRef.current;
    if (!face) return undefined;

    const isFromCard = press.source === 'card';
    const { address, gift } = isFromCard ? press.sticker : press.collectible;
    const item = buildMotionItem(address, gift);
    const original = isFromCard
      ? getCardMotionPose(press.sticker.coordinates, face.getBoundingClientRect())
      : motion.getTilePose(address);
    if (!item || !original || (!isFromCard && getIsStickerOnCard(decoration, address))) return undefined;

    return {
      item,
      gift,
      sticker: isFromCard ? press.sticker : undefined,
      original,
      scale: isFromCard ? clampStickerScale(getStickerPose(press.sticker.coordinates).scale) : 1,
      hasMenu: !isFromCard && press.isHeld && !press.isMenuClosed,
    };
  }

  // The handles of the desktop app turn and resize the selected sticker, and the frame goes with it
  function moveHandle(handle: StickerHandle, point: { x: number; y: number }, isSnapped: boolean) {
    const face = faceRef.current;
    const next = face && getHandlePose(handle.from, handle.center, handle.pressed, point, isSnapped);
    if (!next) return;

    // The frame takes its side from the coordinates the release saves, so it stays put on release
    handle.coordinates = buildStickerCoordinates(next, handle.sticker.coordinates.radius);
    handle.pose = {
      ...handle.pose,
      side: getStickerSide(handle.coordinates, face.getBoundingClientRect()),
      rotation: next.rotation,
    };
    motion.hold(handle.item, buildMotionPose(handle.pose));

    const { pose } = handle;
    requestMutation(() => {
      const frame = frameRef.current;
      if (!frame) return;

      frame.style.transform = buildFrameTransform(pose);
      frame.style.setProperty('--side', `${pose.side}px`);
    });
  }

  function landHandle({ item, sticker, coordinates, pose }: StickerHandle) {
    if (coordinates) {
      saveCardDecoration(moveStickerOnCard(decoration, { ...sticker, coordinates }));
      if (selectedAddress === sticker.address) setFramePose(pose);
    }

    motion.settle(item.address);
  }

  function landCarry(carry: StickerCarry) {
    const { item } = carry;
    const face = faceRef.current;
    const from = motion.getPose(item.address);
    if (!face || !from) return;

    const faceRect = face.getBoundingClientRect();
    const drop = planStickerDrop(decoration, {
      address: item.address,
      gift: carry.gift,
      sticker: carry.sticker,
      center: { x: from.x - faceRect.left, y: from.y - faceRect.top },
      scale: carry.scale,
      angle: carry.angle,
    }, faceRect);

    if (drop.type === 'home') {
      if (drop.decoration) saveCardDecoration(drop.decoration);
      const velocity = getMotionVelocity(carry.samples, getMotionTime());
      motion.flyHome(item, from, { isFast: velocity.y > FAST_THROW_SPEED });
      return;
    }

    if (!drop.decoration) {
      motion.stick(item, from, drop.coordinates, {
        isRejected: true,
        onHandOff: () => {
          rejectOverLimit();
          motion.shake(item.address);
        },
      });
      return;
    }

    motion.stick(item, from, drop.coordinates);
    saveCardDecoration(drop.decoration);
  }

  // The sticker peels off the card and flies home; the card lets it go once the layer shows it
  function peelOff(sticker: ApiWalletCardSticker) {
    const item = buildMotionItem(sticker.address, sticker.gift);
    const faceRect = faceRef.current?.getBoundingClientRect();
    if (!item || !faceRect) {
      removeFromCard(sticker.address);
      return;
    }

    motion.flyHome(item, getCardMotionPose(sticker.coordinates, faceRect), {
      isPeelFirst: true,
      onDrawn: () => removeFromCard(sticker.address),
    });
  }

  function rejectOverLimit() {
    showStickerLimitError();
    foldRef.current?.animate(SHAKE_KEYFRAMES, SHAKE_DURATION_MS);
  }

  const gesture = getGesture();

  return {
    selectedAddress: selectedSticker?.address,
    hiddenAddresses: motion.hiddenAddresses,
    liftedAddresses: motion.liftedAddresses,
    uncontactedAddresses: motion.uncontactedAddresses,
    playingAddress,
    motionItems: motion.items,
    // While a handle turns the sticker, the frame goes with it
    framePose: gesture?.type === 'handle' ? gesture.pose : framePose,
    isCarrying: gesture?.type === 'carry',
    isActive: Boolean(selectedSticker || motion.items.length),
    menu,
    frameRef,
    registerMotionView: motion.registerView,
    handleTilePointerDown,
    handleTileContextMenu,
    handleHandlePointerDown,
    handleMenuAction,
    handlePlayEnd,
    consumeTileClick: consumeClick,
    closeMenu,
  };
}

export function buildFrameTransform({ x, y, rotation }: StickerFramePose) {
  return `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
}

function buildMotionItem(address: string, gift: ApiStarGiftUnique): StickerMotionItem | undefined {
  const sticker = getStickerFromGift(gift);
  const texture = sticker && getLoadedStickerTexture(sticker);

  return texture && { address, texture };
}

function buildMotionPose({
  x, y, side, rotation,
}: StickerFramePose) {
  return createMotionPose({
    x, y, side, angle: (rotation * Math.PI) / 180,
  });
}

function loadGiftTexture(gift: ApiStarGiftUnique) {
  const sticker = getStickerFromGift(gift);

  return sticker && loadStickerTexture(sticker);
}

function getPressGift(press: StickerPress) {
  return press.source === 'card' ? press.sticker.gift : press.collectible.gift;
}

function getFramePose(faceRect: DOMRect, { coordinates }: ApiWalletCardSticker): StickerFramePose {
  const { x, y } = getStickerPose(coordinates);

  return {
    x: faceRect.left + x * faceRect.width,
    y: faceRect.top + y * faceRect.height,
    side: getStickerSide(coordinates, faceRect),
    rotation: coordinates.rotation,
  };
}

function getIsGiftCollectible(collectible: ApiWalletCollectible): collectible is GiftCollectible {
  return collectible.type === 'gift' && Boolean(collectible.gift);
}
