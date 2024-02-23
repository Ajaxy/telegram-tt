import React, { memo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { TabState } from '../../../global/types';
import { AudioOrigin } from '../../../types';

import { isOwnMessage } from '../../../global/helpers';
import { selectTheme } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';

import Audio from '../../common/Audio';
import RoundVideo from '../../middle/message/RoundVideo';
import Button from '../../ui/Button';

import styles from './OneTimeMediaModal.module.scss';

export type OwnProps = {
  info: TabState['oneTimeMediaModal'];
};

const OneTimeMediaModal = ({
  info,
}: OwnProps) => {
  const {
    closeOneTimeMediaModal,
  } = getActions();

  const lang = useLang();
  const message = useCurrentOrPrev(info?.message, true);

  const {
    shouldRender,
    transitionClassNames,
  } = useShowTransition(Boolean(info));

  const handlePlayVoice = useLastCallback(() => {
    return undefined;
  });

  const handleClose = useLastCallback(() => {
    closeOneTimeMediaModal();
  });

  if (!shouldRender || !message) {
    return undefined;
  }

  const isOwn = isOwnMessage(message);
  const theme = selectTheme(getGlobal());
  const closeBtnTitle = isOwn ? lang('Chat.Voice.Single.Close') : lang('Chat.Voice.Single.DeleteAndClose');

  function renderMedia() {
    if (!message?.content) {
      return undefined;
    }
    const { voice, video } = message.content;
    if (voice) {
      return (
        <Audio
          className={styles.voice}
          theme={theme}
          message={message}
          origin={AudioOrigin.OneTimeModal}
          autoPlay
          onPlay={handlePlayVoice}
          onPause={handleClose}
        />
      );
    } else if (video?.isRound) {
      return (
        <RoundVideo
          className={styles.video}
          message={message}
          origin="oneTimeModal"
          onStop={handleClose}
        />
      );
    }
    return undefined;
  }

  return (
    <div className={buildClassName(styles.root, transitionClassNames)}>
      {renderMedia()}
      <div className={styles.footer}>
        <Button
          faded
          onClick={handleClose}
          pill
          size="smaller"
          color={theme === 'dark' ? 'dark' : 'secondary'}
          className={styles.closeBtn}
        >
          {closeBtnTitle}
        </Button>
      </div>
    </div>
  );
};

export default memo(OneTimeMediaModal);
