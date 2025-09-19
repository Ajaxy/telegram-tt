import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { GroupCallParticipant as TypeGroupCallParticipant } from '../../../lib/secret-sauce';

import { GROUP_CALL_DEFAULT_VOLUME } from '../../../config';
import { THRESHOLD } from '../../../lib/secret-sauce';
import { selectChat, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';
import formatGroupCallVolume from './helpers/formatGroupCallVolume';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import Icon from '../../common/icons/Icon';
import ListItem from '../../ui/ListItem';
import GroupCallParticipantMenu from './GroupCallParticipantMenu';
import OutlinedMicrophoneIcon from './OutlinedMicrophoneIcon';

import styles from './GroupCallParticipant.module.scss';

type OwnProps = {
  participant: TypeGroupCallParticipant;
};

type StateProps = {
  peer?: ApiPeer;
};

const GroupCallParticipant: FC<OwnProps & StateProps> = ({
  participant,
  peer,
}) => {
  const ref = useRef<HTMLDivElement>();
  const menuRef = useRef<HTMLDivElement>();
  const lang = useOldLang();

  const {
    isSelf, isMutedByMe, isMuted, hasVideoStream, hasPresentationStream,
  } = participant;
  const isSpeaking = (participant.amplitude || 0) > THRESHOLD;
  const isRaiseHand = Boolean(participant.raiseHandRating);

  const {
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenu,
    handleBeforeContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref, isSelf);

  const getTriggerElement = useCallback(() => ref.current, []);

  const getRootElement = useCallback(
    () => ref.current!.closest('.custom-scroll, .no-scrollbar'),
    [],
  );

  const getMenuElement = useCallback(
    () => menuRef.current!,
    [],
  );

  const getLayout = useCallback(
    () => ({ withPortal: true }),
    [],
  );

  const hasCustomVolume = Boolean(
    !isMuted && isSpeaking && participant.volume && participant.volume !== GROUP_CALL_DEFAULT_VOLUME,
  );

  const [aboutText, aboutColor] = useMemo(() => {
    if (isMutedByMe) {
      return [lang('VoipGroupMutedForMe'), styles.subtitleRed];
    }

    if (isRaiseHand) {
      return [lang('WantsToSpeak'), styles.subtitleBlue];
    }

    if (hasCustomVolume) {
      return [
        lang('SpeakingWithVolume', formatGroupCallVolume(participant))
          .replace('%%', '%'),
        styles.subtitleGreen,
      ];
    }

    if (!isMuted && isSpeaking) {
      return [
        lang('Speaking'),
        styles.subtitleGreen,
      ];
    }

    if (isSelf) {
      return [lang('ThisIsYou'), styles.subtitleBlue];
    }

    return participant.about ? [participant.about, ''] : [lang('Listening'), styles.subtitleBlue];
  }, [isMutedByMe, isRaiseHand, hasCustomVolume, isMuted, isSpeaking, isSelf, participant, lang]);

  if (!peer) {
    return undefined;
  }

  return (
    <ListItem
      leftElement={<Avatar peer={peer} className={styles.avatar} />}
      rightElement={<OutlinedMicrophoneIcon participant={participant} className={styles.icon} />}
      className={styles.root}
      onClick={handleContextMenu}
      onMouseDown={handleBeforeContextMenu}
      onContextMenu={handleContextMenu}
      multiline
      ripple
      ref={ref}
    >
      <FullNameTitle peer={peer} withEmojiStatus className={styles.title} />
      <span className={buildClassName(styles.subtitle, 'subtitle', aboutColor)}>
        {hasPresentationStream && <Icon name="share-screen" />}
        {hasVideoStream && <Icon name="video" />}
        {hasCustomVolume && <Icon name="speaker" />}
        <span className={styles.subtitleText}>{renderText(aboutText)}</span>
      </span>
      <GroupCallParticipantMenu
        participant={participant}
        isDropdownOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getMenuElement={getMenuElement}
        getLayout={getLayout}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
        menuRef={menuRef}
      />
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { participant }): Complete<StateProps> => {
    return {
      peer: selectUser(global, participant.id) || selectChat(global, participant.id),
    };
  },
)(GroupCallParticipant));
