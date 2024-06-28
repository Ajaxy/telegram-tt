import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';

import { prepareMapUrl } from '../../../util/map';
import { IS_IOS, IS_MAC_OS } from '../../../util/windowEnvironment';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './MapModal.module.scss';

export type OwnProps = {
  modal: TabState['mapModal'];
};

const OpenMapModal = ({ modal }: OwnProps) => {
  const { closeMapModal } = getActions();

  const { point: geoPoint, zoom } = modal || {};

  const lang = useOldLang();

  const isOpen = Boolean(geoPoint);

  const handleClose = useLastCallback(() => {
    closeMapModal();
  });

  const [googleUrl, bingUrl, appleUrl, osmUrl] = useMemo(() => {
    if (!geoPoint) {
      return [];
    }

    const google = prepareMapUrl('google', geoPoint, zoom);
    const bing = prepareMapUrl('bing', geoPoint, zoom);
    const osm = prepareMapUrl('osm', geoPoint, zoom);
    const apple = prepareMapUrl('apple', geoPoint, zoom);

    return [google, bing, apple, osm];
  }, [geoPoint, zoom]);

  const openUrl = useLastCallback((url: string) => {
    closeMapModal();
    window.open(url, '_blank', 'noopener');
  });

  const handleGoogleClick = useLastCallback(() => {
    openUrl(googleUrl!);
  });

  const handleBingClick = useLastCallback(() => {
    openUrl(bingUrl!);
  });

  const handleAppleClick = useLastCallback(() => {
    openUrl(appleUrl!);
  });

  const handleOsmClick = useLastCallback(() => {
    openUrl(osmUrl!);
  });

  return (
    <Modal
      contentClassName={styles.root}
      title={lang('OpenMapWith')}
      isOpen={isOpen}
      onClose={handleClose}
      isSlim
    >
      <div className={styles.buttons}>
        {(IS_IOS || IS_MAC_OS) && (
          <Button fluid size="smaller" onClick={handleAppleClick}>
            Apple Maps
          </Button>
        )}
        <Button fluid size="smaller" onClick={handleGoogleClick}>
          Google Maps
        </Button>
        <Button fluid size="smaller" onClick={handleBingClick}>
          Bing Maps
        </Button>
        <Button fluid size="smaller" onClick={handleOsmClick}>
          OpenStreetMap
        </Button>
      </div>
      <div className="dialog-buttons mt-2">
        <Button className="confirm-dialog-button" isText onClick={handleClose}>
          {lang('Cancel')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(OpenMapModal);
