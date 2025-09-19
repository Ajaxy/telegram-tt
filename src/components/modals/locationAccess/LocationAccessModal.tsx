import type { FC } from '../../../lib/teact/teact';
import {
  memo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { selectUser } from '../../../global/selectors';
import { getGeolocationStatus } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './LocationAccessModal.module.scss';

export type OwnProps = {
  modal: TabState['locationAccessModal'];
};

export type StateProps = {
  currentUser?: ApiUser;
};

const LocationAccessModal: FC<OwnProps & StateProps> = ({
  modal,
  currentUser,
}) => {
  const {
    closeLocationAccessModal, toggleUserLocationPermission, sendWebAppEvent,
  } = getActions();

  const isOpen = Boolean(modal);

  const oldLang = useOldLang();
  const lang = useLang();

  const containerRef = useRef<HTMLDivElement>();

  const confirmHandler = useLastCallback(async () => {
    const geolocationData = await getGeolocationStatus();
    const { geolocation } = geolocationData;
    if (!modal?.bot?.id) return;
    closeLocationAccessModal();
    if (modal?.webAppKey) {
      toggleUserLocationPermission({
        botId: modal.bot.id,
        isAccessGranted: true,
      });
      sendWebAppEvent({
        webAppKey: modal.webAppKey,
        event: {
          eventType: 'location_requested',
          eventData: {
            available: true,
            latitude: geolocation?.latitude,
            longitude: geolocation?.longitude,
            altitude: geolocation?.altitude,
            course: geolocation?.heading,
            speed: geolocation?.speed,
            horizontal_accuracy: geolocation?.accuracy,
            vertical_accuracy: geolocation?.accuracy,
          },
        },
      });
    }
  });

  const onCloseHandler = useLastCallback(() => {
    if (!modal?.bot?.id) return;
    closeLocationAccessModal();
    if (modal?.webAppKey) {
      toggleUserLocationPermission({
        botId: modal.bot.id,
        isAccessGranted: false,
      });
      sendWebAppEvent({
        webAppKey: modal.webAppKey,
        event: {
          eventType: 'location_requested',
          eventData: {
            available: false,
          },
        },
      });
    }
  });

  const renderInfo = useLastCallback(() => {
    if (!modal?.bot) return undefined;
    return (
      <div className={styles.avatars}>
        <Avatar
          size="large"
          peer={currentUser}
        />
        <Icon name="next" className={styles.arrow} />
        <Avatar
          size="large"
          peer={modal.bot}
        />
      </div>
    );
  });

  const renderStatusText = useLastCallback(() => {
    if (!modal?.bot) return undefined;
    return lang('LocationPermissionText', {
      name: getUserFullName(modal?.bot),
    }, {
      withNodes: true,
      withMarkdown: true,
    });
  });

  return (
    <Modal
      className={buildClassName('confirm')}
      isOpen={isOpen}
      onClose={onCloseHandler}
    >
      {renderInfo()}
      <div>
        {renderStatusText()}
        <div
          className="dialog-buttons mt-2"
          ref={containerRef}
        >
          <Button
            className="confirm-dialog-button"
            isText
            onClick={confirmHandler}
            color="primary"
          >
            {oldLang('lng_bot_allow_write_confirm')}
          </Button>
          <Button
            className="confirm-dialog-button"
            isText
            onClick={onCloseHandler}
          >
            {lang('Cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const currentUser = selectUser(global, global.currentUserId!);

    return {
      currentUser,
    };
  },
)(LocationAccessModal));
