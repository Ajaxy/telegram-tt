import {
  beginHeavyAnimation,
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiStarGiftAttributeBackdrop,
  ApiStarGiftAttributeModel,
  ApiStarGiftAttributePattern,
  ApiStarGiftUnique,
  ApiSticker,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { requestMeasure, requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { VTT_CRAFT_ATTRIBUTES } from '../../../../util/animations/viewTransitionTypes';
import buildClassName from '../../../../util/buildClassName';
import { getNextArrowReplacement } from '../../../../util/localization/format';
import { formatPercent } from '../../../../util/textFormat';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';
import { getGiftAttributes } from '../../../common/helpers/gifts';
import { REM } from '../../../common/helpers/mediaDimensions';

import { useViewTransition } from '../../../../hooks/animations/useViewTransition';
import { useVtn } from '../../../../hooks/animations/useVtn';
import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedCounter from '../../../common/AnimatedCounter';
import AnimatedIcon from '../../../common/AnimatedIcon';
import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';
import CustomEmoji from '../../../common/CustomEmoji';
import GiftRibbon from '../../../common/gift/GiftRibbon';
import Icon from '../../../common/icons/Icon';
import RadialPatternBackground from '../../../common/profile/RadialPatternBackground';
import StickerView from '../../../common/StickerView';
import Button from '../../../ui/Button';
import Modal from '../../../ui/Modal';
import Transition from '../../../ui/Transition';
import RadialProgress from './RadialProgress';

import styles from './GiftCraftModal.module.scss';

import craftPatternUrl from '../../../../assets/font-icons/craft.svg';

export type OwnProps = {
  modal: TabState['giftCraftModal'];
};

type StateProps = {
  craftAttributePermilles?: number[];
};

// ===================
// Types
// ===================
type FaceName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

interface Vector3D {
  x: number;
  y: number;
  z: number;
}

interface FaceData {
  name: FaceName;
  normal: Vector3D;
  translate: [number, number, number];
  rotate: [number, number, number];
}

// ===================
// Configuration
// ===================
const STICKER_SIZE = 3.25 * REM;
const CUBE_SIZE = 7.5 * REM;
const SLOT_SIZE = 4.5 * REM;
const CUBE_HALF = CUBE_SIZE / 2;

const CONFIG = {
  cubeSize: CUBE_SIZE,
  cubeHalf: CUBE_HALF,
  slotSize: SLOT_SIZE,
  perspective: 600,

  // Physics
  maxSpeed: 15,
  friction: 0.992,
  minVelocity: 0.1,
  idleSpeed: 0.4,

  // Animation
  flightSpeed: 0.75,
  minFlightDuration: 250,
  maxFlightDuration: 500,
  flightEasing: 'cubic-bezier(0.7, 0, 1, 1)',
  faceSelectionTime: 1,

  // Square kick
  squareKickStrength: 20,
  kickMomentumDampen: 0.15,

  // Last slot special kick
  lastKickStrength: 40,
  lastKickFriction: 0.998,

  // Result braking
  brakingFriction: 0.985,
  brakingDuration: 700,

  // Craft result
  craftInitialDelay: 350,
  slotFlightInterval: 650,
  craftActionDelay: 200,
  resultFadeDelay: 300,
  resultRotationDuration: 650,
  resultDisplayDuration: 800,

  // Slot removal
  slotRemoveDuration: 150,
};

const ATTRIBUTE_DIAL_SIZE = 4 * REM;

const GRADIENT_COLORS_DEFAULT: [string, string] = ['#425068', '#232E3F'];
const GRADIENT_COLORS_HIGH_CHANCE: [string, string] = ['#365C61', '#1A2F38'];
const GRADIENT_COLORS_FAILED: [string, string] = ['#5C362C', '#351B17'];

const HIGH_CHANCE_THRESHOLD = 95;

const FACES_DATA: FaceData[] = [
  { name: 'front', normal: { x: 0, y: 0, z: 1 }, translate: [0, 0, CUBE_HALF], rotate: [0, 0, 0] },
  { name: 'back', normal: { x: 0, y: 0, z: -1 }, translate: [0, 0, -CUBE_HALF], rotate: [0, 180, 0] },
  { name: 'left', normal: { x: -1, y: 0, z: 0 }, translate: [-CUBE_HALF, 0, 0], rotate: [0, -90, 0] },
  { name: 'right', normal: { x: 1, y: 0, z: 0 }, translate: [CUBE_HALF, 0, 0], rotate: [0, 90, 0] },
  { name: 'top', normal: { x: 0, y: -1, z: 0 }, translate: [0, -CUBE_HALF, 0], rotate: [90, 0, 0] },
  { name: 'bottom', normal: { x: 0, y: 1, z: 0 }, translate: [0, CUBE_HALF, 0], rotate: [-90, 0, 0] },
];

const FACES_BY_NAME = Object.fromEntries(FACES_DATA.map((f) => [f.name, f])) as Record<FaceName, FaceData>;

const PATTERN_STICKER_SIZE = 1.875 * REM;
const PATTERN_STICKER_COLOR = '#FFFFFF';

const PatternAttributePreview = memo(({ sticker }: { sticker: ApiSticker }) => {
  const ref = useRef<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={styles.patternAttribute}
      style={`width: ${PATTERN_STICKER_SIZE}px; height: ${PATTERN_STICKER_SIZE}px`}
    >
      <StickerView
        containerRef={ref}
        sticker={sticker}
        size={PATTERN_STICKER_SIZE}
        customColor={PATTERN_STICKER_COLOR}
        shouldPreloadPreview
        thumbClassName={styles.patternAttributeThumb}
      />
    </div>
  );
});

type CraftSlotProps = {
  index: number;
  gift?: ApiStarGiftUnique;
  isUsed: boolean;
  isAnimating: boolean;
  isActivated: boolean;
  isRemoving: boolean;
  slotRef: (el: HTMLDivElement | undefined) => void;
  slotInnerRef: (el: HTMLDivElement | undefined) => void;
  onSlotClick: (index: number) => void;
  onRemoveGift: (index: number) => void;
};

const CraftSlot = memo(({
  index,
  gift,
  isUsed,
  isAnimating,
  isActivated,
  isRemoving,
  slotRef,
  slotInnerRef,
  onSlotClick,
  onRemoveGift,
}: CraftSlotProps) => {
  const giftAttributes = useMemo(() => (gift ? getGiftAttributes(gift) : undefined), [gift]);
  const chancePercent = (gift?.craftChancePermille || 0) / 10;

  const handleClick = useLastCallback(() => {
    if (!isActivated) {
      onSlotClick(index);
    }
  });

  const handleRemoveClick = useLastCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveGift(index);
  });

  return (
    <div
      className={buildClassName(
        styles.slotWrapper,
        isUsed && styles.used,
        index >= 2 && styles.bottomRow,
      )}
    >
      <div
        ref={slotRef}
        className={buildClassName(
          styles.craftSlot,
          gift && styles.craftSlotFilled,
          isAnimating && styles.animating,
          isRemoving && styles.removing,
        )}
        onClick={handleClick}
      >
        {gift && giftAttributes ? (
          <>
            <div
              ref={slotInnerRef}
              className={styles.slotInner}
            >
              <RadialPatternBackground
                className={styles.slotBackdrop}
                backgroundColors={[giftAttributes.backdrop!.centerColor, giftAttributes.backdrop!.edgeColor]}
                ringsCount={1}
                ovalFactor={1}
                patternSize={12}
                patternIcon={giftAttributes.pattern?.sticker}
              />
              <AnimatedIconFromSticker
                className={styles.slotSticker}
                sticker={giftAttributes.model?.sticker}
                size={STICKER_SIZE}
              />
            </div>
            {chancePercent > 0 && (
              <span className={styles.slotChance}>
                {formatPercent(chancePercent, 0)}
              </span>
            )}
            {!isActivated && (
              <button
                type="button"
                className={styles.slotClear}
                onClick={handleRemoveClick}
              >
                <Icon name="close" />
              </button>
            )}
          </>
        ) : (
          <Icon name="add-filled" className={styles.slotIcon} />
        )}
      </div>
    </div>
  );
});

