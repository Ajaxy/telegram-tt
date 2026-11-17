import {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiWallpaper } from '../../../api/types';
import type { IThemeSettings, ThemeKey } from '../../../types';
import { SettingsScreens } from '../../../types';

import {
  selectChatWallpaperSettings, selectIsWallpaperUploading, selectReferencedWallpaperBackgrounds, selectTheme,
  selectThemeValues,
} from '../../../global/selectors';
import { buildHexFromColor, getAverageColor, getPatternColor } from '../../../util/colors';
import { throttle } from '../../../util/schedulers';
import { openWallpaperFileDialog, resetWallpaper } from '../../../util/settingsActions';
import {
  buildThemeSettingsFromWallpaper, buildWallpaperRenderModel, DEFAULT_PATTERN_INTENSITY_FACTOR,
  getDefaultPatternColor, getWallpaperColors, getWallpaperKey,
  isRenderableWallpaper, isWallpaperSelected, RESET_WALLPAPER_SETTINGS,
} from '../../../util/wallpaper';
import { removeWallpaperBlobIfUnused } from '../../../util/wallpaper/storage';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Island, { IslandTitle } from '../../gili/layout/Island';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import RangeSlider from '../../ui/RangeSlider';
import WallpaperTile from './WallpaperTile';

import './SettingsGeneralBackground.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  themeSettings?: IThemeSettings;
  isBlurred?: boolean;
  loadedWallpapers?: ApiWallpaper[];
  isUploading?: boolean;
  theme: ThemeKey;
};

const MIN_CATALOGUE_PATTERN_COLORS = 3;

const runThrottled = throttle((cb) => cb(), 60000, true);

