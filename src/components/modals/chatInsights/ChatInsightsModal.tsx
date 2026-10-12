import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiPeer, ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { OldLangFn } from '../../../hooks/useOldLang';
import type { ChatInsights } from '../../../types/chatInsights';
import type { LangFn } from '../../../util/localization';

import { getPeerTitle } from '../../../global/helpers/peers';
import { selectChat, selectIsChatWithSelf } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import { formatFullDate, formatShortDuration, formatWeekday } from '../../../util/dates/oldDateFormat';
import { isUserId } from '../../../util/entities/ids';
import { buildInsightsSlides, type InsightsSlide } from './buildInsightsSlides';
import { canvasToBlob, renderInsightsCard } from './renderInsightsCard';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';
import Modal from '@gili/modal/Modal';

import styles from './ChatInsightsModal.module.scss';

export type OwnProps = {
  modal: NonNullable<TabState['chatInsightsModal']>;
  isOpen: boolean;
};

type StateProps = {
  chat?: ApiChat;
  currentUserId?: string;
  usersById: Record<string, ApiUser>;
  chatsById: Record<string, ApiChat>;
};

const FILE_NAME = 'telegram-chat-insights.png';
const TOP_SENDERS_COUNT = 5;

const ChatInsightsModal = ({
  modal,
  isOpen,
  chat,
  currentUserId,
  usersById,
  chatsById,
}: OwnProps & StateProps) => {
  const { closeChatInsightsModal, openChatWithDraft } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();
  const [slideIndex, setSlideIndex] = useState(0);

  const { insights, isLoading, scannedCount, totalCount } = modal;

  const sendersById = useMemo(() => {
    const result: Record<string, ApiPeer> = {};
    if (!insights) return result;
    const peerIds = insights.senders.slice(0, TOP_SENDERS_COUNT).map(({ peerId }) => peerId);
    if (insights.topMessage?.senderId) peerIds.push(insights.topMessage.senderId);
    for (const peerId of peerIds) {
      const peer = isUserId(peerId) ? usersById[peerId] : chatsById[peerId];
      if (peer) result[peerId] = peer;
    }
    return result;
  }, [insights, usersById, chatsById]);
  const chatTitle = (chat && getPeerTitle(lang, chat)) || '';
  const isPrivate = chat ? isUserId(chat.id) : false;

  const getSenderName = useLastCallback((peerId: string) => {
    if (peerId === currentUserId) return lang('ChatInsightsYou');
    const peer = sendersById[peerId];
    return (peer && getPeerTitle(lang, peer)) || '';
  });

  const slides = useMemo(() => (
    insights ? buildInsightsSlides(insights, { isPrivate, currentUserId }) : []
  ), [insights, isPrivate, currentUserId]);

  useEffect(() => {
    if (isOpen) setSlideIndex(0);
  }, [isOpen, insights]);

  const handleClose = useLastCallback(() => {
    closeChatInsightsModal();
  });

  const handleNext = useLastCallback(() => {
    setSlideIndex((index) => Math.min(index + 1, slides.length - 1));
  });

  const handlePrev = useLastCallback(() => {
    setSlideIndex((index) => Math.max(index - 1, 0));
  });

  useEffect(() => {
    if (!isOpen || !slides.length) return undefined;
    return captureKeyboardListeners({ onLeft: handlePrev, onRight: handleNext });
  }, [isOpen, slides.length]);

  const handleShare = useLastCallback(async () => {
    if (!insights) return;
    const canvas = renderInsightsCard({
      insights,
      chatTitle,
      lang,
      oldLang,
      getSenderName,
    });
    const blob = await canvasToBlob(canvas);
    if (!blob) return;
    closeChatInsightsModal();
    openChatWithDraft({ text: { text: '' }, files: [new File([blob], FILE_NAME, { type: 'image/png' })] });
  });

  const slide = slides[slideIndex];

  return (
    <Modal
      isOpen={isOpen}
      width="slim"
      height="tall"
      dialogClassName={styles.dialog}
      contentClassName={styles.content}
      noContentInlinePadding
      noScrollable
      onClose={handleClose}
    >
      <div className={buildClassName(styles.stage, slide && styles[`theme_${slide.theme}`])}>
        <div className={styles.topBar}>
          <div className={styles.progress}>
            {slides.map((item, index) => (
              <div
                key={item.key}
                className={buildClassName(styles.progressSegment, index <= slideIndex && styles.progressSegmentActive)}
              />
            ))}
          </div>
          <Button
            round
            size="tiny"
            color="translucent-white"
            ariaLabel={lang('Close')}
            className={styles.closeButton}
            onClick={handleClose}
          >
            <Icon name="close" />
          </Button>
        </div>

        {isLoading && (
          <div className={styles.loading}>
            <Spinner color="white" />
            <div className={styles.loadingText}>
              {lang('ChatInsightsLoading', { count: scannedCount }, { pluralValue: scannedCount })}
            </div>
            {Boolean(totalCount) && (
              <div className={styles.loadingBar}>
                <div
                  className={styles.loadingBarFill}
                  style={`width: ${Math.min(100, Math.round((scannedCount / totalCount) * 100))}%`}
                />
              </div>
            )}
          </div>
        )}

        {!isLoading && slide && (
          <div key={slide.key} className={styles.slide}>
            {renderSlide(slide, {
              lang, oldLang, chat, chatTitle, insights: insights!, getSenderName, sendersById, onShare: handleShare,
            })}
          </div>
        )}

        {!isLoading && slides.length > 1 && (
          <>
            <div className={buildClassName(styles.tapZone, styles.tapZoneLeft)} onClick={handlePrev} />
            <div className={buildClassName(styles.tapZone, styles.tapZoneRight)} onClick={handleNext} />
          </>
        )}
      </div>
    </Modal>
  );
};

