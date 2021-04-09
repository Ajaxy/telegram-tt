import React, {
  FC, memo, useEffect, useCallback,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { SettingsScreens, UPLOADING_WALLPAPER_SLUG } from '../../../types';
import { ApiWallpaper } from '../../../api/types';

import { pick } from '../../../util/iteratees';
import { throttle } from '../../../util/schedulers';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import useLang from '../../../hooks/useLang';

import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import Loading from '../../ui/Loading';
import WallpaperTile from './WallpaperTile';

import './SettingsGeneralBackground.scss';

type OwnProps = {
  onScreenSelect: (screen: SettingsScreens) => void;
};

type StateProps = {
  customBackground?: string;
  isBackgroundBlurred?: boolean;
  loadedWallpapers?: ApiWallpaper[];
};

type DispatchProps = Pick<GlobalActions, 'setSettingOption' | 'loadWallpapers' | 'uploadWallpaper'>;

const SUPPORTED_TYPES = 'image/jpeg';

const runThrottled = throttle((cb) => cb(), 60000, true);

const SettingsGeneralBackground: FC<OwnProps & StateProps & DispatchProps> = ({
  onScreenSelect,
  customBackground,
  isBackgroundBlurred,
  loadedWallpapers,
  setSettingOption,
  loadWallpapers,
  uploadWallpaper,
}) => {
  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadWallpapers();
    });
  }, [loadWallpapers]);

  const handleFileSelect = useCallback((e: Event) => {
    const { files } = e.target as HTMLInputElement;

    if (files && files.length > 0) {
      uploadWallpaper(files[0]);
    }
  }, [uploadWallpaper]);

  const handleUploadWallpaper = useCallback(() => {
    openSystemFilesDialog(SUPPORTED_TYPES, handleFileSelect, true);
  }, [handleFileSelect]);

  const handleSetColor = useCallback(() => {
    onScreenSelect(SettingsScreens.GeneralChatBackgroundColor);
  }, [onScreenSelect]);

  const handleResetToDefault = useCallback(() => {
    setSettingOption({ customBackground: undefined });
  }, [setSettingOption]);

  const handleWallPaperSelect = useCallback((slug: string) => {
    setSettingOption({ customBackground: slug });
  }, [setSettingOption]);

  const handleWallPaperBlurChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSettingOption({ isBackgroundBlurred: e.target.checked });
  }, [setSettingOption]);

  const lang = useLang();

  const isUploading = loadedWallpapers && loadedWallpapers[0] && loadedWallpapers[0].slug === UPLOADING_WALLPAPER_SLUG;

  return (
    <div className="SettingsGeneralBackground settings-content custom-scroll">
      <div className="settings-item pt-3">
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
          checked={Boolean(isBackgroundBlurred)}
          onChange={handleWallPaperBlurChange}
        />
      </div>

      {loadedWallpapers ? (
        <div className="settings-wallpapers">
          {loadedWallpapers.map((wallpaper) => (
            <WallpaperTile
              wallpaper={wallpaper}
              isSelected={customBackground === wallpaper.slug}
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
  (global): StateProps => {
    const { isBackgroundBlurred, customBackground } = global.settings.byKey;
    const { loadedWallpapers } = global.settings;

    return {
      customBackground,
      isBackgroundBlurred,
      loadedWallpapers,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'setSettingOption', 'loadWallpapers', 'uploadWallpaper',
  ]),
)(SettingsGeneralBackground));
