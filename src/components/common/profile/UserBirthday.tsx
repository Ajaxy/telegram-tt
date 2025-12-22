import {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import {
  type ApiBirthday, ApiMediaFormat, type ApiStickerSet, type ApiUser,
} from '../../../api/types';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { getStickerMediaHash } from '../../../global/helpers';
import { selectIsPremiumPurchaseBlocked } from '../../../global/selectors';
import { IS_OFFSET_PATH_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { formatDateToString } from '../../../util/dates/dateFormat';
import { buildCollectionByKey } from '../../../util/iteratees';
import * as mediaLoader from '../../../util/mediaLoader';
import renderText from '../helpers/renderText';

import useTimeout from '../../../hooks/schedulers/useTimeout';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ListItem from '../../ui/ListItem';
import StickerView from '../StickerView';

import styles from './UserBirthday.module.scss';

const NUMBER_EMOJI_SUFFIX = '\uFE0F\u20E3';
const NUMBER_STICKER_SIZE = 128;
const EFFECT_EMOJIS = ['🎉', '🎆', '🎈'];
const EFFECT_SIZE = 288;
const ANIMATION_DURATION = 3000;

type OwnProps = {
  user: ApiUser;
  birthday: ApiBirthday;
  isInSettings?: boolean;
};

type StateProps = {
  isPremiumPurchaseBlocked?: boolean;
  birthdayNumbers?: ApiStickerSet;
  animatedEmojiEffects?: ApiStickerSet;
};

const UserBirthday = ({
  user,
  birthday,
  isPremiumPurchaseBlocked,
  birthdayNumbers,
  animatedEmojiEffects,
  isInSettings,
}: OwnProps & StateProps) => {
  const { openGiftModal, requestConfetti } = getActions();
  const ref = useRef<HTMLDivElement>();
  const animationPlayedRef = useRef(false);
  const [isPlayingAnimation, playAnimation, stopAnimation] = useFlag();

  const lang = useLang();

  const {
    formattedDate,
    isToday,
    age,
  } = useMemo(() => {
    const today = new Date();
    const date = new Date(
      birthday.year || 2024, // Use leap year as fallback
      birthday.month - 1,
      birthday.day,
    );

    const formatted = formatDateToString(date, lang.code, true, 'long');
    const isBirthdayToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
    return {
      formattedDate: formatted,
      isToday: isBirthdayToday,
      age: birthday.year && getAge(date),
    };
  }, [birthday, lang]);

  const numbersForAge = useMemo(() => {
    if (!age || !isToday) return undefined;
    const numbers = birthdayNumbers?.stickers?.filter(({ emoji }) => emoji?.endsWith(NUMBER_EMOJI_SUFFIX));
    if (!numbers) return undefined;
    const byEmoji = buildCollectionByKey(numbers, 'emoji');

    const ageDigits = age.toString().split('');
    return ageDigits.map((digit) => byEmoji[digit + NUMBER_EMOJI_SUFFIX]);
  }, [age, birthdayNumbers?.stickers, isToday]);

  const effectSticker = useMemo(() => {
    if (!isToday) return undefined;
    const randomEffect = EFFECT_EMOJIS[Math.floor(Math.random() * EFFECT_EMOJIS.length)];
    return animatedEmojiEffects?.stickers?.find(({ emoji }) => emoji === randomEffect);
  }, [animatedEmojiEffects?.stickers, isToday]);

  // Preload stickers
  useEffect(() => {
    if (!isToday || !numbersForAge) return;

    numbersForAge.forEach((sticker) => {
      const hash = getStickerMediaHash(sticker, 'preview');
      mediaLoader.fetch(hash, ApiMediaFormat.BlobUrl);
    });

    if (effectSticker) {
      const effectHash = getStickerMediaHash(effectSticker, 'preview');
      mediaLoader.fetch(effectHash, ApiMediaFormat.BlobUrl);
    }
  }, [effectSticker, isToday, numbersForAge]);

  useTimeout(stopAnimation, isPlayingAnimation ? ANIMATION_DURATION : undefined);

  useEffect(() => {
    if (isPlayingAnimation) {
      animationPlayedRef.current = true;

      const column = document.getElementById(isInSettings ? 'LeftColumn' : 'RightColumn');
      if (!column) return;

      requestMeasure(() => {
        const {
          top, left, width, height,
        } = column.getBoundingClientRect();

        requestConfetti({
          top,
          left,
          width,
          height,
          style: 'top-down',
        });
      });
    }
  }, [isInSettings, isPlayingAnimation]);

  const value = useMemo(() => {
    if (age) {
      return lang(
        `ProfileBirthday${isToday ? 'Today' : ''}ValueYear`,
        { date: formattedDate, age },
        { pluralValue: age },
      );
    }

    return lang(`ProfileBirthday${isToday ? 'Today' : ''}Value`, { date: formattedDate });
  }, [age, formattedDate, isToday, lang]);

  const canGiftPremium = isToday && !user.isPremium && !user.isSelf && !isPremiumPurchaseBlocked;

  const handleOpenGiftModal = useLastCallback(() => {
    openGiftModal({ forUserId: user.id });
  });

  const handleClick = useLastCallback(() => {
    if (!isToday) return;

    if (canGiftPremium && animationPlayedRef.current) {
      handleOpenGiftModal();
      return;
    }

    playAnimation();
  });

  const isStatic = !isToday && !canGiftPremium;

  return (
    <div className={styles.root}>
      <ListItem
        icon="calendar"
        secondaryIcon={canGiftPremium ? 'gift' : undefined}
        secondaryIconClassName={styles.giftIcon}
        multiline
        narrow
        ref={ref}
        ripple={!isStatic}
        onClick={handleClick}
        isStatic={isStatic}
        onSecondaryIconClick={handleOpenGiftModal}
      >
        <div className="title" dir={lang.isRtl ? 'rtl' : undefined}>
          {renderText(value)}
        </div>
        <span className="subtitle">{lang(isToday ? 'ProfileBirthdayToday' : 'ProfileBirthday')}</span>
      </ListItem>
      {isPlayingAnimation && IS_OFFSET_PATH_SUPPORTED && numbersForAge?.map((sticker, index) => (
        <div
          className={buildClassName(styles.number, index > 0 && styles.shiftOrigin)}
          style={`--digit-offset: ${index}`}
        >
          <StickerView
            containerRef={ref}
            sticker={sticker}
            size={NUMBER_STICKER_SIZE}
            forceAlways
          />
        </div>
      ))}
      {isPlayingAnimation && effectSticker && (
        <div className={styles.effect}>
          <StickerView
            containerRef={ref}
            sticker={effectSticker}
            size={EFFECT_SIZE}
            shouldLoop
            forceAlways
          />
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { birthdayNumbers, animatedEmojiEffects } = global;
    return {
      birthdayNumbers,
      animatedEmojiEffects,
      isPremiumPurchaseBlocked: selectIsPremiumPurchaseBlocked(global),
    };
  },
)(UserBirthday));

// https://stackoverflow.com/a/7091965
function getAge(birthdate: Date) {
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const m = today.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
    age--;
  }

  return age;
}
