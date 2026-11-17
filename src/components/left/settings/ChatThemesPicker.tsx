import { memo, useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChatTheme } from '../../../api/types';
import type { ThemeKey } from '../../../types';

import { DARK_THEME_BG_COLOR } from '../../../config';
import {
  selectAnimatedEmoji, selectCanAnimateInterface, selectCanPlayAnimatedEmojis, selectTheme, selectThemeValues,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import generateUniqueId from '../../../util/generateUniqueId';
import { buildOwnBubbleGradientCss, buildThemePalette } from '../../../util/theme';
import { buildThemeSettingsFromWallpaper, buildWallpaperRenderModel, getChatThemeEntry } from '../../../util/wallpaper';
import renderText from '../../common/helpers/renderText';

import useSelector from '../../../hooks/data/useSelector';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import useGradientBackground from '../../../hooks/useGradientBackground';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import Icon from '../../common/icons/Icon';

import styles from './ChatThemesPicker.module.scss';

const MIN_FREEFORM_COLOR_COUNT = 3;
const EMOJI_SIZE = 64;
const EMOJI_PLAY_DELAY = 100;
// A full-length segment rewinds even when the previous playback is still running
const EMOJI_PLAY_SEGMENT: [number, number] = [0, Infinity];

type StateProps = {
  chatThemes?: ApiChatTheme[];
  theme: ThemeKey;
  selectedEmoticon?: string;
};

const ChatThemesPicker = ({ chatThemes, theme, selectedEmoticon }: StateProps) => {
  const { loadChatThemes, applyChatTheme } = getActions();

  const containerRef = useRef<HTMLDivElement>();
  const isDark = theme === 'dark';

  const lang = useLang();

  // The picker sits inside the vertically scrolling settings panel, so wheel events must not reach it
  useHorizontalScroll(containerRef, undefined, true);

  useEffect(() => {
    loadChatThemes();
  }, []);

  const handleSelect = useLastCallback((emoticon?: string) => {
    applyChatTheme({ emoticon });
  });

  const handleDefaultSelect = useLastCallback(() => {
    if (selectedEmoticon) handleSelect(undefined);
  });

  return (
    <div ref={containerRef} className={buildClassName(styles.root, 'no-scrollbar')} dir="auto">
      <button
        type="button"
        className={buildClassName(styles.tile, !selectedEmoticon && styles.selected)}
        aria-label={lang('ThemeResetToDefaults')}
        aria-pressed={!selectedEmoticon}
        onClick={handleDefaultSelect}
      >
        <div className={styles.preview}>
          <Icon name="close" className={styles.defaultIcon} />
        </div>
      </button>

      {chatThemes?.map((chatTheme) => (
        <ChatThemeTile
          key={chatTheme.emoticon}
          chatTheme={chatTheme}
          isDark={isDark}
          isSelected={selectedEmoticon === chatTheme.emoticon}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
};

type OwnProps = {
  chatTheme: ApiChatTheme;
  isDark: boolean;
  isSelected: boolean;
  onSelect: (emoticon: string) => void;
};

const ChatThemeTile = memo(({
  chatTheme, isDark, isSelected, onSelect,
}: OwnProps) => {
  const sticker = useSelector((global) => selectAnimatedEmoji(global, chatTheme.emoticon));
  const canPlayAnimatedEmojis = useSelector(selectCanPlayAnimatedEmojis);
  const canAnimateInterface = useSelector(selectCanAnimateInterface);
  const [playKey, setPlayKey] = useState<string>();
  const [isEmojiEnlarged, enlargeEmoji, shrinkEmoji] = useFlag();

  useEffectWithPrevDeps(([wasSelected]) => {
    if (!isSelected) shrinkEmoji();
    if (wasSelected !== false || !isSelected || !canPlayAnimatedEmojis || !sticker) return undefined;

    const timeout = setTimeout(() => {
      setPlayKey(generateUniqueId());
      enlargeEmoji();
    }, EMOJI_PLAY_DELAY);
    return () => clearTimeout(timeout);
  }, [isSelected, canPlayAnimatedEmojis, sticker, enlargeEmoji, shrinkEmoji]);

  const entry = getChatThemeEntry(chatTheme.settings, isDark);
  const wallpaper = entry?.wallpaper;
  const model = wallpaper
    && buildWallpaperRenderModel(isDark ? 'dark' : 'light', buildThemeSettingsFromWallpaper(wallpaper));
  const wallpaperColors = model?.colors || [];
  const hasWallpaperGradient = wallpaperColors.length > 1;
  const wallpaperCanvasRef = useGradientBackground(
    hasWallpaperGradient ? wallpaperColors : undefined, undefined, true, wallpaper?.settings?.rotation,
  );

  const isPattern = Boolean(wallpaper?.isPattern && wallpaper.document);
  const intensity = model?.patternIntensity;
  const patternDimming = model?.patternDimming;
  const isMaskedPattern = model?.isMaskedPattern;
  const patternMediaHash = isPattern ? `wallpaper${wallpaper!.document!.id!}?size=m` : undefined;
  const patternMaskUrl = useMedia(patternMediaHash);

  const messageColors = buildThemePalette(isDark ? 'dark' : 'light', entry);
  const outgoingColors = messageColors?.outgoingColors;
  const hasFreeformGradient = Boolean(outgoingColors && outgoingColors.length >= MIN_FREEFORM_COLOR_COUNT);
  const outgoingCanvasRef = useGradientBackground(hasFreeformGradient ? outgoingColors : undefined, undefined, true);
  const outgoingGradient = outgoingColors && !hasFreeformGradient
    ? buildOwnBubbleGradientCss(outgoingColors)
    : undefined;
  const incomingColor = messageColors.incomingColor;

  const handleClick = useLastCallback(() => {
    if (!isSelected) onSelect(chatTheme.emoticon);
  });
  const handleEmojiEnded = useLastCallback(() => {
    setPlayKey(undefined);
    shrinkEmoji();
  });

  return (
    <button
      type="button"
      className={buildClassName(styles.tile, isSelected && styles.selected)}
      aria-label={chatTheme.emoticon}
      aria-pressed={isSelected}
      onClick={handleClick}
    >
      <div
        className={styles.preview}
        style={buildStyle(
          isMaskedPattern && `background-color: ${DARK_THEME_BG_COLOR}`,
          patternDimming !== undefined && `--pattern-dimming: ${patternDimming}`,
        )}
      >
        <div
          className={buildClassName(styles.wallpaper, isMaskedPattern && styles.masked)}
          style={buildStyle(
            wallpaperColors[0] && `background-color: ${wallpaperColors[0]}`,
            patternMaskUrl && `--pattern-mask: url(${patternMaskUrl})`,
            intensity !== undefined && `--pattern-intensity: ${Math.abs(intensity) / 100}`,
            isMaskedPattern && !patternMaskUrl && 'opacity: 0',
          )}
        >
          {hasWallpaperGradient && <canvas ref={wallpaperCanvasRef} className={styles.gradient} />}
        </div>
        {isPattern && !isMaskedPattern && patternMaskUrl && (
          <div
            className={buildClassName(styles.pattern, wallpaperColors.length === 1 && styles.plainPattern)}
            style={buildStyle(
              `--pattern-mask: url(${patternMaskUrl})`,
              intensity !== undefined && `--pattern-intensity: ${Math.abs(intensity) / 100}`,
            )}
          />
        )}
        {patternDimming !== undefined && <div className={styles.patternDimming} />}
        <span
          className={buildClassName(styles.bubble, styles.bubbleOut)}
          style={buildStyle(
            messageColors?.outgoingColor && `background-color: ${messageColors.outgoingColor}`,
            outgoingGradient && `background-image: ${outgoingGradient}`,
          )}
        >
          {hasFreeformGradient && <canvas ref={outgoingCanvasRef} className={styles.gradient} />}
        </span>
        <span
          className={buildClassName(styles.bubble, styles.bubbleIn)}
          style={`background-color: ${incomingColor}`}
        />
        <div className={buildClassName(
          styles.emoji,
          isSelected && isEmojiEnlarged && canPlayAnimatedEmojis && canAnimateInterface && styles.emojiPlaying,
        )}
        >
          {sticker ? (
            <AnimatedIconFromSticker
              sticker={sticker}
              size={EMOJI_SIZE}
              play={canPlayAnimatedEmojis ? playKey || false : false}
              playSegment={EMOJI_PLAY_SEGMENT}
              nonInteractive
              onEnded={handleEmojiEnded}
            />
          ) : renderText(chatTheme.emoticon)}
        </div>
      </div>
    </button>
  );
});

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const theme = selectTheme(global);
    const { chatThemeEmoticon } = selectThemeValues(global, theme) || {};

    return {
      chatThemes: global.settings.chatThemes,
      theme,
      selectedEmoticon: chatThemeEmoticon,
    };
  },
)(ChatThemesPicker));
