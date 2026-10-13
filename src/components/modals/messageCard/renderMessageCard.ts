export type MessageCardTheme = {
  key: string;
  gradient: [string, string, string];
  isDarkBubble?: boolean;
};

export type MessageCardOptions = {
  text: string;
  time: string;
  theme: MessageCardTheme;
  senderName?: string;
  senderColor?: string;
  senderInitials?: string;
  avatarUrl?: string;
  footer?: string;
  fontFamily: string;
};

export const MESSAGE_CARD_THEMES: MessageCardTheme[] = [
  { key: 'sky', gradient: ['#4FA3F7', '#2B7DE9', '#6AC8FF'] },
  { key: 'sunset', gradient: ['#FF8A65', '#F0557A', '#FFB55A'] },
  { key: 'mint', gradient: ['#3CC8A6', '#2E9F8E', '#8FE1C6'] },
  { key: 'violet', gradient: ['#8E6CF6', '#5C45D8', '#C19BFF'] },
  { key: 'night', gradient: ['#1E2A3A', '#0E1420', '#2D3F5A'], isDarkBubble: true },
  { key: 'mono', gradient: ['#E9EDF2', '#D5DBE3', '#F7F9FB'] },
];

const CARD_WIDTH = 1080;
const PADDING = 96;
const BUBBLE_PADDING_X = 48;
const BUBBLE_PADDING_Y = 40;
const BUBBLE_RADIUS = 40;
const BUBBLE_MAX_WIDTH = CARD_WIDTH - PADDING * 2;
const AVATAR_SIZE = 72;
const AVATAR_GAP = 24;
const NAME_FONT_SIZE = 38;
const TEXT_FONT_SIZE = 44;
const TEXT_LINE_HEIGHT = 60;
const TIME_FONT_SIZE = 28;
const FOOTER_FONT_SIZE = 30;
const FOOTER_HEIGHT = 72;
const MAX_LINES = 18;
const HEADER_HEIGHT = AVATAR_SIZE + 24;
const SHADOW_BLUR = 60;
const BUBBLE_LIGHT = '#FFFFFF';
const BUBBLE_DARK = '#1F2A38';
const TEXT_LIGHT = '#000000';
const TEXT_DARK = '#FFFFFF';
const TIME_LIGHT = 'rgba(0, 0, 0, 0.45)';
const TIME_DARK = 'rgba(255, 255, 255, 0.55)';
const FOOTER_COLOR = 'rgba(255, 255, 255, 0.85)';
const FOOTER_COLOR_ON_LIGHT = 'rgba(0, 0, 0, 0.45)';
const ELLIPSIS = '…';

export async function renderMessageCard(options: MessageCardOptions): Promise<HTMLCanvasElement> {
  const {
    text, time, theme, senderName, senderColor, senderInitials, avatarUrl, footer, fontFamily,
  } = options;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const bubbleInnerWidth = BUBBLE_MAX_WIDTH - BUBBLE_PADDING_X * 2;

  ctx.font = buildFont(TEXT_FONT_SIZE, fontFamily);
  const lines = wrapText(ctx, text, bubbleInnerWidth);
  const textWidth = Math.max(
    ...lines.map((line) => ctx.measureText(line).width),
    senderName ? measureNameWidth(ctx, senderName, fontFamily) : 0,
  );
  const timeWidth = measureTimeWidth(ctx, time, fontFamily);
  const bubbleWidth = Math.min(
    BUBBLE_MAX_WIDTH,
    Math.max(textWidth, timeWidth + 120) + BUBBLE_PADDING_X * 2,
  );
  const headerHeight = senderName ? HEADER_HEIGHT : 0;
  const bubbleHeight = BUBBLE_PADDING_Y * 2 + headerHeight + lines.length * TEXT_LINE_HEIGHT + TIME_FONT_SIZE + 16;
  const cardHeight = PADDING * 2 + bubbleHeight + (footer ? FOOTER_HEIGHT : 0);

  canvas.width = CARD_WIDTH;
  canvas.height = cardHeight;

  drawBackground(ctx, theme, cardHeight);

  const bubbleX = (CARD_WIDTH - bubbleWidth) / 2;
  const bubbleY = PADDING;
  drawBubble(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, theme.isDarkBubble ? BUBBLE_DARK : BUBBLE_LIGHT);

  let cursorY = bubbleY + BUBBLE_PADDING_Y;
  const contentX = bubbleX + BUBBLE_PADDING_X;

  if (senderName) {
    await drawHeader(ctx, {
      x: contentX,
      y: cursorY,
      name: senderName,
      color: senderColor || (theme.isDarkBubble ? TEXT_DARK : TEXT_LIGHT),
      initials: senderInitials,
      avatarUrl,
      fontFamily,
    });
    cursorY += headerHeight;
  }

  ctx.font = buildFont(TEXT_FONT_SIZE, fontFamily);
  ctx.fillStyle = theme.isDarkBubble ? TEXT_DARK : TEXT_LIGHT;
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, i) => {
    ctx.fillText(line, contentX, cursorY + TEXT_FONT_SIZE + i * TEXT_LINE_HEIGHT);
  });
  cursorY += lines.length * TEXT_LINE_HEIGHT;

  ctx.font = buildFont(TIME_FONT_SIZE, fontFamily);
  ctx.fillStyle = theme.isDarkBubble ? TIME_DARK : TIME_LIGHT;
  ctx.textAlign = 'right';
  ctx.fillText(time, bubbleX + bubbleWidth - BUBBLE_PADDING_X, cursorY + TIME_FONT_SIZE + 8);
  ctx.textAlign = 'left';

  if (footer) {
    ctx.font = buildFont(FOOTER_FONT_SIZE, fontFamily, 500);
    ctx.fillStyle = theme.key === 'mono' ? FOOTER_COLOR_ON_LIGHT : FOOTER_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText(footer, CARD_WIDTH / 2, cardHeight - PADDING / 2 - FOOTER_HEIGHT / 2 + FOOTER_FONT_SIZE / 2);
    ctx.textAlign = 'left';
  }

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png', 1);
  });
}