const GiftCraftModal = ({ modal, craftAttributePermilles }: OwnProps & StateProps) => {
  const {
    closeGiftCraftModal, openGiftCraftSelectModal, selectGiftForCraft,
    craftStarGift, requestConfetti, openGiftInfoModal, openGiftCraftInfoModal,
    resetGiftCraftResult, openGiftPreviewModal,
  } = getActions();

  const lang = useLang();
  const { startViewTransition } = useViewTransition();
  const { createVtnStyle } = useVtn();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const savedGift1 = renderingModal?.gift1;
  const savedGift2 = renderingModal?.gift2;
  const savedGift3 = renderingModal?.gift3;
  const savedGift4 = renderingModal?.gift4;
  const craftResult = renderingModal?.craftResult;
  const previewAttributes = renderingModal?.previewAttributes;

  // Extract unique gifts from saved gifts
  const gift1 = savedGift1?.gift.type === 'starGiftUnique' ? savedGift1.gift : undefined;
  const gift2 = savedGift2?.gift.type === 'starGiftUnique' ? savedGift2.gift : undefined;
  const gift3 = savedGift3?.gift.type === 'starGiftUnique' ? savedGift3.gift : undefined;
  const gift4 = savedGift4?.gift.type === 'starGiftUnique' ? savedGift4.gift : undefined;

  const mainGift = gift1 || gift2 || gift3 || gift4;
  const lastMainGift = useCurrentOrPrev(mainGift, true);
  const giftTitle = mainGift?.title || renderingModal?.regularGiftTitle || '';

  const gifts = useMemo(
    () => [gift1, gift2, gift3, gift4],
    [gift1, gift2, gift3, gift4],
  );

  const totalChancePermille = useMemo(() => {
    const getChance = (g?: ApiStarGiftUnique) => g?.craftChancePermille || 0;
    return getChance(gift1) + getChance(gift2) + getChance(gift3) + getChance(gift4);
  }, [gift1, gift2, gift3, gift4]);

  const progressPercent = Math.min(100, totalChancePermille / 10);

  const fullGiftTitle = useMemo(() => {
    const giftNumber = mainGift?.number;
    if (!giftTitle) return '';
    return giftNumber ? `${giftTitle} #${giftNumber}` : giftTitle;
  }, [giftTitle, mainGift?.number]);

  const titleGiftSticker = useMemo(() => {
    if (!mainGift) return undefined;
    return getGiftAttributes(mainGift)?.model?.sticker;
  }, [mainGift]);

  const previewModelStickers = useMemo(() => {
    if (!previewAttributes?.length) return undefined;
    return previewAttributes
      .filter((attr): attr is ApiStarGiftAttributeModel => attr.type === 'model')
      .slice(0, 3)
      .map((attr) => attr.sticker);
  }, [previewAttributes]);

  // Calculate attribute stats for probability circles
  const attributeStats = useMemo(() => {
    const selectedGifts = gifts.filter((g): g is ApiStarGiftUnique => Boolean(g));
    if (selectedGifts.length === 0) return { backdrops: [], patterns: [] };

    const backdropCounts = new Map<number, { count: number; attr: ApiStarGiftAttributeBackdrop }>();
    const patternCounts = new Map<string, { count: number; attr: ApiStarGiftAttributePattern }>();

    for (const gift of selectedGifts) {
      for (const attr of gift.attributes) {
        if (attr.type === 'backdrop') {
          const existing = backdropCounts.get(attr.backdropId);
          if (existing) {
            existing.count++;
          } else {
            backdropCounts.set(attr.backdropId, { count: 1, attr });
          }
        } else if (attr.type === 'pattern') {
          const key = attr.sticker.id;
          const existing = patternCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            patternCounts.set(key, { count: 1, attr });
          }
        }
      }
    }

    const totalGifts = selectedGifts.length;
    const getPermille = (count: number) => {
      if (!craftAttributePermilles?.length || totalGifts === 0) return 0;
      const giftsIndex = Math.min(totalGifts, craftAttributePermilles.length) - 1;
      const perGiftsArray = craftAttributePermilles[giftsIndex];
      if (!Array.isArray(perGiftsArray)) return 0;
      const countIndex = Math.min(count, perGiftsArray.length) - 1;
      return perGiftsArray[countIndex] ?? 0;
    };

    const backdrops = Array.from(backdropCounts.values())
      .map(({ count, attr }) => ({ attr, count, permille: getPermille(count) }))
      .sort((a, b) => b.count - a.count);

    const patterns = Array.from(patternCounts.values())
      .map(({ count, attr }) => ({ attr, count, permille: getPermille(count) }))
      .sort((a, b) => b.count - a.count);

    return { backdrops, patterns };
  }, [gifts, craftAttributePermilles]);

  // DOM refs
  const cubeRef = useRef<HTMLDivElement>();
  const faceRefs = useRef<Record<FaceName, HTMLDivElement | undefined>>({
    front: undefined,
    back: undefined,
    left: undefined,
    right: undefined,
    top: undefined,
    bottom: undefined,
  });
  const slotRefs = useRef<(HTMLDivElement | undefined)[]>([]);
  const slotInnerRefs = useRef<(HTMLDivElement | undefined)[]>([]);
  const backfaceRemovedRef = useRef(false);

  // Physics state refs (mutable, not triggering re-renders)
  const rotationMatrixRef = useRef<DOMMatrix>(new DOMMatrix());
  const velocityRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | undefined>(undefined);
  const tempDeltaMatrixRef = useRef<DOMMatrix>(new DOMMatrix());
  const tempNormalRef = useRef<Vector3D>({ x: 0, y: 0, z: 0 });
  const faceTransformsRef = useRef<Record<FaceName, DOMMatrix> | undefined>(undefined);
  const kickIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastKickedFaceRef = useRef<FaceName | undefined>(undefined);
  const lastSlotIndexRef = useRef<number>(-1);
  const currentFrictionRef = useRef(CONFIG.friction);

  // Animation state
  const [isActivated, activate, deactivate] = useFlag();
  const [slotsKey, setSlotsKey] = useState(0);

  const coloredFacesRef = useRef<Set<FaceName>>(new Set());
  const [usedSlots, setUsedSlots] = useState<Set<number>>(() => new Set());
  const [animatingSlots, setAnimatingSlots] = useState<Set<number>>(() => new Set());
  const [removingSlots, setRemovingSlots] = useState<Set<number>>(() => new Set());
  const [craftedGiftFace, setCraftedGiftFace] = useState<{
    face: FaceName;
    gift: ApiStarGiftUnique;
  } | undefined>(undefined);
  const [failedFace, setFailedFace] = useState<{
    face: FaceName;
    burnedCount: number;
    isError?: true;
  } | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isResultRotationComplete, markResultRotationComplete, resetResultRotation] = useFlag();
  const [isRotationStarted, startRotation, resetRotationStarted] = useFlag();

  // Initialize face transforms
  useEffect(() => {
    if (!faceTransformsRef.current) {
      const transforms: Record<string, DOMMatrix> = {};
      for (const face of FACES_DATA) {
        transforms[face.name] = new DOMMatrix()
          .translateSelf(...face.translate)
          .rotateSelf(...face.rotate);
      }
      faceTransformsRef.current = transforms as Record<FaceName, DOMMatrix>;
    }
  }, []);

  const resetAnimationState = useLastCallback(() => {
    rotationMatrixRef.current = new DOMMatrix();
    velocityRef.current = { x: 0, y: 0 };
    backfaceRemovedRef.current = false;
    lastKickedFaceRef.current = undefined;
    lastSlotIndexRef.current = -1;
    currentFrictionRef.current = CONFIG.friction;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }
    if (kickIntervalRef.current) {
      clearInterval(kickIntervalRef.current);
      kickIntervalRef.current = undefined;
    }

    coloredFacesRef.current = new Set();
    setUsedSlots(new Set());
    setAnimatingSlots(new Set());
    setRemovingSlots(new Set());
    setRenderingAttributes([]);
    deactivate();
    setCraftedGiftFace(undefined);
    setFailedFace(undefined);
    resetResultRotation();
    resetRotationStarted();

    requestMutation(() => {
      // Reset cube transform
      if (cubeRef.current) {
        cubeRef.current.style.transform = '';
      }

      // Reset face backgrounds and backface-visibility
      Object.values(faceRefs.current).forEach((face) => {
        if (face) {
          face.style.background = '';
          face.style.backfaceVisibility = '';
        }
      });

      // Reset slot transforms
      slotRefs.current.forEach((slot) => {
        if (slot) {
          slot.style.transform = '';
          slot.style.transition = '';
          slot.style.position = '';
          slot.style.top = '';
          slot.style.left = '';
          slot.style.marginTop = '';
          slot.style.marginLeft = '';
          slot.classList.remove(styles.craftSlotHidden);
        }
      });
    });
  });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetAnimationState();
    }
  }, [isOpen, resetAnimationState]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = undefined;
      }
      if (kickIntervalRef.current) {
        clearInterval(kickIntervalRef.current);
        kickIntervalRef.current = undefined;
      }
    };
  }, []);

  // Fade out slots when result rotation is complete
  useEffect(() => {
    if (isRotationStarted) {
      slotRefs.current.forEach((slot) => {
        if (slot) {
          requestMutation(() => {
            slot.classList.add(styles.craftSlotHidden);
          });
        }
      });
    }
  }, [isRotationStarted]);

  // ===================
  // Physics Functions
  // ===================
  const resetMatrix = (matrix: DOMMatrix) => {
    matrix.a = 1;
    matrix.b = 0;
    matrix.c = 0;
    matrix.d = 1;
    matrix.e = 0;
    matrix.f = 0;
    matrix.m11 = 1;
    matrix.m12 = 0;
    matrix.m13 = 0;
    matrix.m14 = 0;
    matrix.m21 = 0;
    matrix.m22 = 1;
    matrix.m23 = 0;
    matrix.m24 = 0;
    matrix.m31 = 0;
    matrix.m32 = 0;
    matrix.m33 = 1;
    matrix.m34 = 0;
    matrix.m41 = 0;
    matrix.m42 = 0;
    matrix.m43 = 0;
    matrix.m44 = 1;
  };

  const transformNormalZ = (normal: Vector3D, matrix: DOMMatrix): number => {
    return matrix.m13 * normal.x + matrix.m23 * normal.y + matrix.m33 * normal.z;
  };

  const transformNormal = (normal: Vector3D, matrix: DOMMatrix, out: Vector3D): Vector3D => {
    out.x = matrix.m11 * normal.x + matrix.m21 * normal.y + matrix.m31 * normal.z;
    out.y = matrix.m12 * normal.x + matrix.m22 * normal.y + matrix.m32 * normal.z;
    out.z = matrix.m13 * normal.x + matrix.m23 * normal.y + matrix.m33 * normal.z;
    return out;
  };

  const predictRotationMatrix = (ms: number): DOMMatrix => {
    const frames = Math.round(ms / 16.67);
    const { friction, minVelocity } = CONFIG;

    let predVelX = velocityRef.current.x;
    let predVelY = velocityRef.current.y;
    let predMatrix = DOMMatrix.fromMatrix(rotationMatrixRef.current);
    const tempMatrix = new DOMMatrix();

    for (let i = 0; i < frames; i++) {
      if (Math.abs(predVelX) > minVelocity || Math.abs(predVelY) > minVelocity) {
        resetMatrix(tempMatrix);
        tempMatrix.rotateSelf(predVelX, predVelY, 0);
        predMatrix = tempMatrix.multiply(predMatrix);
        predVelX *= friction;
        predVelY *= friction;
      }
    }

    return predMatrix;
  };

  const getLargestVisibleFace = (
    matrix: DOMMatrix,
    excludeFaces: Set<FaceName>,
  ): FaceName | undefined => {
    let bestFace: FaceName | undefined;
    let bestZ = -Infinity;

    for (const face of FACES_DATA) {
      if (excludeFaces.has(face.name)) continue;

      const z = transformNormalZ(face.normal, matrix);
      if (z <= 0) continue;

      if (z > bestZ) {
        bestZ = z;
        bestFace = face.name;
      }
    }

    return bestFace;
  };

  const capVelocity = () => {
    const { maxSpeed } = CONFIG;
    const currentSpeed = Math.sqrt(
      velocityRef.current.x * velocityRef.current.x + velocityRef.current.y * velocityRef.current.y,
    );
    if (currentSpeed > maxSpeed) {
      const scale = maxSpeed / currentSpeed;
      velocityRef.current.x *= scale;
      velocityRef.current.y *= scale;
    }
  };

  const applyKickWithNormal = (flightDirX: number, flightDirY: number, faceNormal: Vector3D, strength: number) => {
    const flightLen = Math.sqrt(flightDirX * flightDirX + flightDirY * flightDirY);
    const fdx = flightDirX / flightLen;
    const fdy = flightDirY / flightLen;

    const fLen = Math.sqrt(fdx * fdx + fdy * fdy + 1);
    const fx = fdx / fLen;
    const fy = fdy / fLen;
    const fz = -1 / fLen;

    const torqueX = faceNormal.y * fz - faceNormal.z * fy;
    const torqueY = faceNormal.z * fx - faceNormal.x * fz;

    velocityRef.current.x *= CONFIG.kickMomentumDampen;
    velocityRef.current.y *= CONFIG.kickMomentumDampen;

    velocityRef.current.x += torqueX * strength;
    velocityRef.current.y += torqueY * strength;
    capVelocity();
  };

  // ===================
  // Decelerate to Face
  // ===================
  const decelerateToFace = useLastCallback((targetFace: FaceName, onComplete: NoneToVoidFunction) => {
    const duration = CONFIG.resultRotationDuration;
    const startTime = performance.now();

    // Keep the actual start matrix (don't extract/reconstruct angles)
    const startMatrix = DOMMatrix.fromMatrix(rotationMatrixRef.current);

    // Get current rotation direction from velocity
    const yRotationDirection = Math.sign(velocityRef.current.y) || 1;

    // Calculate target matrix based on face
    let targetMatrix: DOMMatrix;
    switch (targetFace) {
      case 'front':
        targetMatrix = new DOMMatrix(); // identity
        break;
      case 'back':
        targetMatrix = new DOMMatrix().rotateSelf(0, 180, 0);
        break;
      case 'left':
        targetMatrix = new DOMMatrix().rotateSelf(0, 90, 0);
        break;
      case 'right':
        targetMatrix = new DOMMatrix().rotateSelf(0, -90, 0);
        break;
      case 'top':
        targetMatrix = new DOMMatrix().rotateSelf(-90, 0, 0);
        break;
      case 'bottom':
        targetMatrix = new DOMMatrix().rotateSelf(90, 0, 0);
        break;
      default:
        targetMatrix = new DOMMatrix();
    }

    // Calculate how much extra rotation to add based on current direction
    // This makes the cube "spin through" to the target following inertia
    const extraSpins = yRotationDirection > 0 ? 1 : -1; // Add one full spin in current direction
    const spinMatrix = new DOMMatrix().rotateSelf(0, extraSpins * 360, 0);
    targetMatrix = spinMatrix.multiply(targetMatrix);

    // Stop the regular animation loop
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }

    // Use longer duration for the extra spin
    const scaledDuration = duration * 2;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / scaledDuration, 1);
      // Ease out cubic for smooth deceleration
      const eased = 1 - (1 - progress) ** 3;

      // Interpolate matrix elements and orthonormalize
      const m = new DOMMatrix();
      m.m11 = startMatrix.m11 + (targetMatrix.m11 - startMatrix.m11) * eased;
      m.m12 = startMatrix.m12 + (targetMatrix.m12 - startMatrix.m12) * eased;
      m.m13 = startMatrix.m13 + (targetMatrix.m13 - startMatrix.m13) * eased;
      m.m21 = startMatrix.m21 + (targetMatrix.m21 - startMatrix.m21) * eased;
      m.m22 = startMatrix.m22 + (targetMatrix.m22 - startMatrix.m22) * eased;
      m.m23 = startMatrix.m23 + (targetMatrix.m23 - startMatrix.m23) * eased;
      m.m31 = startMatrix.m31 + (targetMatrix.m31 - startMatrix.m31) * eased;
      m.m32 = startMatrix.m32 + (targetMatrix.m32 - startMatrix.m32) * eased;
      m.m33 = startMatrix.m33 + (targetMatrix.m33 - startMatrix.m33) * eased;

      // Gram-Schmidt orthonormalization to prevent distortion
      // Column 1 - normalize
      let len = Math.sqrt(m.m11 * m.m11 + m.m21 * m.m21 + m.m31 * m.m31);
      m.m11 /= len;
      m.m21 /= len;
      m.m31 /= len;
      // Column 2 - subtract projection onto column 1, then normalize
      const dot = m.m11 * m.m12 + m.m21 * m.m22 + m.m31 * m.m32;
      m.m12 -= dot * m.m11;
      m.m22 -= dot * m.m21;
      m.m32 -= dot * m.m31;
      len = Math.sqrt(m.m12 * m.m12 + m.m22 * m.m22 + m.m32 * m.m32);
      m.m12 /= len;
      m.m22 /= len;
      m.m32 /= len;
      // Column 3 - cross product of columns 1 and 2
      m.m13 = m.m21 * m.m32 - m.m31 * m.m22;
      m.m23 = m.m31 * m.m12 - m.m11 * m.m32;
      m.m33 = m.m11 * m.m22 - m.m21 * m.m12;

      rotationMatrixRef.current = m;

      const transformValue = m.toString();
      requestMutation(() => {
        if (cubeRef.current) {
          cubeRef.current.style.transform = transformValue;
        }
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };

    requestAnimationFrame(animate);
  });

  // ===================
  // Animation Loop
  // ===================
  const lastTimeRef = useRef<number>(0);

  const startAnimationLoop = useLastCallback(() => {
    if (rafIdRef.current !== undefined) return;

    const { minVelocity, idleSpeed } = CONFIG;
    const tempMatrix = tempDeltaMatrixRef.current;

    lastTimeRef.current = performance.now();

    const update = (now: number) => {
      const dt = (now - lastTimeRef.current) / 16.67;
      lastTimeRef.current = now;

      const vel = velocityRef.current;

      // Apply friction (using current friction ref for dynamic control)
      const frictionFactor = currentFrictionRef.current ** dt;
      vel.x *= frictionFactor;
      vel.y *= frictionFactor;

      // Maintain minimum idle rotation
      const currentSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (currentSpeed < idleSpeed) {
        if (currentSpeed > 0.001) {
          const scale = idleSpeed / currentSpeed;
          vel.x *= scale;
          vel.y *= scale;
        } else {
          vel.x = idleSpeed * 0.7;
          vel.y = idleSpeed * 0.7;
        }
      }

      // Always rotate if we have any velocity
      if (currentSpeed >= minVelocity) {
        resetMatrix(tempMatrix);
        tempMatrix.rotateSelf(vel.x * dt, vel.y * dt, 0);
        rotationMatrixRef.current = tempMatrix.multiply(rotationMatrixRef.current);

        const transformValue = rotationMatrixRef.current.toString();
        requestMutation(() => {
          if (cubeRef.current) {
            cubeRef.current.style.transform = transformValue;
          }
        });
      }

      rafIdRef.current = requestAnimationFrame(update);
    };

    rafIdRef.current = requestAnimationFrame(update);
  });

  // ===================
  // Slot Flight Animation
  // ===================
  const flySlotToCube = useLastCallback((index: number) => {
    const slot = slotRefs.current[index];
    const cube = cubeRef.current;
    if (!slot || !cube || !faceTransformsRef.current) return;

    if (animatingSlots.has(index) || usedSlots.has(index)) return;

    const {
      perspective, cubeSize, slotSize, flightSpeed,
      minFlightDuration, maxFlightDuration, faceSelectionTime, flightEasing,
    } = CONFIG;

    // Measure DOM positions in a single read phase
    requestMeasure(() => {
      // Get cube's actual center position
      const cubeRect = cube.getBoundingClientRect();
      const cubeCenter = {
        x: cubeRect.left + cubeRect.width / 2,
        y: cubeRect.top + cubeRect.height / 2,
      };

      const slotRect = slot.getBoundingClientRect();
      const slotCenter = {
        x: slotRect.left + slotRect.width / 2,
        y: slotRect.top + slotRect.height / 2,
      };

      performSlotFlight(
        index, slot, cube, cubeCenter, slotCenter,
        perspective, cubeSize, slotSize, flightSpeed,
        minFlightDuration, maxFlightDuration, faceSelectionTime, flightEasing,
      );
    });
  });

  const performSlotFlight = useLastCallback((
    index: number,
    slot: HTMLDivElement,
    cube: HTMLDivElement,
    cubeCenter: { x: number; y: number },
    slotCenter: { x: number; y: number },
    perspective: number,
    cubeSize: number,
    slotSize: number,
    flightSpeed: number,
    minFlightDuration: number,
    maxFlightDuration: number,
    faceSelectionTime: number,
    flightEasing: string,
  ) => {
    if (!faceTransformsRef.current) return;

    const estimatedDistance = Math.sqrt(
      (cubeCenter.x - slotCenter.x) ** 2 + (cubeCenter.y - slotCenter.y) ** 2,
    );
    const animationDuration = Math.max(
      minFlightDuration,
      Math.min(maxFlightDuration, estimatedDistance / flightSpeed),
    );

    // Predict where cube will be at selection point for face selection
    const predictionTime = animationDuration * faceSelectionTime;
    const predictedRotation = predictRotationMatrix(predictionTime);

    const targetFace = getLargestVisibleFace(predictedRotation, coloredFacesRef.current);
    if (!targetFace) return;

    // Predict where face will be at end of flight
    const futureRotation = predictRotationMatrix(animationDuration);
    const faceWorldTransform = futureRotation.multiply(faceTransformsRef.current[targetFace]);

    const face3dZ = faceWorldTransform.m43;
    const perspectiveScale = perspective / (perspective - face3dZ);
    const faceScreenX = faceWorldTransform.m41 * perspectiveScale;
    const faceScreenY = faceWorldTransform.m42 * perspectiveScale;

    const rotationOnly = DOMMatrix.fromMatrix(faceWorldTransform);
    rotationOnly.m41 = 0;
    rotationOnly.m42 = 0;
    rotationOnly.m43 = 0;

    const targetX = cubeCenter.x + faceScreenX - slotCenter.x;
    const targetY = cubeCenter.y + faceScreenY - slotCenter.y;
    const scaleFactor = (cubeSize / slotSize) * perspectiveScale;

    const finalTransform = new DOMMatrix()
      .translateSelf(targetX, targetY, 0)
      .scaleSelf(scaleFactor)
      .multiplySelf(rotationOnly);

    const zRotation = (Math.atan2(rotationOnly.m12, rotationOnly.m11) * 180) / Math.PI;
    const snappedZ = Math.round(zRotation / 90) * 90;

    // Mark as animating
    setAnimatingSlots((prev) => new Set(prev).add(index));

    // Pre-rotate slot and counter-rotate inner content to avoid visible rotation jump
    const slotInner = slotInnerRefs.current[index];
    const finalTransformStr = finalTransform.toString();

    requestMutation(() => {
      slot.style.transition = 'none';
      slot.style.transform = `rotateZ(${snappedZ}deg)`;
      if (slotInner) {
        slotInner.style.transition = 'none';
        slotInner.style.transform = `rotateZ(${-snappedZ}deg)`;
      }
    });

    // Use rAF to trigger animation
    requestAnimationFrame(() => {
      requestMutation(() => {
        slot.style.transition = `transform ${animationDuration}ms ${flightEasing}`;
        slot.style.transform = finalTransformStr;
        if (slotInner) {
          slotInner.style.transition = `transform ${animationDuration}ms ${flightEasing}`;
          slotInner.style.transform = '';
        }
      });
    });

    // Get face normal for kick
    const faceNormal = transformNormal(FACES_BY_NAME[targetFace].normal, futureRotation, tempNormalRef.current);

    const onTransitionEnd = () => {
      slot.removeEventListener('transitionend', onTransitionEnd);

      requestMutation(() => {
        // Remove backface-visibility from all faces on first slot stick
        if (!backfaceRemovedRef.current) {
          backfaceRemovedRef.current = true;
          Object.values(faceRefs.current).forEach((face) => {
            if (face) {
              face.style.backfaceVisibility = 'visible';
            }
          });
        }

        // Move slot into the cube so it rotates with it
        if (cube && slot) {
          cube.appendChild(slot);
          const faceData = FACES_BY_NAME[targetFace];
          slot.style.transition = 'none';
          slot.style.position = 'absolute';
          slot.style.top = '50%';
          slot.style.left = '50%';
          slot.style.marginTop = `${-slotSize / 2}px`;
          slot.style.marginLeft = `${-slotSize / 2}px`;
          const faceScale = cubeSize / slotSize;
          const [tx, ty, tz] = faceData.translate;
          const [rx, ry, rz] = faceData.rotate;
          slot.style.transform = `translate3d(${tx}px, ${ty}px, ${tz}px) `
            + `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${faceScale})`;
        }
      });

      coloredFacesRef.current.add(targetFace);

      // Check if this is the last slot - apply stronger kick and reduce friction
      const isLastSlot = index === lastSlotIndexRef.current;
      const kickStrength = isLastSlot ? CONFIG.lastKickStrength : CONFIG.squareKickStrength;

      if (isLastSlot) {
        // Reduce friction for faster spinning
        currentFrictionRef.current = CONFIG.lastKickFriction;
      }

      applyKickWithNormal(targetX, targetY, { ...faceNormal }, kickStrength);
      startAnimationLoop();

      setAnimatingSlots((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      setUsedSlots((prev) => new Set(prev).add(index));
    };

    slot.addEventListener('transitionend', onTransitionEnd);
  });

  const handleClose = useLastCallback(() => {
    if (isActivated && !craftResult) return;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }
    closeGiftCraftModal();
  });

  const handleSlotClick = useLastCallback((index: number) => {
    const slotGift = gifts[index];
    if (slotGift) {
      selectGiftForCraft({ slotIndex: index });
    } else {
      openGiftCraftSelectModal({ slotIndex: index });
    }
  });

  const handleCraftClick = useLastCallback(() => {
    // Find all slots with gifts that haven't been used yet
    const giftedIndices = gifts
      .map((g, i) => (g && !usedSlots.has(i) && !animatingSlots.has(i) ? i : -1))
      .filter((i) => i !== -1);

    if (giftedIndices.length === 0) return;

    // Track the last slot index for special handling
    lastSlotIndexRef.current = giftedIndices[giftedIndices.length - 1];

    // Calculate total animation time
    const totalAnimationTime = CONFIG.craftInitialDelay
      + giftedIndices.length * CONFIG.slotFlightInterval + CONFIG.craftActionDelay;

    const totalResultTime = CONFIG.brakingDuration + CONFIG.resultRotationDuration + CONFIG.resultDisplayDuration;
    const endHeavyAnimation = beginHeavyAnimation(totalAnimationTime + totalResultTime);

    // Activate the animation
    activate();

    // Trigger each slot to fly with interval (after initial delay for progress animation)
    giftedIndices.forEach((index, i) => {
      setTimeout(() => {
        flySlotToCube(index);
      }, CONFIG.craftInitialDelay + (i + 1) * CONFIG.slotFlightInterval);
    });

    // Call craft action after all slots have flown
    setTimeout(() => {
      craftStarGift();
    }, totalAnimationTime);

    // End heavy animation after result is shown
    setTimeout(() => {
      endHeavyAnimation();
    }, totalAnimationTime + totalResultTime);
  });

  // Handle craft result
  useEffect(() => {
    if (!craftResult) return;

    // Start braking - increase friction to slow down
    currentFrictionRef.current = CONFIG.brakingFriction;

    if (craftResult.success) {
      // Find a free face for the crafted gift
      const allFaces: FaceName[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];
      const freeFace = allFaces.find((f) => !coloredFacesRef.current.has(f)) || 'front';

      // Set the crafted gift on that face
      setCraftedGiftFace({ face: freeFace, gift: craftResult.gift });

      // Let it spin with braking for a while, then rotate to result
      setTimeout(() => {
        startRotation();
        decelerateToFace(freeFace, () => {
          markResultRotationComplete();
        });
      }, CONFIG.brakingDuration);

      // After braking + rotation + display duration, close and show result
      setTimeout(() => {
        closeGiftCraftModal();
        requestConfetti({ withStars: true });
        openGiftInfoModal({ gift: craftResult.gift });
      }, CONFIG.brakingDuration + CONFIG.resultRotationDuration + CONFIG.resultDisplayDuration);
    } else {
      // Fail case - show broken gift animation
      const allFaces: FaceName[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];
      const freeFace = allFaces.find((f) => !coloredFacesRef.current.has(f)) || 'front';

      // Count burned gifts
      const burnedCount = gifts.filter(Boolean).length;
      const isError = !craftResult.success && craftResult.isError;

      // Set the failed face
      setFailedFace({ face: freeFace, burnedCount, isError: isError || undefined });

      // Let it spin with braking for a while, then rotate to failed face
      setTimeout(() => {
        startRotation();
        decelerateToFace(freeFace, () => {
          markResultRotationComplete();
        });
      }, CONFIG.brakingDuration);
    }
  }, [craftResult, gifts, closeGiftCraftModal, requestConfetti, openGiftInfoModal, decelerateToFace]);

  const hasSelectedGifts = useMemo(
    () => gifts.some((g, i) => g && !usedSlots.has(i)),
    [gifts, usedSlots],
  );

  const allAttributes = useMemo(
    () => [...attributeStats.backdrops, ...attributeStats.patterns],
    [attributeStats.backdrops, attributeStats.patterns],
  );

  const [renderingAttributes, setRenderingAttributes] = useState(allAttributes);

  useEffect(() => {
    if (allAttributes === renderingAttributes) return;

    const getAttrKey = (a: { attr: ApiStarGiftAttributeBackdrop | ApiStarGiftAttributePattern }) => (
      a.attr.type === 'backdrop' ? `b-${a.attr.backdropId}` : `p-${a.attr.sticker.id}`
    );

    const prevKeys = renderingAttributes.map(getAttrKey);
    const newKeys = allAttributes.map(getAttrKey);
    const hasOrderChanged = prevKeys.length !== newKeys.length
      || prevKeys.some((key, i) => key !== newKeys[i]);

    if (hasOrderChanged) {
      startViewTransition(VTT_CRAFT_ATTRIBUTES, () => {
        setRenderingAttributes(allAttributes);
      });
    } else {
      setRenderingAttributes(allAttributes);
    }
  }, [allAttributes, renderingAttributes, startViewTransition]);

  const burnedGifts = useMemo(
    () => gifts.filter((g): g is ApiStarGiftUnique => Boolean(g)),
    [gifts],
  );

  const handleRemoveGift = useLastCallback((index: number) => {
    setRemovingSlots(new Set(removingSlots).add(index));

    setTimeout(() => {
      selectGiftForCraft({ slotIndex: index });
      const newSlots = new Set(removingSlots);
      newSlots.delete(index);
      setRemovingSlots(newSlots);
    }, CONFIG.slotRemoveDuration);
  });

  const slotRefCallbacks = useMemo(() => [0, 1, 2, 3].map((i) => (el: HTMLDivElement | undefined) => {
    slotRefs.current[i] = el;
  }), []);

  const slotInnerRefCallbacks = useMemo(() => [0, 1, 2, 3].map((i) => (el: HTMLDivElement | undefined) => {
    slotInnerRefs.current[i] = el;
  }), []);

  function renderCraftSlot(index: number) {
    return (
      <CraftSlot
        key={`${slotsKey}-${index}`}
        index={index}
        gift={gifts[index]}
        isUsed={usedSlots.has(index)}
        isAnimating={animatingSlots.has(index)}
        isActivated={isActivated}
        isRemoving={removingSlots.has(index)}
        slotRef={slotRefCallbacks[index]}
        slotInnerRef={slotInnerRefCallbacks[index]}
        onSlotClick={handleSlotClick}
        onRemoveGift={handleRemoveGift}
      />
    );
  }

  function renderFaceContent(faceName: FaceName) {
    // Check if this face has the crafted gift (success)
    if (craftedGiftFace?.face === faceName) {
      const giftAttributes = getGiftAttributes(craftedGiftFace.gift);
      if (giftAttributes?.backdrop) {
        return (
          <div className={styles.craftedGiftFace}>
            <RadialPatternBackground
              className={styles.craftedGiftBackdrop}
              backgroundColors={[giftAttributes.backdrop.centerColor, giftAttributes.backdrop.edgeColor]}
              patternIcon={giftAttributes.pattern?.sticker}
              ringsCount={1}
              ovalFactor={1}
              patternSize={12}
            />
            <AnimatedIconFromSticker
              className={styles.craftedGiftSticker}
              sticker={giftAttributes.model?.sticker}
              size={STICKER_SIZE * 1.2}
            />
          </div>
        );
      }
    }

    // Check if this face shows the failed result
    if (failedFace?.face === faceName) {
      return (
        <div className={styles.failedGiftFace}>
          <RadialProgress className={styles.progressRing} progress={0} />
          <AnimatedIconWithPreview
            tgsUrl={LOCAL_TGS_URLS.BrokenGift}
            previewUrl={LOCAL_TGS_PREVIEW_URLS.BrokenGift}
            size={STICKER_SIZE}
            noLoop
          />
          {!failedFace.isError && (
            <span className={styles.burnedCount}>{failedFace.burnedCount}</span>
          )}
        </div>
      );
    }

    // Show progress animation on front face during crafting
    if (faceName === 'front' && isActivated && !craftedGiftFace && !failedFace) {
      return (
        <AnimatedIcon
          tgsUrl={LOCAL_TGS_URLS.CraftProgress}
          play
          noLoop={false}
          size={50}
          forceAlways
        />
      );
    }

    return <Icon name="craft" className={styles.faceIcon} />;
  }

  function render3DCube() {
    return (
      <div ref={cubeRef} className={styles.cube}>
        <div className={styles.corners}>
          <div className={styles.corner} />
          <div className={styles.corner} />
          <div className={styles.corner} />
          <div className={styles.corner} />
          <div className={styles.corner} />
          <div className={styles.corner} />
          <div className={styles.corner} />
          <div className={styles.corner} />
        </div>
        {FACES_DATA.map((face) => {
          const resultFace = craftedGiftFace?.face || failedFace?.face;
          const shouldHide = isRotationStarted && resultFace !== face.name;
          const isFailed = failedFace?.face === face.name;
          return (
            <div
              key={face.name}
              ref={(el) => { faceRefs.current[face.name] = el || undefined; }}
              className={buildClassName(
                styles.face,
                shouldHide && styles.faceHidden,
                isFailed && styles.faceFailed,
                progressPercent > HIGH_CHANCE_THRESHOLD && styles.faceHighChance,
              )}
              data-face={face.name}
            >
              {renderFaceContent(face.name)}
            </div>
          );
        })}
      </div>
    );
  }

  function renderCenterAnvil() {
    return (
      <div
        className={buildClassName(styles.centerAnvil,
          progressPercent > HIGH_CHANCE_THRESHOLD
          && styles.centerAnvilHighChance)}
      >
        <RadialProgress className={styles.progressRing} progress={progressPercent} />
        <Icon name="craft" className={styles.anvilIcon} />
        <AnimatedCounter className={styles.percentage} text={formatPercent(progressPercent, 0)} />
      </div>
    );
  }

  function renderHeader() {
    return (
      <div className={styles.header}>
        <div className={buildClassName(styles.slotsGrid, isActivated && styles.activated)}>
          {renderCraftSlot(0)}
          {renderCraftSlot(1)}
          {isActivated ? (
            <div className={styles.cubeWrapper}>
              {render3DCube()}
            </div>
          ) : (
            renderCenterAnvil()
          )}
          {renderCraftSlot(2)}
          {renderCraftSlot(3)}
        </div>
      </div>
    );
  }

  function renderAttributeDial(
    attr: ApiStarGiftAttributeBackdrop | ApiStarGiftAttributePattern,
    permille: number,
  ) {
    const percent = permille / 10;
    const percentText = formatPercent(percent, 0);
    const attrKey = attr.type === 'backdrop' ? `backdrop-${attr.backdropId}` : `pattern-${attr.sticker.id}`;

    return (
      <div
        key={attrKey}
        className={styles.attributeCircle}
        style={createVtnStyle(attrKey, 'craftAttribute')}
      >
        <div className={styles.attributeContent}>
          <RadialProgress className={styles.attributeRing} progress={percent} size={ATTRIBUTE_DIAL_SIZE} />
          {attr.type === 'backdrop' ? (
            <div
              className={styles.colorAttribute}
              style={`background: linear-gradient(135deg, ${attr.centerColor} 0%, ${attr.edgeColor} 100%)`}
            />
          ) : (
            <PatternAttributePreview sticker={attr.sticker} />
          )}
        </div>
        <AnimatedCounter className={styles.attributePercent} text={percentText} />
      </div>
    );
  }

  function renderInfo() {
    return (
      <div className={styles.infoSection}>
        <p className={styles.infoDescription}>
          {lang('GiftCraftDescription', {
            giftLine: (
              <span className={styles.giftLine}>
                {titleGiftSticker && (
                  <AnimatedIconFromSticker
                    className={styles.giftIcon}
                    sticker={titleGiftSticker}
                    size={REM}
                  />
                )}
                <strong>{fullGiftTitle}</strong>
              </span>
            ),
          },
          {
            withNodes: true,
            renderTextFilters: ['br'],
            withMarkdown: true,
          },
          )}
        </p>
        <p className={styles.infoWarning}>
          {lang('GiftCraftWarning', undefined, {
            withNodes: true,
            renderTextFilters: ['br'],
            withMarkdown: true,
          })}
        </p>
        {previewModelStickers && previewModelStickers.length > 0 && (
          <Button
            size="tiny"
            color="transparentBlured"
            pill
            fluid
            className={styles.viewAllButton}
            onClick={handleViewAllVariants}
          >
            {previewModelStickers.map((sticker) => (
              <CustomEmoji
                key={sticker.id}
                sticker={sticker}
                noPlay
              />
            ))}
            <span className={styles.viewAllText}>
              {lang('GiftCraftViewAll', undefined, {
                withNodes: true,
                specialReplacement: getNextArrowReplacement(),
              })}
            </span>
          </Button>
        )}
        {renderingAttributes.length > 0 && (
          <div className={styles.attributeCircles}>
            {renderingAttributes.map(({ attr, permille }) => renderAttributeDial(attr, permille))}
          </div>
        )}
      </div>
    );
  }

  function renderCraftingInfo() {
    return (
      <div className={styles.craftingSection}>
        <h4 className={styles.craftingTitle}>{lang('GiftCraftingTitle')}</h4>
        <p className={styles.craftingGiftName}>{fullGiftTitle}</p>
        <p className={styles.craftingWarning}>
          {lang('GiftCraftWarning', undefined, {
            withNodes: true,
            renderTextFilters: ['br'],
            withMarkdown: true,
          })}
        </p>
      </div>
    );
  }

  function renderFailedInfo() {
    if (failedFace?.isError) {
      return (
        <div className={styles.failedSection}>
          <p className={styles.failedTitle}>
            {lang('SomethingWentWrong')}
          </p>
        </div>
      );
    }

    const burnedCount = burnedGifts.length;

    return (
      <div className={styles.failedSection}>
        <h4 className={styles.failedTitle}>{lang('GiftCraftFailedTitle')}</h4>
        <p className={styles.failedDescription}>
          {lang('GiftCraftFailedDescription', { count: burnedCount }, {
            pluralValue: burnedCount,
            withNodes: true,
            renderTextFilters: ['br'],
            withMarkdown: true,
          })}
        </p>
        <div className={styles.burnedGifts}>
          {burnedGifts.map((gift) => {
            const giftAttributes = getGiftAttributes(gift);
            if (!giftAttributes) return undefined;
            return (
              <div key={gift.id} className={styles.burnedGift}>
                <div className={styles.burnedGiftInner}>
                  <RadialPatternBackground
                    className={styles.burnedGiftBackdrop}
                    backgroundColors={[
                      giftAttributes.backdrop!.centerColor,
                      giftAttributes.backdrop!.edgeColor,
                    ]}
                    patternIcon={giftAttributes.pattern!.sticker}
                    ringsCount={1}
                    ovalFactor={1}
                    patternSize={8}
                  />
                  <AnimatedIconFromSticker
                    className={styles.burnedGiftSticker}
                    sticker={giftAttributes.model?.sticker}
                    size={STICKER_SIZE * 0.8}
                  />
                </div>
                <GiftRibbon
                  className={styles.burnedGiftBadge}
                  textClassName={styles.burnedGiftBadgeText}
                  color="red"
                  size={40}
                  text={`#${gift.number}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderInfoContent() {
    let activeKey = 0;
    let content;

    if (failedFace) {
      activeKey = 2;
      content = renderFailedInfo();
    } else if (isActivated) {
      activeKey = 1;
      content = renderCraftingInfo();
    } else {
      activeKey = 0;
      content = renderInfo();
    }

    return (
      <Transition
        className={styles.infoTransition}
        name="fade"
        activeKey={activeKey}
      >
        {content}
      </Transition>
    );
  }

  const handleRetryClick = useLastCallback(() => {
    resetGiftCraftResult();
    resetAnimationState();
    setSlotsKey((k) => k + 1);
  });

  function renderCraftButton() {
    const isFailed = Boolean(failedFace);
    const shouldRenderHighChanceButton = hasSelectedGifts && !isActivated && !isFailed
      && progressPercent > HIGH_CHANCE_THRESHOLD;
    const buttonText = isFailed
      ? lang('GiftCraftNewGift')
      : lang('GiftCraftButton', { giftName: fullGiftTitle });

    let activeKey = 0;
    if (isFailed) activeKey = 2;
    else if (isActivated) activeKey = 3;
    else if (hasSelectedGifts) activeKey = 1;

    return (
      <div className={styles.footer}>
        <Button
          className={buildClassName(
            styles.craftButton,
            isActivated && !isFailed && styles.craftButtonCrafting,
            shouldRenderHighChanceButton && styles.craftButtonHighChance,
          )}
          size="smaller"
          color={isFailed ? 'danger' : undefined}
          disabled={!isFailed && (!hasSelectedGifts || isActivated)}
          onClick={isFailed ? handleRetryClick : handleCraftClick}
        >
          <Transition name="fade" activeKey={activeKey}>
            {(isActivated && !isFailed) ? (
              <span className={styles.craftButtonTitle}>
                {lang('GiftCraftSuccessChance', { percent: formatPercent(progressPercent, 0) })}
              </span>
            ) : (
              <div className={styles.craftButtonContent}>
                <span className={styles.craftButtonTitle}>{buttonText}</span>
                {!isFailed && (
                  <span className={styles.craftButtonSubtitle}>
                    {hasSelectedGifts
                      ? lang('GiftCraftSuccessChance', { percent: formatPercent(progressPercent, 0) })
                      : lang(
                        'GiftCraftEmptyHint',
                        { button: <Icon name="add-filled" className={styles.emptyHintIcon} /> },
                        { withNodes: true },
                      )}
                  </span>
                )}
              </div>
            )}
          </Transition>
        </Button>
      </div>
    );
  }

  const handleHelpClick = useLastCallback(() => {
    if (!lastMainGift || (isActivated && !craftResult)) return;
    openGiftCraftInfoModal({ gift: lastMainGift });
  });

  const handleViewAllVariants = useLastCallback(() => {
    if (!lastMainGift) return;
    openGiftPreviewModal({ originGift: lastMainGift, shouldShowCraftableOnStart: true });
  });

  const helpButton = useMemo(() => (
    <Button
      className={styles.helpButton}
      round
      color="translucent-white"
      size="tiny"
      ariaLabel={lang('GiftCraftHelp')}
      onClick={handleHelpClick}
    >
      <Icon name="help" />
    </Button>
  ), [lang, handleHelpClick]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className={styles.modal}
      contentClassName={styles.content}
      hasAbsoluteCloseButton
      headerRightToolBar={helpButton}
      isSlim
      isLowStackPriority
      absoluteCloseButtonColor="translucent-white"
    >
      <h3 className={styles.title}>{lang('GiftCraftTitle')}</h3>
      <Transition
        className={styles.patternOverlay}
        slideClassName={styles.patternSlide}
        name="fade"
        activeKey={failedFace ? 1 : (progressPercent > HIGH_CHANCE_THRESHOLD ? 2 : 0)}
      >
        <RadialPatternBackground
          className={styles.patternBackground}
          patternUrl={craftPatternUrl}
          backgroundColors={
            failedFace
              ? GRADIENT_COLORS_FAILED
              : (progressPercent > HIGH_CHANCE_THRESHOLD ? GRADIENT_COLORS_HIGH_CHANCE : GRADIENT_COLORS_DEFAULT)
          }
          patternColor={failedFace ? '#311A15' : (progressPercent > HIGH_CHANCE_THRESHOLD ? '#142A2C' : '#242F42')}
          yPosition={9.5 * REM}
          maxRadius={0.3}
          patternSize={22}
          ovalFactor={1.2}
          ringsCount={2}
        />
      </Transition>
      {renderHeader()}
      {renderInfoContent()}
      {renderCraftButton()}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      craftAttributePermilles: global.appConfig?.stargiftsCraftAttributePermilles,
    };
  },
)(GiftCraftModal));
