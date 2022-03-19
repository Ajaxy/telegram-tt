import React, { FC, memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { SettingsScreens, ISettings } from '../../../types';

import { AUTODOWNLOAD_FILESIZE_MB_LIMITS } from '../../../config';
import { pick } from '../../../util/iteratees';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import Checkbox from '../../ui/Checkbox';
import RangeSlider from '../../ui/RangeSlider';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = Pick<ISettings, (
  'canAutoLoadPhotoFromContacts' |
  'canAutoLoadPhotoInPrivateChats' |
  'canAutoLoadPhotoInGroups' |
  'canAutoLoadPhotoInChannels' |
  'canAutoLoadVideoFromContacts' |
  'canAutoLoadVideoInPrivateChats' |
  'canAutoLoadVideoInGroups' |
  'canAutoLoadVideoInChannels' |
  'canAutoLoadFileFromContacts' |
  'canAutoLoadFileInPrivateChats' |
  'canAutoLoadFileInGroups' |
  'canAutoLoadFileInChannels' |
  'canAutoPlayGifs' |
  'canAutoPlayVideos' |
  'autoLoadFileMaxSizeMb'
)>;

const SettingsDataStorage: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  canAutoLoadPhotoFromContacts,
  canAutoLoadPhotoInPrivateChats,
  canAutoLoadPhotoInGroups,
  canAutoLoadPhotoInChannels,
  canAutoLoadVideoFromContacts,
  canAutoLoadVideoInPrivateChats,
  canAutoLoadVideoInGroups,
  canAutoLoadVideoInChannels,
  canAutoLoadFileFromContacts,
  canAutoLoadFileInPrivateChats,
  canAutoLoadFileInGroups,
  canAutoLoadFileInChannels,
  canAutoPlayGifs,
  canAutoPlayVideos,
  autoLoadFileMaxSizeMb,
}) => {
  const { setSettingOption } = getActions();

  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.General);

  const renderFileSizeCallback = useCallback((value: number) => {
    return lang('AutodownloadSizeLimitUpTo', lang('FileSize.MB', String(AUTODOWNLOAD_FILESIZE_MB_LIMITS[value]), 'i'));
  }, [lang]);

  const handleFileSizeChange = useCallback((value: number) => {
    setSettingOption({ autoLoadFileMaxSizeMb: AUTODOWNLOAD_FILESIZE_MB_LIMITS[value] });
  }, [setSettingOption]);

  function renderContentSizeSlider() {
    const value = AUTODOWNLOAD_FILESIZE_MB_LIMITS.indexOf(autoLoadFileMaxSizeMb);

    return (
      <div className="pt-5">
        <RangeSlider
          label={lang('AutoDownloadMaxFileSize')}
          min={0}
          max={5}
          value={value !== -1 ? value : 2}
          renderValue={renderFileSizeCallback}
          onChange={handleFileSizeChange}
        />
      </div>
    );
  }

  function renderAutoDownloadBlock(
    title: string,
    key: 'Photo' | 'Video' | 'File',
    canAutoLoadFromContacts: boolean,
    canAutoLoadInPrivateChats: boolean,
    canAutoLoadInGroups: boolean,
    canAutoLoadInChannels: boolean,
  ) {
    return (
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{title}</h4>

        <Checkbox
          label={lang('AutoDownloadSettings.Contacts')}
          checked={canAutoLoadFromContacts}
          onCheck={(isChecked) => setSettingOption({ [`canAutoLoad${key}FromContacts`]: isChecked })}
        />
        <Checkbox
          label={lang('AutoDownloadSettings.PrivateChats')}
          checked={canAutoLoadInPrivateChats}
          onCheck={(isChecked) => setSettingOption({ [`canAutoLoad${key}InPrivateChats`]: isChecked })}
        />
        <Checkbox
          label={lang('AutoDownloadSettings.GroupChats')}
          checked={canAutoLoadInGroups}
          onCheck={(isChecked) => setSettingOption({ [`canAutoLoad${key}InGroups`]: isChecked })}
        />
        <Checkbox
          label={lang('AutoDownloadSettings.Channels')}
          checked={canAutoLoadInChannels}
          onCheck={(isChecked) => setSettingOption({ [`canAutoLoad${key}InChannels`]: isChecked })}
        />

        {key === 'File' && renderContentSizeSlider()}
      </div>
    );
  }

  return (
    <div className="settings-content custom-scroll">
      {renderAutoDownloadBlock(
        lang('AutoDownloadPhotosTitle'),
        'Photo',
        canAutoLoadPhotoFromContacts,
        canAutoLoadPhotoInPrivateChats,
        canAutoLoadPhotoInGroups,
        canAutoLoadPhotoInChannels,
      )}
      {renderAutoDownloadBlock(
        lang('AutoDownloadVideosTitle'),
        'Video',
        canAutoLoadVideoFromContacts,
        canAutoLoadVideoInPrivateChats,
        canAutoLoadVideoInGroups,
        canAutoLoadVideoInChannels,
      )}
      {renderAutoDownloadBlock(
        'Auto-download files', // Proper translation is not available yet
        'File',
        canAutoLoadFileFromContacts,
        canAutoLoadFileInPrivateChats,
        canAutoLoadFileInGroups,
        canAutoLoadFileInChannels,
      )}

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('AutoplayMedia')}</h4>

        <Checkbox
          label={lang('GifsTab2')}
          checked={canAutoPlayGifs}
          onCheck={(isChecked) => setSettingOption({ canAutoPlayGifs: isChecked })}
        />
        <Checkbox
          label={lang('DataAndStorage.Autoplay.Videos')}
          checked={canAutoPlayVideos}
          onCheck={(isChecked) => setSettingOption({ canAutoPlayVideos: isChecked })}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return pick(global.settings.byKey, [
      'canAutoLoadPhotoFromContacts',
      'canAutoLoadPhotoInPrivateChats',
      'canAutoLoadPhotoInGroups',
      'canAutoLoadPhotoInChannels',
      'canAutoLoadVideoFromContacts',
      'canAutoLoadVideoInPrivateChats',
      'canAutoLoadVideoInGroups',
      'canAutoLoadVideoInChannels',
      'canAutoLoadFileFromContacts',
      'canAutoLoadFileInPrivateChats',
      'canAutoLoadFileInGroups',
      'canAutoLoadFileInChannels',
      'canAutoPlayGifs',
      'canAutoPlayVideos',
      'autoLoadFileMaxSizeMb',
    ]);
  },
)(SettingsDataStorage));