function drawBackground(ctx: CanvasRenderingContext2D, theme: MessageCardTheme, height: number) {
  const [from, to, accent] = theme.gradient;
  const base = ctx.createLinearGradient(0, 0, CARD_WIDTH, height);
  base.addColorStop(0, from);
  base.addColorStop(1, to);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, CARD_WIDTH, height);

  const glow = ctx.createRadialGradient(
    CARD_WIDTH * 0.8, height * 0.15, 0, CARD_WIDTH * 0.8, height * 0.15, CARD_WIDTH * 0.7,
  );
  glow.addColorStop(0, `${accent}CC`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, height);

  const glow2 = ctx.createRadialGradient(
    CARD_WIDTH * 0.1, height * 0.9, 0, CARD_WIDTH * 0.1, height * 0.9, CARD_WIDTH * 0.6,
  );
  glow2.addColorStop(0, `${from}99`);
  glow2.addColorStop(1, `${from}00`);
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, CARD_WIDTH, height);
}

function drawBubble(
  ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string,
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = SHADOW_BLUR;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = color;
  drawRoundedRect(ctx, x, y, width, height, BUBBLE_RADIUS);
  ctx.fill();
  ctx.restore();
}

function drawRoundedRect(
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

async function drawHeader(ctx: CanvasRenderingContext2D, params: {
  x: number;
  y: number;
  name: string;
  color: string;
  initials?: string;
  avatarUrl?: string;
  fontFamily: string;
}) {
  const {
    x, y, name, color, initials, avatarUrl, fontFamily,
  } = params;
  const centerX = x + AVATAR_SIZE / 2;
  const centerY = y + AVATAR_SIZE / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, AVATAR_SIZE / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const image = avatarUrl ? await loadImage(avatarUrl) : undefined;
  if (image) {
    ctx.drawImage(image, x, y, AVATAR_SIZE, AVATAR_SIZE);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, AVATAR_SIZE, AVATAR_SIZE);
    if (initials) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = buildFont(AVATAR_SIZE * 0.4, fontFamily, 500);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, centerX, centerY + 2);
    }
  }
  ctx.restore();

  ctx.font = buildFont(NAME_FONT_SIZE, fontFamily, 500);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, x + AVATAR_SIZE + AVATAR_GAP, centerY);
  ctx.textBaseline = 'alphabetic';
}

function measureNameWidth(ctx: CanvasRenderingContext2D, name: string, fontFamily: string) {
  ctx.save();
  ctx.font = buildFont(NAME_FONT_SIZE, fontFamily, 500);
  const width = ctx.measureText(name).width + AVATAR_SIZE + AVATAR_GAP;
  ctx.restore();
  return width;
}

function measureTimeWidth(ctx: CanvasRenderingContext2D, time: string, fontFamily: string) {
  ctx.save();
  ctx.font = buildFont(TIME_FONT_SIZE, fontFamily);
  const width = ctx.measureText(time).width;
  ctx.restore();
  return width;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let line = '';

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line) lines.push(line);
      line = fitWord(ctx, word, maxWidth, lines);
    }

    lines.push(line);
  }

  if (lines.length > MAX_LINES) {
    const kept = lines.slice(0, MAX_LINES);
    kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1].replace(/\s+$/, '')}${ELLIPSIS}`;
    return kept;
  }

  return lines;
}

function fitWord(ctx: CanvasRenderingContext2D, word: string, maxWidth: number, lines: string[]) {
  let rest = word;
  while (ctx.measureText(rest).width > maxWidth) {
    let cut = rest.length - 1;
    while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return rest;
}

function buildFont(size: number, fontFamily: string, weight = 400) {
  return `${weight} ${size}px ${fontFamily}`;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement | undefined>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(undefined);
    image.src = url;
  });
}