const SettingsGeneralBackground = ({
  isActive,
  onReset,
  themeSettings,
  isBlurred,
  loadedWallpapers,
  isUploading,
  theme,
}: OwnProps & StateProps) => {
  const {
    loadWallpapers,
    setThemeSettings,
    openSettingsScreen,
  } = getActions();

  const themeRef = useRef<ThemeKey>();
  const requestedWallpaperRef = useRef<ApiWallpaper>();
  themeRef.current = theme;
  // The persistent parent `Transition` requires throttling the API call across updates
  useEffect(() => {
    runThrottled(() => {
      loadWallpapers();
    });
  }, [loadWallpapers]);

  const handleUploadWallpaper = useLastCallback(() => {
    requestedWallpaperRef.current = undefined;
    openWallpaperFileDialog();
  });

  const handleSetColor = useLastCallback(() => {
    requestedWallpaperRef.current = undefined;
    openSettingsScreen({ screen: SettingsScreens.GeneralChatBackgroundColor });
  });

  const handleResetToDefault = useLastCallback(() => {
    requestedWallpaperRef.current = undefined;
    resetWallpaper();
  });

  const getActiveWallpaperBackgrounds = useLastCallback(() => {
    const global = getGlobal();
    const selectedBackgrounds = selectReferencedWallpaperBackgrounds(global);
    const requestedBackground = requestedWallpaperRef.current?.slug;

    return requestedBackground
      ? [...selectedBackgrounds, requestedBackground]
      : selectedBackgrounds;
  });

  const handleWallPaperSelect = useLastCallback((wallpaper: ApiWallpaper) => {
    const requestedWallpaper = requestedWallpaperRef.current;
    if (!requestedWallpaper || getWallpaperKey(requestedWallpaper) !== getWallpaperKey(wallpaper)) {
      removeWallpaperBlobIfUnused(wallpaper.slug, getActiveWallpaperBackgrounds);
      return;
    }
    requestedWallpaperRef.current = undefined;

    const currentTheme = themeRef.current!;

    // Colors, gradients and patterns carry settings while photo wallpapers derive a thumbnail color
    if (wallpaper.document && !wallpaper.isPattern) {
      // Reset every wallpaper field first, so a photo without a thumbnail (its color is derived
      // asynchronously) doesn't inherit the previous wallpaper's base color, chip tint or pattern intensity
      setThemeSettings({
        theme: currentTheme,
        ...RESET_WALLPAPER_SETTINGS,
        background: wallpaper.slug,
        patternColor: getDefaultPatternColor(currentTheme),
        // The wallpaper's own blur wins when it carries one; otherwise (e.g. uploads — the `blur`
        // flag is either `true` or absent) the user's current choice stays
        isBlurred: wallpaper.settings?.isBlurred ?? selectThemeValues(getGlobal(), currentTheme)?.isBlurred,
      });

      if (wallpaper.document.thumbnail) {
        getAverageColor(wallpaper.document.thumbnail.dataUri)
          .then((averageColor) => {
            // Bail if the user picked a different wallpaper while the average color was computing,
            // so we don't overwrite the new theme's `backgroundColor`/`patternColor`
            if (selectThemeValues(getGlobal(), currentTheme)?.background !== wallpaper.slug) return;

            setThemeSettings({
              theme: currentTheme,
              backgroundColor: buildHexFromColor(averageColor),
              patternColor: getPatternColor(averageColor),
            });
          })
          // The wallpaper fields are already reset, so a failed sampling just keeps theme defaults
          .catch(() => undefined);
      }
      return;
    }

    setThemeSettings({ theme: currentTheme, ...buildThemeSettingsFromWallpaper(wallpaper) });
  });

  const handleWallpaperRequest = useLastCallback((wallpaper: ApiWallpaper) => {
    requestedWallpaperRef.current = wallpaper;
  });

  const handleWallPaperBlurChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setThemeSettings({ theme: themeRef.current!, isBlurred: e.target.checked });
  });

  const handlePatternIntensityChange = useLastCallback((value: number) => {
    setThemeSettings({ theme: themeRef.current!, patternIntensityFactor: value });
  });

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  // Blur only applies to a file-backed image (uploaded or server photo), so disable it for colors,
  // gradients and patterns — matching WebK
  const isImageBackground = Boolean(themeSettings?.background) && !themeSettings?.isPattern;
  // The intensity slider only applies to pattern wallpapers (custom or the built-in default)
  const isPatternBackground = buildWallpaperRenderModel(theme, themeSettings || {}).isPattern;
  const patternIntensityFactor = themeSettings?.patternIntensityFactor ?? DEFAULT_PATTERN_INTENSITY_FACTOR;

  // Keep the server order (the user's own wallpapers come first), skipping unrenderable
  // patterns and dropping duplicates that appear in both the personal list and the default set
  const visibleWallpapers = useMemo(() => {
    if (!loadedWallpapers) return undefined;

    const seenKeys = new Set<string>();
    return loadedWallpapers.filter((wallpaper) => {
      const colors = getWallpaperColors(wallpaper.settings);

      // Unflagged (neither `creator` nor `default`) patterns are the auto-installed standard
      // light/dark backgrounds — our built-in default, applied via "Reset to Defaults", covers
      // them. A pattern the user installed from the catalogue keeps its flagged twin visible.
      if (wallpaper.isPattern && !wallpaper.isCreator && !wallpaper.isDefault) return false;
      // Pale default patterns belong to chat themes rather than the general background picker
      if (wallpaper.isDefault && wallpaper.isPattern && colors.length < MIN_CATALOGUE_PATTERN_COLORS) {
        return false;
      }
      if (!isRenderableWallpaper(wallpaper)) return false;

      const key = getWallpaperKey(wallpaper);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }, [loadedWallpapers]);

  return (
    <div className="SettingsGeneralBackground settings-content custom-scroll">
      <Island>
        <ListItem
          icon="camera-add"
          className="mb-0"
          disabled={isUploading}
          onClick={handleUploadWallpaper}
        >
          {lang('UploadImage')}
        </ListItem>

        <ListItem
          icon="colorize"
          className="mb-0"
          onClick={handleSetColor}
        >
          {lang('SetColor')}
        </ListItem>

        <ListItem icon="star-regular" onClick={handleResetToDefault}>
          {lang('ThemeResetToDefaults')}
        </ListItem>

        <Checkbox
          label={lang('BackgroundBlurred')}
          checked={isImageBackground && Boolean(isBlurred)}
          disabled={!isImageBackground}
          onChange={handleWallPaperBlurChange}
        />

        <RangeSlider
          label={lang('BackgroundPatternIntensity')}
          value={patternIntensityFactor}
          disabled={!isPatternBackground}
          onChange={handlePatternIntensityChange}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('ChatBackgroundColorThemes')}</IslandTitle>

      {visibleWallpapers ? (
        <div className="settings-wallpapers">
          {visibleWallpapers.map((wallpaper) => (
            <WallpaperTile
              key={getWallpaperKey(wallpaper)}
              wallpaper={wallpaper}
              theme={theme}
              isSelected={isWallpaperSelected(wallpaper, themeSettings)}
              onRequest={handleWallpaperRequest}
              onClick={handleWallPaperSelect}
            />
          ))}
        </div>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const theme = selectTheme(global);
    const themeSettings = selectChatWallpaperSettings(global);
    const { loadedWallpapers } = global.settings;

    return {
      themeSettings,
      isBlurred: themeSettings?.isBlurred,
      loadedWallpapers,
      isUploading: selectIsWallpaperUploading(global),
      theme,
    };
  },
)(SettingsGeneralBackground));
