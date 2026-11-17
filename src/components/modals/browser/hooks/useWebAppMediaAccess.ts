import { useEffect, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiUser } from '../../../../api/types';
import type { BotAppPermissions } from '../../../../types';
import type { RegularLangKey } from '../../../../types/language';
import type {
  WebApp,
  WebAppInboundEvent,
  WebAppMediaAccessState,
  WebAppMediaAccessStatus,
  WebAppMediaKind,
  WebAppOutboundEvent,
} from '../../../../types/webapp';

import { getWebAppKey } from '../../../../global/helpers/bots';
import { buildWebAppAllowAttribute, getWebAppOrigin, WEB_APP_MEDIA_KINDS } from '../../../../util/browser/iframe';

import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';
import useForceUpdate from '../../../../hooks/useForceUpdate';
import useLastCallback from '../../../../hooks/useLastCallback';

const DEVICE_KINDS: Record<WebAppMediaKind, MediaDeviceKind> = {
  camera: 'videoinput',
  microphone: 'audioinput',
};

// The iframe `allow` attribute is the only real protection: the browser applies it on the next navigation of the
// frame, so access granted while the Mini App is open needs a reload, and revoked access needs a forced one
function getRevokedNotificationKey(kinds: WebAppMediaKind[]): RegularLangKey {
  if (kinds.length > 1) return 'WebAppMediaAccessRevoked';
  return kinds[0] === 'camera' ? 'WebAppCameraAccessRevoked' : 'WebAppMicrophoneAccessRevoked';
}

function useWebAppMediaAccess(
  sendEvent: (event: WebAppOutboundEvent) => void,
  forceReloadFrame: (url: string) => void,
  webApp?: WebApp,
  bot?: ApiUser,
  permissions?: BotAppPermissions,
  isModalOpen?: boolean,
) {
  const { openMediaAccessModal, showNotification } = getActions();

  // Permissions from the `allow` attribute the current frame document was loaded with
  const appliedPermissionsRef = useRef(permissions);
  const unavailableKindsRef = useRef<WebAppMediaKind[]>([]);
  const isRequestPendingRef = useRef(false);
  const forceUpdate = useForceUpdate();

  const isReloadRequired = getIsReloadRequired();
  const allowAttribute = buildWebAppAllowAttribute(
    permissions, webApp?.isSameOrigin ? getWebAppOrigin(webApp.url) : undefined,
  );

  useEffect(() => {
    const { mediaDevices } = navigator;
    if (!mediaDevices) {
      unavailableKindsRef.current = WEB_APP_MEDIA_KINDS;
      return undefined;
    }

    const updateUnavailableKinds = () => {
      mediaDevices.enumerateDevices().then((devices) => {
        // An empty list means the browser hides devices, not that there are none
        unavailableKindsRef.current = devices.length
          ? WEB_APP_MEDIA_KINDS.filter((kind) => !devices.some((device) => device.kind === DEVICE_KINDS[kind]))
          : [];
      });
    };

    updateUnavailableKinds();
    mediaDevices.addEventListener('devicechange', updateUnavailableKinds);
    return () => mediaDevices.removeEventListener('devicechange', updateUnavailableKinds);
  }, []);

  const markPermissionsApplied = useLastCallback(() => {
    appliedPermissionsRef.current = permissions;
    forceUpdate();
  });

  const buildAccessState = useLastCallback((): WebAppMediaAccessState => ({
    camera: getStatus('camera'),
    microphone: getStatus('microphone'),
    reload_required: getIsReloadRequired(),
  }));

  const sendRequestResult = useLastCallback(() => {
    sendEvent({ eventType: 'media_access_requested', eventData: buildAccessState() });
  });

  const handleMediaAccessEvent = useLastCallback((event: WebAppInboundEvent) => {
    // Sent by the SDK before the check of every new document
    if (event.eventType === 'iframe_ready') {
      markPermissionsApplied();
    }

    if (event.eventType === 'web_app_check_media_access') {
      sendEvent({ eventType: 'media_access_checked', eventData: { supported: true, ...buildAccessState() } });
    }

    if (event.eventType === 'web_app_request_media_access') {
      const kinds = WEB_APP_MEDIA_KINDS.filter(
        (kind) => event.eventData?.[kind] && getStatus(kind) === 'not_requested',
      );
      if (isRequestPendingRef.current || !kinds.length || !webApp || !bot) {
        sendRequestResult();
        return;
      }

      isRequestPendingRef.current = true;
      openMediaAccessModal({ bot, webAppKey: getWebAppKey(webApp), kinds });
    }
  });

  const handleAccessUpdate = useLastCallback((
    prevCamera?: boolean, prevMicrophone?: boolean, prevIsModalOpen?: boolean,
  ) => {
    if (isRequestPendingRef.current) {
      if (prevIsModalOpen && !isModalOpen) {
        isRequestPendingRef.current = false;
        sendRequestResult();
      }
      return;
    }

    if (!webApp || (prevCamera === permissions?.camera && prevMicrophone === permissions?.microphone)) return;

    const revokedKinds = WEB_APP_MEDIA_KINDS.filter(
      (kind) => appliedPermissionsRef.current?.[kind] && !permissions?.[kind],
    );
    if (revokedKinds.length) {
      // The browser cannot stop a capture the frame already has, and a forced reload does not rely on the Mini App
      forceReloadFrame(webApp.url);
      markPermissionsApplied();
      showNotification({ message: { key: getRevokedNotificationKey(revokedKinds) } });
      return;
    }

    sendEvent({ eventType: 'media_access_changed', eventData: buildAccessState() });
  });

  useEffectWithPrevDeps((prevDeps) => {
    if (!prevDeps.length) return;
    const [prevCamera, prevMicrophone, prevIsModalOpen] = prevDeps;
    handleAccessUpdate(prevCamera, prevMicrophone, prevIsModalOpen);
  }, [permissions?.camera, permissions?.microphone, isModalOpen, handleAccessUpdate]);

  function getIsReloadRequired() {
    return WEB_APP_MEDIA_KINDS.some((kind) => permissions?.[kind] && !appliedPermissionsRef.current?.[kind]);
  }

  function getStatus(kind: WebAppMediaKind): WebAppMediaAccessStatus {
    if (unavailableKindsRef.current.includes(kind)) return 'unavailable';
    const isGranted = permissions?.[kind];
    if (isGranted === undefined) return 'not_requested';
    return isGranted ? 'granted' : 'denied';
  }

  return {
    allowAttribute,
    isReloadRequired,
    handleMediaAccessEvent,
    markPermissionsApplied,
  };
}

export default useWebAppMediaAccess;
