import type { ApiMediaAreaCoordinates } from '../../../../api/types';
import type { DragMotion, FlightMotion, MotionPose } from './cardStickerMotion';

import { areArraysShallowEqual } from '../../../../util/areShallowEqual';
import { getFlightContact, getFlightDuration, getFlightHandOff } from './cardStickerMotion';

// A sticker off the card: carried, flying, or held in a pose from outside
export type StickerMotion = {
  address: string;
  drag?: DragMotion;
  flight?: FlightMotion;
  // The card place a sticking flight goes to
  target?: ApiMediaAreaCoordinates;
  // A pose held from outside, as of a sticker turned by its handles
  pose?: MotionPose;
  drawnFrames: number;
  // Counts the frames after landing; set once the card or the tile has the sticker back
  landedFrames?: number;
  isContacted?: boolean;
  isHandedOff?: boolean;
};

type StickerMotionEvent = 'contacted' | 'handedOff' | 'landed' | 'rejected' | 'ended';

export type StickerMotionSnapshot = {
  // On the card, which shows the layer instead
  hidden: string[];
  // In the tile, which shows the silhouette instead
  lifted: string[];
  // Flying to the card, whose color waits until they touch it
  uncontacted: string[];
};

// The card and the tile let a sticker go once the layer has shown it for a couple of frames, and the layer keeps a
// landed sticker for a couple of frames after they take it back, so a late frame of either leaves no gap
const SHOWN_FRAMES = 2;
export const LANDED_FRAMES = 2;
// Seconds: an animated sticker lasts up to 3 s, and its first frame may take a moment to load
export const MAX_PLAY_DURATION = 4;

// Moves a flight on to `now`. A rejected flight is for the caller to send home, as that needs the layout.
export function advanceStickerMotion(motion: StickerMotion, now: number) {
  const events: StickerMotionEvent[] = [];

  if (motion.landedFrames !== undefined) {
    const landedFrames = motion.landedFrames + 1;
    if (landedFrames > LANDED_FRAMES) events.push('ended');

    return { motion: { ...motion, landedFrames }, events };
  }

  const { flight } = motion;
  if (!flight || motion.drag || motion.pose) return { motion, events };

  const elapsed = now - flight.start;
  let next = motion;

  if (flight.type === 'stick') {
    if (!next.isContacted && elapsed >= getFlightContact(flight)) {
      next = { ...next, isContacted: true };
      events.push('contacted');
    }

    if (!next.isHandedOff && elapsed >= getFlightHandOff(flight)) {
      next = { ...next, isHandedOff: true };
      events.push('handedOff');
    }
  }

  if (elapsed >= getFlightDuration(flight)) {
    if (flight.isRejected && next.target) {
      events.push('rejected');
    } else {
      next = { ...next, landedFrames: 0 };
      events.push('landed');
    }
  }

  return { motion: next, events };
}

export function getIsStickerMotionShown({ drawnFrames }: StickerMotion) {
  return drawnFrames >= SHOWN_FRAMES;
}

export function getStickerMotionSnapshot(motions: StickerMotion[]): StickerMotionSnapshot {
  const flying = motions.filter(({ landedFrames }) => landedFrames === undefined);

  return {
    hidden: flying.filter((motion) => (
      getIsStickerMotionShown(motion) && !motion.isHandedOff
      && Boolean(motion.drag?.isFromCard || motion.pose || motion.flight?.type === 'stick')
    )).map(({ address }) => address),
    // A sticker flying home keeps its tile empty from the start
    lifted: flying.filter((motion) => getIsStickerMotionShown(motion) || Boolean(motion.flight))
      .map(({ address }) => address),
    uncontacted: motions.filter(({ flight, isContacted }) => flight?.type === 'stick' && !isContacted)
      .map(({ address }) => address),
  };
}

export function getAreStickerMotionSnapshotsEqual(first: StickerMotionSnapshot, second: StickerMotionSnapshot) {
  return (Object.keys(first) as (keyof StickerMotionSnapshot)[])
    .every((key) => areArraysShallowEqual(first[key], second[key]));
}

// Keeps the items whose address and texture stay, so their canvases live on while the other stickers come and go
export function reuseStickerMotionItems<T extends { address: string; texture: unknown }>(current: T[], next: T[]) {
  const currentByAddress = new Map(current.map((item) => [item.address, item]));
  const items = next.map((item) => {
    const previous = currentByAddress.get(item.address);
    return previous && previous.texture === item.texture ? previous : item;
  });

  return areArraysShallowEqual(items, current) ? current : items;
}

// A sticker whose animation never reports its end, a video or one not loaded, stops playing after the longest
// animation a sticker can have
export function getPlayEnd(start: number, end: number | undefined, now: number) {
  return end ?? (now - start >= MAX_PLAY_DURATION ? now : undefined);
}