type RenderContext = {
  lang: LangFn;
  oldLang: OldLangFn;
  chat?: ApiChat;
  chatTitle: string;
  insights: ChatInsights;
  sendersById: Record<string, ApiPeer>;
  getSenderName: (peerId: string) => string;
  onShare: NoneToVoidFunction;
};

function renderSlide(slide: InsightsSlide, context: RenderContext) {
  const {
    lang, oldLang, chat, chatTitle, insights, sendersById, getSenderName, onShare,
  } = context;

  switch (slide.type) {
    case 'intro':
      return (
        <>
          {chat && <Avatar peer={chat} size="jumbo" className={styles.introAvatar} />}
          <h2 className={styles.title}>{chatTitle}</h2>
          <div className={styles.bigNumber}>{lang.number(insights.totalMessages)}</div>
          <div className={styles.caption}>
            {lang('ChatInsightsMessagesSince', {
              date: formatFullDate(oldLang, insights.firstMessageDate * 1000),
            }, { pluralValue: insights.totalMessages })}
          </div>
          <div className={styles.subCaption}>
            {lang('ChatInsightsActiveDays', { count: insights.activeDays }, { pluralValue: insights.activeDays })}
          </div>
        </>
      );

    case 'senders': {
      const senders = insights.senders.slice(0, TOP_SENDERS_COUNT);
      const max = senders[0]?.messageCount || 1;
      return (
        <>
          <div className={styles.kicker}>{lang('ChatInsightsWhoTalks')}</div>
          <div className={styles.bars}>
            {senders.map((sender) => {
              const peer = sendersById[sender.peerId];
              const share = Math.round((sender.messageCount / insights.totalMessages) * 100);
              return (
                <div key={sender.peerId} className={styles.barRow}>
                  {peer && <Avatar peer={peer} size="small" />}
                  <div className={styles.barBody}>
                    <div className={styles.barLabel}>
                      <span className={styles.barName}>{getSenderName(sender.peerId)}</span>
                      <span className={styles.barValue}>
                        {share}
                        %
                      </span>
                    </div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={`width: ${(sender.messageCount / max) * 100}%`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      );
    }

    case 'when': {
      const maxHour = Math.max(...insights.byHour, 1);
      const nightShare = Math.round((insights.nightMessages / insights.totalMessages) * 100);
      return (
        <>
          <div className={styles.kicker}>{lang('ChatInsightsWhen')}</div>
          <div className={styles.bigNumber}>{`${String(slide.busiestHour).padStart(2, '0')}:00`}</div>
          <div className={styles.caption}>{lang('ChatInsightsBusiestHour')}</div>
          <div className={styles.histogram}>
            {insights.byHour.map((count, hour) => (
              <div
                key={hour}
                className={buildClassName(styles.histogramBar, hour === slide.busiestHour && styles.histogramBarActive)}
                style={`height: ${Math.max(6, (count / maxHour) * 100)}%`}
              />
            ))}
          </div>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{formatWeekday(oldLang, slide.busiestWeekday)}</div>
              <div className={styles.statLabel}>{lang('ChatInsightsBusiestDay')}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{`${nightShare}%`}</div>
              <div className={styles.statLabel}>{lang('ChatInsightsNightOwl')}</div>
            </div>
          </div>
        </>
      );
    }

    case 'media':
      return (
        <>
          <div className={styles.kicker}>{lang('ChatInsightsMedia')}</div>
          <div className={styles.grid}>
            {slide.items.map((item) => (
              <div key={item.key} className={styles.gridItem}>
                <Icon name={item.icon} className={styles.gridIcon} />
                <div className={styles.gridValue}>{lang.number(item.count)}</div>
                <div className={styles.gridLabel}>{lang(item.labelKey)}</div>
              </div>
            ))}
          </div>
        </>
      );

    case 'emoji':
      return (
        <>
          <div className={styles.kicker}>{lang('ChatInsightsTopEmoji')}</div>
          <div className={styles.emojiRow}>
            {insights.topEmoji.slice(0, 3).map(({ emoji, count }, index) => (
              <div key={emoji} className={buildClassName(styles.emojiItem, index === 0 && styles.emojiItemFirst)}>
                <div className={styles.emojiGlyph}>{emoji}</div>
                <div className={styles.emojiCount}>{lang.number(count)}</div>
              </div>
            ))}
          </div>
          <div className={styles.subCaption}>
            {lang('ChatInsightsCharacters', { count: insights.totalCharacters }, {
              pluralValue: insights.totalCharacters,
            })}
          </div>
        </>
      );

    case 'rhythm': {
      const replier = slide.fastestReplier;
      return (
        <>
          <div className={styles.kicker}>{lang('ChatInsightsStreak')}</div>
          <div className={styles.bigNumber}>{lang.number(insights.longestStreakDays)}</div>
          <div className={styles.caption}>
            {lang('ChatInsightsStreakDays', undefined, { pluralValue: insights.longestStreakDays })}
          </div>
          {replier && (
            <div className={styles.replier}>
              {sendersById[replier.peerId] && <Avatar peer={sendersById[replier.peerId]} size="medium" />}
              <div className={styles.replierName}>{getSenderName(replier.peerId)}</div>
              <div className={styles.replierLabel}>{lang('ChatInsightsFastestReplier')}</div>
              <div className={styles.replierTime}>
                {lang('ChatInsightsReplyTime', { time: formatShortDuration(lang, replier.replyTimeMedian) })}
              </div>
            </div>
          )}
        </>
      );
    }

    case 'topMessage': {
      const { topMessage } = insights;
      if (!topMessage) return undefined;
      return (
        <>
          <div className={styles.kicker}>{lang('ChatInsightsTopMessage')}</div>
          <div className={styles.quote}>
            {topMessage.senderId && (
              <div className={styles.quoteSender}>{getSenderName(topMessage.senderId)}</div>
            )}
            <div className={styles.quoteText}>{topMessage.text}</div>
          </div>
          <div className={styles.caption}>
            {lang('ChatInsightsReactions', { count: topMessage.reactionCount }, {
              pluralValue: topMessage.reactionCount,
            })}
          </div>
        </>
      );
    }

    case 'summary':
      return (
        <>
          <div className={styles.kicker}>{lang('ChatInsightsSummary')}</div>
          <h2 className={styles.title}>{chatTitle}</h2>
          <div className={styles.summaryList}>
            {slide.items.map((item) => (
              <div key={item.key} className={styles.summaryItem}>
                <div className={styles.summaryValue}>{item.value}</div>
                <div className={styles.summaryLabel}>{lang(item.labelKey)}</div>
              </div>
            ))}
          </div>
          {!insights.isComplete && (
            <div className={styles.note}>
              {lang('ChatInsightsPartial', { count: insights.totalMessages }, { pluralValue: insights.totalMessages })}
            </div>
          )}
          <Button className={styles.shareButton} color="translucent-white" size="smaller" onClick={onShare}>
            <Icon name="share-filled" className={styles.shareIcon} />
            {lang('ChatInsightsShare')}
          </Button>
        </>
      );

    default:
      return undefined;
  }
}

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    return {
      chat: selectChat(global, modal.chatId),
      currentUserId: selectIsChatWithSelf(global, modal.chatId) ? undefined : global.currentUserId,
      usersById: global.users.byId,
      chatsById: global.chats.byId,
    };
  },
)(ChatInsightsModal));
