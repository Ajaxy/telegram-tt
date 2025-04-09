import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ISettings } from '../../../types';

import { AUTODOWNLOAD_FILESIZE_MB_LIMITS } from '../../../config';
import { pick } from '../../../util/iteratees';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import Checkbox from '../../ui/Checkbox';
import RangeSlider from '../../ui/RangeSlider';

type OwnProps = {
  isActive?: boolean;
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
  'autoLoadFileMaxSizeMb'
)>;

const SettingsDataStorage: FC<OwnProps & StateProps> = ({
  isActive,
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
  autoLoadFileMaxSizeMb,
}) => {
  const { setSettingOption } = getActions();

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const renderFileSizeCallback = useCallback((value: number) => {
    return lang('AutodownloadSizeLimitUpTo', {
      limit: lang('FileSizeMB', { count: AUTODOWNLOAD_FILESIZE_MB_LIMITS[value] }),
    });
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
          label={lang('AutoDownloadSettingsContacts')}
          checked={canAutoLoadFromContacts}
          // TODO rewrite to support `useCallback`
          // eslint-disable-next-line react/jsx-no-bind
          onCheck={(isChecked) => setSettingOption({ [`canAutoLoad${key}FromContacts`]: isChecked })}
        />
        <Checkbox
          label={lang('AutoDownloadSettingsPrivateChats')}
          checked={canAutoLoadInPrivateChats}
          // eslint-disable-next-line react/jsx-no-bind
          onCheck={(isChecked) => setSettingOption({ [`canAutoLoad${key}InPrivateChats`]: isChecked })}
        />
        <Checkbox
          label={lang('AutoDownloadSettingsGroupChats')}
          checked={canAutoLoadInGroups}
          // eslint-disable-next-line react/jsx-no-bind
          onCheck={(isChecked) => setSettingOption({ [`canAutoLoad${key}InGroups`]: isChecked })}
        />
        <Checkbox
          label={lang('AutoDownloadSettingsChannels')}
          checked={canAutoLoadInChannels}
          // eslint-disable-next-line react/jsx-no-bind
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
        lang('AutoDownloadFilesTitle'),
        'File',
        canAutoLoadFileFromContacts,
        canAutoLoadFileInPrivateChats,
        canAutoLoadFileInGroups,
        canAutoLoadFileInChannels,
      )}
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
      'autoLoadFileMaxSizeMb',
    ]);
  },
)(SettingsDataStorage));
