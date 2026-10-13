import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { RegularLangKey } from '../../../types/language';
import type { StorageCategory, StorageUsage } from '../../../util/storageUsage';

import buildClassName from '../../../util/buildClassName';
import { purgeClearableCache } from '../../../util/cacheApi';
import { calculateStorageUsage, clearStorageCategory } from '../../../util/storageUsage';
import { formatFileSize } from '../../../util/textFormat';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Island, { IslandTitle } from '../../gili/layout/Island';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Spinner from '../../ui/Spinner';

import styles from './SettingsStorageUsage.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: NoneToVoidFunction;
};

const CATEGORY_LABELS: Record<StorageCategory, RegularLangKey> = {
  photos: 'StorageUsagePhotos',
  videos: 'StorageUsageVideos',
  audio: 'StorageUsageAudio',
  stickers: 'StorageUsageStickers',
  files: 'StorageUsageFiles',
  avatars: 'StorageUsageAvatars',
  other: 'StorageUsageOther',
};

const CATEGORY_COLORS: Record<StorageCategory, string> = {
  photos: '#3390ec',
  videos: '#8e6cf6',
  audio: '#f0557a',
  stickers: '#ffb300',
  files: '#34c759',
  avatars: '#2faeff',
  other: '#a2acb4',
};

const DONUT_SIZE = 180;
const DONUT_STROKE = 18;
const DONUT_GAP = 2;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const SettingsStorageUsage = ({ isActive, onReset }: OwnProps) => {
  const { showNotification } = getActions();
  const lang = useLang();

  const [usage, setUsage] = useState<StorageUsage | undefined>();
  const [scannedCount, setScannedCount] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [clearingCategory, setClearingCategory] = useState<StorageCategory | 'all' | undefined>();

  useHistoryBack({ isActive, onBack: onReset });

  const recalculate = useLastCallback(async () => {
    setIsCalculating(true);
    setScannedCount(0);
    const result = await calculateStorageUsage(setScannedCount);
    setUsage(result);
    setIsCalculating(false);
  });

  useEffect(() => {
    if (isActive && !usage && !isCalculating) {
      void recalculate();
    }
  }, [isActive, usage, isCalculating]);

  const handleClearCategory = useLastCallback(async (category: StorageCategory) => {
    setClearingCategory(category);
    await clearStorageCategory(category);
    setClearingCategory(undefined);
    showNotification({ message: { key: 'SettingsDataClearMediaDone' } });
    void recalculate();
  });

  const handleClearAll = useLastCallback(async () => {
    setClearingCategory('all');
    await purgeClearableCache();
    setClearingCategory(undefined);
    showNotification({ message: { key: 'SettingsDataClearMediaDone' } });
    void recalculate();
  });

  const segments = useMemo(() => {
    if (!usage?.totalSize) return [];
    let offset = 0;
    return usage.categories.map(({ category, size }) => {
      const length = (size / usage.totalSize) * DONUT_CIRCUMFERENCE;
      const segment = {
        category,
        length: Math.max(0, length - DONUT_GAP),
        offset,
      };
      offset += length;
      return segment;
    });
  }, [usage]);

  const devicePercent = usage?.deviceUsage && usage.deviceQuota
    ? Math.min(100, (usage.deviceUsage / usage.deviceQuota) * 100)
    : undefined;

  return (
    <div className="settings-content custom-scroll">
      <div className={styles.hero}>
        <div className={styles.donut}>
          <svg viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} className={styles.donutSvg}>
            <circle
              className={styles.donutTrack}
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              stroke-width={DONUT_STROKE}
            />
            {segments.map(({ category, length, offset }) => (
              <circle
                key={category}
                className={styles.donutSegment}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                stroke={CATEGORY_COLORS[category]}
                stroke-width={DONUT_STROKE}
                stroke-dasharray={`${length} ${DONUT_CIRCUMFERENCE - length}`}
                stroke-dashoffset={-offset}
              />
            ))}
          </svg>
          <div className={styles.donutCenter}>
            {isCalculating ? (
              <>
                <Spinner color="blue" />
                <div className={styles.donutCaption}>
                  {lang('StorageUsageScanning', { count: scannedCount }, { pluralValue: scannedCount })}
                </div>
              </>
            ) : (
              <>
                <div className={styles.donutValue}>{formatFileSize(lang, usage?.totalSize || 0)}</div>
                <div className={styles.donutCaption}>{lang('StorageUsageMediaCache')}</div>
              </>
            )}
          </div>
        </div>
        <p className={styles.description}>{lang('StorageUsageDescription')}</p>
      </div>

      {devicePercent !== undefined && (
        <>
          <IslandTitle>{lang('StorageUsageDevice')}</IslandTitle>
          <Island>
            <div className={styles.device}>
              <div className={styles.deviceRow}>
                <span>{lang('StorageUsageDeviceUsed', { size: formatFileSize(lang, usage!.deviceUsage!) })}</span>
                <span className={styles.deviceQuota}>{formatFileSize(lang, usage!.deviceQuota!)}</span>
              </div>
              <div className={styles.deviceTrack}>
                <div className={styles.deviceFill} style={`width: ${Math.max(1, devicePercent)}%`} />
              </div>
            </div>
          </Island>
        </>
      )}

      <IslandTitle>{lang('StorageUsageByType')}</IslandTitle>
      <Island>
        {usage && !usage.categories.length && !isCalculating && (
          <div className={styles.empty}>{lang('StorageUsageEmpty')}</div>
        )}
        {usage?.categories.map(({ category, size, count }) => (
          <div key={category} className={styles.row}>
            <span className={styles.dot} style={`background: ${CATEGORY_COLORS[category]}`} />
            <div className={styles.rowBody}>
              <div className={styles.rowTitle}>{lang(CATEGORY_LABELS[category])}</div>
              <div className={styles.rowSubtitle}>
                {lang('StorageUsageItems', { count }, { pluralValue: count })}
              </div>
            </div>
            <div className={styles.rowSize}>{formatFileSize(lang, size)}</div>
            <Button
              round
              size="tiny"
              color="translucent"
              className={buildClassName(styles.rowClear, clearingCategory === category && styles.rowClearBusy)}
              ariaLabel={lang('StorageUsageClear')}
              disabled={Boolean(clearingCategory)}
              onClick={() => handleClearCategory(category)}
            >
              <Icon name="delete" />
            </Button>
          </div>
        ))}
      </Island>

      <Island>
        <ListItem
          icon="delete"
          destructive
          disabled={Boolean(clearingCategory) || isCalculating || !usage?.totalSize}
          onClick={handleClearAll}
        >
          {lang('SettingsDataClearMediaCache')}
        </ListItem>
      </Island>
    </div>
  );
};

export default memo(SettingsStorageUsage);
