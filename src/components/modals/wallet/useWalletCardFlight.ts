import type { ElementRef } from '../../../lib/teact/teact';
import { useRef } from '../../../lib/teact/teact';

import type { CardFlightFrame, CardFlightGeometry } from './helpers/cardFlight';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { animate } from '../../../util/animation';
import { lerp } from '../../../util/math';
import {
  CLOSE_DURATION,
  FADE_CLOSE_DURATION,
  FADE_OPEN_DURATION,
  getCardFadeFrame,
  getCardFlightFrame,
  getSlotFeather,
  OPEN_DURATION,
  smooth,
} from './helpers/cardFlight';

import useEffectOnce from '../../../hooks/useEffectOnce';
import useLayoutEffectWithPrevDeps from '../../../hooks/useLayoutEffectWithPrevDeps';

type Flight = {
  isCancelled?: boolean;
  pill?: HTMLElement;
};

const SHUTTER_PROPERTY = '--wallet-card-shutter';
const MASK_STOPS = 8;
const MIN_CLOSE_DURATION = 60;

export default function useWalletCardFlight({
  cardRef, poseRef, buttonRef, userId, isOpen, isAnimated,
}: {
  cardRef: ElementRef<HTMLDivElement>;
  poseRef: ElementRef<HTMLDivElement>;
  buttonRef: ElementRef<HTMLElement>;
  userId?: string;
  isOpen: boolean;
  isAnimated?: boolean;
}) {
  const progressRef = useRef(0);
  const flightRef = useRef<Flight>();

  useLayoutEffectWithPrevDeps(([wasOpen]) => {
    if (!isAnimated || isOpen === Boolean(wasOpen)) return;

    // The measurement waits for the next frame, and the card and the button would show at rest in this one
    if (isOpen) {
      cardRef.current!.style.opacity = '0';
      if (buttonRef.current) buttonRef.current.style.opacity = '0';
    }

    requestMeasure(() => {
      const card = cardRef.current;
      const pose = poseRef.current;
      if (!card || !pose) return;

      const pill = userId ? findVisiblePill(userId) : undefined;
      const geometry = measureGeometry(card, pose, buttonRef.current, pill);
      // The mask is laid over the padded box of the card
      const outset = pose.offsetTop;
      const slotFeather = getSlotFeather(geometry.pill);
      const from = isOpen ? 0 : progressRef.current;
      // A settled card leaves along its own path, and one closed mid-flight goes back the way it came
      const isDismissing = !isOpen && from >= 1;
      const getFrame = pill
        ? (progress: number) => getCardFlightFrame(progress, geometry, isDismissing)
        : (progress: number) => getCardFadeFrame(progress, geometry);

      const previous = flightRef.current;
      if (previous) {
        previous.isCancelled = true;
        if (previous.pill !== pill) requestMutation(() => releasePill(previous.pill));
      }

      const flight: Flight = { pill };
      flightRef.current = flight;

      const duration = isOpen
        ? (pill ? OPEN_DURATION : FADE_OPEN_DURATION)
        : (pill ? Math.max(MIN_CLOSE_DURATION, CLOSE_DURATION * from) : FADE_CLOSE_DURATION);
      const startedAt = performance.now();

      animate(() => {
        if (flight.isCancelled) return false;

        const time = Math.min(1, (performance.now() - startedAt) / duration);
        const progress = lerp(from, isOpen ? 1 : 0, time);
        progressRef.current = progress;

        const frame = getFrame(progress);
        const mask = frame.slotEdge === undefined ? '' : buildSlotMask(outset + frame.slotEdge, slotFeather);
        applyFrame(card, pose, buttonRef.current, pill, frame, mask);
        if (time < 1) return true;

        if (isOpen) {
          resetCard(card, pose, buttonRef.current);
        } else {
          releasePill(pill);
        }

        return false;
      }, requestMutation);
    });
  }, [isOpen, isAnimated, userId, cardRef, poseRef, buttonRef]);

  useEffectOnce(() => () => {
    const flight = flightRef.current;
    if (!flight) return;

    flight.isCancelled = true;
    releasePill(flight.pill);
  });
}

// A closed right column keeps the profile in the document, shifted past the edge of the window
function findVisiblePill(userId: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-wallet-card-origin="${userId}"]`))
    .find((element) => {
      const {
        width, left, right, top, bottom,
      } = element.getBoundingClientRect();
      return width > 0 && right > 0 && left < window.innerWidth && bottom > 0 && top < window.innerHeight;
    });
}

// The offsets ignore transforms, so the resting places are found even while the card flies
function measureGeometry(
  card: HTMLElement, pose: HTMLElement, button?: HTMLElement, pill?: HTMLElement,
): CardFlightGeometry {
  const dialog = card.offsetParent!.getBoundingClientRect();
  const pillRect = pill?.getBoundingClientRect();

  return {
    card: {
      left: dialog.left + card.offsetLeft + pose.offsetLeft,
      top: dialog.top + card.offsetTop + pose.offsetTop,
      width: pose.offsetWidth,
      height: pose.offsetHeight,
    },
    pill: {
      left: pillRect?.left ?? 0,
      top: pillRect?.top ?? 0,
      width: pillRect?.width ?? 0,
      height: pillRect?.height ?? 0,
    },
    buttonTop: dialog.top + (button?.offsetTop ?? 0),
    screenHeight: window.innerHeight,
  };
}

function applyFrame(
  card: HTMLElement, pose: HTMLElement, button: HTMLElement | undefined, pill: HTMLElement | undefined,
  frame: CardFlightFrame, mask: string,
) {
  card.style.translate = `${frame.offsetX}px ${frame.offsetY}px`;
  card.style.opacity = String(frame.opacity);
  card.style.maskImage = mask;
  pose.style.transform = frame.transform;
  if (button) {
    button.style.translate = `0 ${frame.buttonOffset}px`;
    button.style.opacity = '';
  }
  pill?.style.setProperty(SHUTTER_PROPERTY, `${-frame.shutter}px`);
}

function resetCard(card: HTMLElement, pose: HTMLElement, button?: HTMLElement) {
  card.style.translate = '';
  card.style.opacity = '';
  card.style.maskImage = '';
  pose.style.transform = '';
  if (button) button.style.translate = '';
}

function releasePill(pill?: HTMLElement) {
  pill?.style.removeProperty(SHUTTER_PROPERTY);
}

function buildSlotMask(edge: number, feather: number) {
  const stops = Array.from({ length: MASK_STOPS + 1 }, (_, i) => {
    const t = i / MASK_STOPS;
    return `rgb(0 0 0 / ${smooth(t)}) ${edge + t * feather}px`;
  });

  return `linear-gradient(${stops.join(', ')})`;
}
