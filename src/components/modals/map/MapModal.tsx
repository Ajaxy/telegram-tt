import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiGeoPoint } from '../../../api/types';

import { prepareMapUrl } from '../../../util/map';
import { IS_IOS, IS_MAC_OS } from '../../../util/windowEnvironment';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './MapModal.module.scss';

export type OwnProps = {
  geoPoint?: ApiGeoPoint;
  zoom?: number;
};

const OpenMapModal = ({ geoPoint, zoom }: OwnProps) => {
  const { closeMapModal } = getActions();

  const lang = useLang();

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
          Open Street Maps
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
