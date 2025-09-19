import type { ElementRef, FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { GroupCallParticipant } from '../../../lib/secret-sauce';
import type { MenuPositionOptions } from '../../ui/Menu';

import { GROUP_CALL_DEFAULT_VOLUME, GROUP_CALL_VOLUME_MULTIPLIER } from '../../../config';
import { selectIsAdminInActiveGroupCall } from '../../../global/selectors/calls';
import buildClassName from '../../../util/buildClassName';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useRunThrottled from '../../../hooks/useRunThrottled';

import AnimatedIcon from '../../common/AnimatedIcon';
import DeleteMemberModal from '../../right/DeleteMemberModal';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';

import './GroupCallParticipantMenu.scss';

const SPEAKER_ICON_DISABLED_SEGMENT: [number, number] = [0, 17];
const SPEAKER_ICON_ENABLED_SEGMENT: [number, number] = [17, 34];

type OwnProps =
  {
    participant?: GroupCallParticipant;
    onCloseAnimationEnd: VoidFunction;
    onClose: VoidFunction;
    isDropdownOpen: boolean;
    menuRef?: ElementRef<HTMLDivElement>;
  }
  & MenuPositionOptions;

type StateProps = {
  isAdmin: boolean;
};

const VOLUME_ZERO = 0;
const VOLUME_LOW = 50;
const VOLUME_MEDIUM = 100;
const VOLUME_NORMAL = 150;

const VOLUME_CHANGE_THROTTLE = 500;

const SPEAKER_ICON_SIZE = 24;

const GroupCallParticipantMenu: FC<OwnProps & StateProps> = ({
  participant,
  onCloseAnimationEnd,
  onClose,
  isDropdownOpen,
  isAdmin,
  menuRef,
  ...menuPositionOptions
}) => {
  const {
    toggleGroupCallMute,
    setGroupCallParticipantVolume,
    toggleGroupCallPanel,
    openChat,
    requestToSpeak,
  } = getActions();

  const lang = useOldLang();
  const [isDeleteUserModalOpen, openDeleteUserModal, closeDeleteUserModal] = useFlag();

  const id = participant?.id;
  const {
    isMutedByMe, isMuted, isSelf, canSelfUnmute,
  } = participant || {};
  const isRaiseHand = Boolean(participant?.raiseHandRating);
  const shouldRaiseHand = !canSelfUnmute && isMuted;

  const [localVolume, setLocalVolume] = useState(
    isMutedByMe ? VOLUME_ZERO : ((participant?.volume || GROUP_CALL_DEFAULT_VOLUME) / GROUP_CALL_VOLUME_MULTIPLIER),
  );

  const [shouldPlay, setShouldPlay] = useState(false);

  const isLocalVolumeZero = localVolume === VOLUME_ZERO;
  const speakerIconPlaySegment = isLocalVolumeZero ? SPEAKER_ICON_DISABLED_SEGMENT : SPEAKER_ICON_ENABLED_SEGMENT;

  useEffect(() => {
    if (isDropdownOpen) return;
    setShouldPlay(false);
  }, [isDropdownOpen]);

  const handleSetLocalVolume = useLastCallback((volume: number) => {
    setLocalVolume(volume);
    const isNewLocalVolumeZero = volume === VOLUME_ZERO;
    setShouldPlay(isNewLocalVolumeZero !== isLocalVolumeZero);
  });

  useEffect(() => {
    setLocalVolume(isMutedByMe
      ? VOLUME_ZERO
      : ((participant?.volume || GROUP_CALL_DEFAULT_VOLUME) / GROUP_CALL_VOLUME_MULTIPLIER));
    // We only want to initialize local volume when switching participants and ignore following updates from server
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [id]);

  const runThrottled = useRunThrottled(VOLUME_CHANGE_THROTTLE);

  const handleRemove = useLastCallback((e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    openDeleteUserModal();
    onClose();
  });

  const handleCancelRequestToSpeak = useLastCallback((e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    requestToSpeak({
      value: false,
    });
    onClose();
  });

  const handleMute = useLastCallback((e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    onClose();

    if (!isAdmin) {
      handleSetLocalVolume(isMutedByMe ? GROUP_CALL_DEFAULT_VOLUME / GROUP_CALL_VOLUME_MULTIPLIER : VOLUME_ZERO);
    } else if (shouldRaiseHand) {
      handleSetLocalVolume((participant?.volume ?? GROUP_CALL_DEFAULT_VOLUME) / GROUP_CALL_VOLUME_MULTIPLIER);
    }

    toggleGroupCallMute({
      participantId: id!,
      value: isAdmin ? !shouldRaiseHand : !isMutedByMe,
    });
  });

  const handleOpenProfile = useLastCallback((e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    toggleGroupCallPanel();
    openChat({
      id,
    });
    onClose();
  });

  const handleChangeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    handleSetLocalVolume(value);

    runThrottled(() => {
      if (value === VOLUME_ZERO) {
        toggleGroupCallMute({
          participantId: id!,
          value: true,
        });
      } else {
        setGroupCallParticipantVolume({
          participantId: id!,
          volume: Math.floor(value * GROUP_CALL_VOLUME_MULTIPLIER),
        });
      }
    });
  };

  return (
    <div>
      <Menu
        isOpen={isDropdownOpen}
        ref={menuRef}
        withPortal
        onClose={onClose}
        onCloseAnimationEnd={onCloseAnimationEnd}
        className="participant-menu with-menu-transitions"

        {...menuPositionOptions}
      >
        {!isSelf && !shouldRaiseHand && (
          <div className="group">
            <div className={buildClassName(
              'volume-control',
              localVolume < VOLUME_LOW && 'low',
              localVolume >= VOLUME_LOW && localVolume < VOLUME_MEDIUM && 'medium',
              localVolume >= VOLUME_MEDIUM && localVolume < VOLUME_NORMAL && 'normal',
              localVolume >= VOLUME_NORMAL && 'high',
            )}
            >
              <input
                type="range"
                min="0"
                max="200"
                value={localVolume}
                onChange={handleChangeVolume}
              />
              <div className="info">
                <AnimatedIcon
                  tgsUrl={LOCAL_TGS_URLS.Speaker}
                  play={shouldPlay ? speakerIconPlaySegment.toString() : false}
                  playSegment={speakerIconPlaySegment}
                  size={SPEAKER_ICON_SIZE}
                />
                <span>
                  {localVolume}
                  %
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="group">
          {(isRaiseHand && isSelf) && (
            <MenuItem
              icon="stop-raising-hand"
              onClick={handleCancelRequestToSpeak}
            >
              {lang('VoipGroupCancelRaiseHand')}
            </MenuItem>
          )}
          {!isSelf && <MenuItem icon="user" onClick={handleOpenProfile}>{lang('VoipGroupOpenProfile')}</MenuItem>}
          {!isSelf && (
            // TODO cross mic
            <MenuItem
              icon={isMuted ? (isAdmin && shouldRaiseHand ? 'allow-speak' : 'microphone-alt') : 'microphone-alt'}
              onClick={handleMute}
            >
              {isAdmin
                ? lang(shouldRaiseHand ? 'VoipGroupAllowToSpeak' : 'VoipMute')
                : lang(isMutedByMe ? 'VoipGroupUnmuteForMe' : 'VoipGroupMuteForMe')}
            </MenuItem>
          )}
          {!isSelf && isAdmin && (
            // TODO replace with hand
            <MenuItem icon="delete-user" destructive onClick={handleRemove}>
              {lang('VoipGroupUserRemove')}
            </MenuItem>
          )}
        </div>
      </Menu>

      {!isSelf && isAdmin && (
        <DeleteMemberModal
          isOpen={isDeleteUserModalOpen}
          userId={id}
          onClose={closeDeleteUserModal}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      isAdmin: selectIsAdminInActiveGroupCall(global),
    };
  },
)(GroupCallParticipantMenu));
