import { GroupCallParticipant } from '../../../lib/secret-sauce';
import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { IAnchorPosition } from '../../../types';

import buildClassName from '../../../util/buildClassName';
import useRunThrottled from '../../../hooks/useRunThrottled';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import { selectIsAdminInActiveGroupCall } from '../../../global/selectors/calls';
import { GROUP_CALL_DEFAULT_VOLUME, GROUP_CALL_VOLUME_MULTIPLIER } from '../../../config';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import AnimatedIcon from '../../common/AnimatedIcon';
import DeleteMemberModal from '../../right/DeleteMemberModal';

import './GroupCallParticipantMenu.scss';

const SPEAKER_ICON_DISABLED_SEGMENT: [number, number] = [0, 17];
const SPEAKER_ICON_ENABLED_SEGMENT: [number, number] = [17, 34];

type OwnProps = {
  participant?: GroupCallParticipant;
  closeDropdown: VoidFunction;
  isDropdownOpen: boolean;
  anchor?: IAnchorPosition;
};

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
  closeDropdown,
  isDropdownOpen,
  anchor,
  isAdmin,
}) => {
  const {
    toggleGroupCallMute,
    setGroupCallParticipantVolume,
    toggleGroupCallPanel,
    openChat,
    requestToSpeak,
  } = getActions();

  const lang = useLang();
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

  useEffect(() => {
    setLocalVolume(isMutedByMe
      ? VOLUME_ZERO
      : ((participant?.volume || GROUP_CALL_DEFAULT_VOLUME) / GROUP_CALL_VOLUME_MULTIPLIER));
    // We only want to initialize local volume when switching participants and ignore following updates from server
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const runThrottled = useRunThrottled(VOLUME_CHANGE_THROTTLE);

  const handleRemove = useCallback((e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    openDeleteUserModal();
    closeDropdown();
  }, [openDeleteUserModal, closeDropdown]);

  const handleCancelRequestToSpeak = useCallback((e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    requestToSpeak({
      value: false,
    });
    closeDropdown();
  }, [requestToSpeak, closeDropdown]);

  const handleMute = useCallback((e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    closeDropdown();

    if (!isAdmin) {
      setLocalVolume(isMutedByMe ? GROUP_CALL_DEFAULT_VOLUME / GROUP_CALL_VOLUME_MULTIPLIER : VOLUME_ZERO);
    }

    toggleGroupCallMute({
      participantId: id,
      value: isAdmin ? !shouldRaiseHand : !isMutedByMe,
    });
  }, [closeDropdown, toggleGroupCallMute, id, isAdmin, shouldRaiseHand, isMutedByMe]);

  const handleOpenProfile = useCallback((e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    toggleGroupCallPanel();
    openChat({
      id,
    });
    closeDropdown();
  }, [toggleGroupCallPanel, closeDropdown, openChat, id]);

  const isLocalVolumeZero = localVolume === VOLUME_ZERO;
  const speakerIconPlaySegment = isLocalVolumeZero ? SPEAKER_ICON_DISABLED_SEGMENT : SPEAKER_ICON_ENABLED_SEGMENT;

  const handleChangeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setLocalVolume(value);
    runThrottled(() => {
      if (value === VOLUME_ZERO) {
        toggleGroupCallMute({
          participantId: id,
          value: true,
        });
      } else {
        setGroupCallParticipantVolume({
          participantId: id,
          volume: Math.floor(value * GROUP_CALL_VOLUME_MULTIPLIER),
        });
      }
    });
  };

  return (
    <div>
      <Menu
        isOpen={isDropdownOpen}
        positionX="right"
        autoClose
        style={anchor ? `right: 1rem; top: ${anchor.y}px;` : undefined}
        onClose={closeDropdown}
        className="participant-menu"
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
                  name="Speaker"
                  playSegment={speakerIconPlaySegment}
                  size={SPEAKER_ICON_SIZE}
                />
                <span>{localVolume}%</span>
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
              icon={isMuted ? (isAdmin ? 'allow-speak' : 'microphone-alt') : 'microphone-alt'}
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
  (global): StateProps => {
    return {
      isAdmin: selectIsAdminInActiveGroupCall(global),
    };
  },
)(GroupCallParticipantMenu));
