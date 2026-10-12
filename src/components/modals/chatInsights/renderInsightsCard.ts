import type { OldLangFn } from '../../../hooks/useOldLang';
import type { ChatInsights } from '../../../types/chatInsights';
import type { LangFn } from '../../../util/localization';

import { formatFullDate, formatShortDuration } from '../../../util/dates/oldDateFormat';

type RenderInsightsCardOptions = {
  insights: ChatInsights;
  chatTitle: string;
  lang: LangFn;
  oldLang: OldLangFn;
  getSenderName: (peerId: string) => string;
};

const WIDTH = 1080;
const HEIGHT = 1350;
const PADDING = 96;
const GRADIENT = ['#2B7DE9', '#6C3BD8', '#F0557A'];
const FONT_FAMILY = 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const TITLE_SIZE = 64;
const KICKER_SIZE = 34;
const STAT_VALUE_SIZE = 96;
const STAT_LABEL_SIZE = 32;
const EMOJI_SIZE = 120;
const FOOTER_SIZE = 30;
const ROW_HEIGHT = 190;
const CARD_RADIUS = 48;
const TOP_EMOJI_COUNT = 3;

export function renderInsightsCard(options: RenderInsightsCardOptions): HTMLCanvasElement {
  const {
    insights, chatTitle, lang, oldLang, getSenderName,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  GRADIENT.forEach((color, i) => gradient.addColorStop(i / (GRADIENT.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundRect(ctx, PADDING / 2, PADDING / 2, WIDTH - PADDING, HEIGHT - PADDING, CARD_RADIUS);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = `500 ${KICKER_SIZE}px ${FONT_FAMILY}`;
  ctx.fillText(lang('ChatInsightsSummary').toUpperCase(), WIDTH / 2, PADDING + KICKER_SIZE);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${TITLE_SIZE}px ${FONT_FAMILY}`;
  ctx.fillText(fitText(ctx, chatTitle, WIDTH - PADDING * 2), WIDTH / 2, PADDING + KICKER_SIZE + TITLE_SIZE + 24);

  const fastestReplier = insights.senders
    .filter((sender) => sender.replyTimeMedian !== undefined)
    .sort((a, b) => a.replyTimeMedian! - b.replyTimeMedian!)[0];

  const rows: [string, string][] = [
    [lang.number(insights.totalMessages), lang('ChatInsightsSummaryMessages')],
    [lang.number(insights.activeDays), lang('ChatInsightsSummaryDays')],
    [lang.number(insights.longestStreakDays), lang('ChatInsightsSummaryStreak')],
  ];
  if (fastestReplier) {
    rows.push([
      formatShortDuration(lang, fastestReplier.replyTimeMedian!),
      lang('ChatInsightsSummaryReplier', { name: getSenderName(fastestReplier.peerId) }),
    ]);
  }

  let y = PADDING + KICKER_SIZE + TITLE_SIZE + 120;
  for (const [value, label] of rows) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${STAT_VALUE_SIZE}px ${FONT_FAMILY}`;
    ctx.fillText(value, WIDTH / 2, y + STAT_VALUE_SIZE);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `400 ${STAT_LABEL_SIZE}px ${FONT_FAMILY}`;
    ctx.fillText(fitText(ctx, label, WIDTH - PADDING * 2), WIDTH / 2, y + STAT_VALUE_SIZE + STAT_LABEL_SIZE + 16);
    y += ROW_HEIGHT;
  }

  const topEmoji = insights.topEmoji.slice(0, TOP_EMOJI_COUNT);
  if (topEmoji.length) {
    ctx.font = `${EMOJI_SIZE}px ${FONT_FAMILY}`;
    const step = EMOJI_SIZE * 1.6;
    const startX = WIDTH / 2 - ((topEmoji.length - 1) * step) / 2;
    topEmoji.forEach(({ emoji }, i) => {
      ctx.fillText(emoji, startX + i * step, y + EMOJI_SIZE);
    });
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = `400 ${FOOTER_SIZE}px ${FONT_FAMILY}`;
  const firstDate = formatFullDate(oldLang, insights.firstMessageDate * 1000);
  const lastDate = formatFullDate(oldLang, insights.lastMessageDate * 1000);
  ctx.fillText(`${firstDate} – ${lastDate}`, WIDTH / 2, HEIGHT - PADDING);

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png', 1);
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
