import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiWallpaper } from '../../../api/types';
import type { ThemeKey } from '../../../types';
import { SettingsScreens, UPLOADING_WALLPAPER_SLUG } from '../../../types';

import { DARK_THEME_PATTERN_COLOR, DEFAULT_PATTERN_COLOR } from '../../../config';
import { selectTheme, selectThemeValues } from '../../../global/selectors';
import { getAverageColor, getPatternColor, rgb2hex } from '../../../util/colors';
import { validateFiles } from '../../../util/files';
import { throttle } from '../../../util/schedulers';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import WallpaperTile from './WallpaperTile';

import './SettingsGeneralBackground.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  background?: string;
  isBlurred?: boolean;
  loadedWallpapers?: ApiWallpaper[];
  theme: ThemeKey;
};

const SUPPORTED_TYPES = 'image/jpeg';

const runThrottled = throttle((cb) => cb(), 60000, true);

const SettingsGeneralBackground: FC<OwnProps & StateProps> = ({
  isActive,
  onReset,
  background,
  isBlurred,
  loadedWallpapers,
  theme,
}) => {
  const {
    loadWallpapers,
    uploadWallpaper,
    setThemeSettings,
    openSettingsScreen,
  } = getActions();

  const themeRef = useRef<ThemeKey>();
  themeRef.current = theme;
  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadWallpapers();
    });
  }, [loadWallpapers]);

  const handleFileSelect = useCallback((e: Event) => {
    const { files } = e.target as HTMLInputElement;

    const validatedFiles = validateFiles(files);
    if (validatedFiles?.length) {
      uploadWallpaper(validatedFiles[0]);
    }
  }, [uploadWallpaper]);

  const handleUploadWallpaper = useCallback(() => {
    openSystemFilesDialog(SUPPORTED_TYPES, handleFileSelect, true);
  }, [handleFileSelect]);

  const handleSetColor = useCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.GeneralChatBackgroundColor });
  }, []);

  const handleResetToDefault = useCallback(() => {
    setThemeSettings({
      theme,
      background: undefined,
      backgroundColor: undefined,
      isBlurred: true,
      patternColor: theme === 'dark' ? DARK_THEME_PATTERN_COLOR : DEFAULT_PATTERN_COLOR,
    });
  }, [setThemeSettings, theme]);

  const handleWallPaperSelect = useCallback((slug: string) => {
    setThemeSettings({ theme: themeRef.current!, background: slug });
    const currentWallpaper = loadedWallpapers && loadedWallpapers.find((wallpaper) => wallpaper.slug === slug);
    if (currentWallpaper?.document.thumbnail) {
      getAverageColor(currentWallpaper.document.thumbnail.dataUri)
        .then((averageColor) => {
          setThemeSettings({
            theme: themeRef.current!,
            backgroundColor: rgb2hex(averageColor),
            patternColor: getPatternColor(averageColor),
          });
        });
    }
  }, [loadedWallpapers, setThemeSettings]);

  const handleWallPaperBlurChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setThemeSettings({ theme: themeRef.current!, isBlurred: e.target.checked });
  }, [setThemeSettings]);

  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const isUploading = loadedWallpapers?.[0] && loadedWallpapers[0].slug === UPLOADING_WALLPAPER_SLUG;

  return (
    <div className="SettingsGeneralBackground settings-content custom-scroll">
      <div className="settings-item">
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

        <ListItem icon="favorite" onClick={handleResetToDefault}>
          {lang('ThemeResetToDefaults')}
        </ListItem>

        <Checkbox
          label={lang('BackgroundBlurred')}
          checked={Boolean(isBlurred)}
          onChange={handleWallPaperBlurChange}
        />
      </div>

      {loadedWallpapers ? (
        <div className="settings-wallpapers">
          {loadedWallpapers.map((wallpaper) => (
            <WallpaperTile
              key={wallpaper.slug}
              wallpaper={wallpaper}
              theme={theme}
              isSelected={background === wallpaper.slug}
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
    const { background, isBlurred } = selectThemeValues(global, theme) || {};
    const { loadedWallpapers } = global.settings;

    return {
      background,
      isBlurred,
      loadedWallpapers,
      theme,
    };
  },
)(SettingsGeneralBackground));
