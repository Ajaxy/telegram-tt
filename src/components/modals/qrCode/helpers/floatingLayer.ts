// Adapted from https://github.com/telegramdesktop/tdesktop/blob/dev/Telegram/SourceFiles/ui/effects/peer_qr_layer.cpp,
// peer_qr_emoji_field.cpp and peer_qr_gift_field.cpp

import { clamp } from '../../../../util/math';

export type LayerRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

export type LayerItem = {
  key: string;
  row: number;
  column: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  delay: number;
  pick: number;
};

type LayerPlace = Point & {
  scale: number;
};

type Glide = {
  from: Point;
  directionX: number;
  directionY: number;
  speed: number;
  startedAt: number;
  duration: number;
};

type Sample = Point & {
  time: number;
};

const FALLOFF_MIN = 0.15;
const TABLE_SIZE = 64;
const HEADING = (225 * Math.PI) / 180;
const WANDER_AMPLITUDE = 1.2;
const WANDER_SPEED = 0.025;
const WANDER_SLOW_AMPLITUDE = 0.6;
const WANDER_SLOW_SPEED = 0.016;
const WANDER_SLOW_PHASE = 1;
const DRIFT_SPEED = 6;
const DRIFT_STEP = 1000;
const DRIFT_RESUME_DELAY = 1700;
const DRIFT_RESUME_RAMP = 500;
const GLIDE_HALF_LIFE = 250;
const GLIDE_BRAKE = 9;
const GLIDE_MAX = 900;
const GLIDE_RATE = (Math.LN2 * 1000) / GLIDE_HALF_LIFE;
const VELOCITY_WINDOW = 100;
const DRAG_THRESHOLD = 6;
const STOP_GAP = 40;
const LAYER_BAND = 98;
const SCALE_CUTOFF = 0.05;
const CARD_SHRINK = 0.03;

const EMOJI_SKIP_X = 80;
const EMOJI_SKIP_Y = 66;
const EMOJI_SIZE = 32;
const EMOJI_OFFSET_MIN = 3;
const EMOJI_OFFSET_MAX = 10;
const EMOJI_BOB = 3;
const EMOJI_EMPTY_SHARE = 0.2;
const EMOJI_BIG_TIER = 1.17;
const EMOJI_SMALL_TIER = 0.9;
const EMOJI_SCALE_MIN = 0.92;
const EMOJI_SCALE_MAX = 1.08;
const EMOJI_TILT_MAX = 13;
const EMOJI_SWAY_ANGLE = 4;
const EMOJI_SWAY_SPEED = 0.3;
const EMOJI_BOB_SPEED = 0.45;

const GIFT_MODEL_SIZE = 78;
const GIFT_MODEL_SKIP_X = 150;
const GIFT_MODEL_SKIP_Y = 132;
const GIFT_MODEL_OFFSET = 16;
const GIFT_MODEL_SCALE_MIN = 0.93;
const GIFT_MODEL_SCALE_MAX = 1.07;
const GIFT_MODEL_TILT = 11;
const GIFT_SYMBOL_SIZE = 20;
const GIFT_SYMBOL_SKIP_X = 39;
const GIFT_SYMBOL_SKIP_Y = 33;
const GIFT_SYMBOL_JITTER_X = 17;
const GIFT_SYMBOL_JITTER_Y = 14;
const GIFT_SYMBOL_SCALE_MIN = 0.75;
const GIFT_SYMBOL_SCALE_RANGE = 0.5;
const GIFT_SYMBOL_EMPTY_SHARE = 0.39;
const GIFT_CLEARANCE = 0.8;

export const MAX_EMOJI_ITEM_SIZE = EMOJI_SIZE * EMOJI_BIG_TIER * EMOJI_SCALE_MAX;
export const MAX_GIFT_MODEL_SIZE = GIFT_MODEL_SIZE * GIFT_MODEL_SCALE_MAX;
export const MAX_GIFT_SYMBOL_SIZE = GIFT_SYMBOL_SIZE * (GIFT_SYMBOL_SCALE_MIN + GIFT_SYMBOL_SCALE_RANGE);

const UINT32_RANGE = 4294967296;

enum Salt {
  EmojiEmpty = 1,
  EmojiScale,
  EmojiTilt,
  EmojiRadius,
  EmojiAngle,
  EmojiSway,
  EmojiBob,
  EmojiDelay,
  ModelRadius = 101,
  ModelAngle,
  ModelScale,
  ModelTilt,
  ModelDelay,
  SymbolEmpty,
  SymbolX,
  SymbolY,
  SymbolHeight,
  SymbolDelay,
}

const INTEGRALS = buildIntegralTable();

export class LayerMotion {
  private offset: Point = { x: 0, y: 0 };

  private pressPosition: Point = { x: 0, y: 0 };

  private pressOffset: Point = { x: 0, y: 0 };

  private samples: Sample[] = [];

  private isPressed = false;

  private isDragging = false;

  private glide?: Glide;

  private restSince = 0;

  private driftElapsed = 0;

  private startedAt = 0;

  // Layers sharing the motion during a theme change keep the same clock
  getElapsed(now: number) {
    this.startedAt ||= now;
    return now - this.startedAt;
  }

  getOffset() {
    return this.offset;
  }

  getIsAnimating() {
    return this.isDragging || Boolean(this.glide);
  }

  press(position: Point, now: number) {
    this.advanceGlide(now);
    if (this.glide) {
      this.glide = undefined;
      this.restSince = now;
    }
    this.pressPosition = position;
    this.pressOffset = this.offset;
    this.samples = [{ ...position, time: now }];
    this.isPressed = true;
    this.isDragging = false;
  }

  move(position: Point, now: number) {
    if (!this.isPressed) return;

    if (!this.isDragging && Math.hypot(
      position.x - this.pressPosition.x, position.y - this.pressPosition.y,
    ) >= DRAG_THRESHOLD) {
      this.isDragging = true;
      this.pressOffset = this.offset;
    }
    if (this.isDragging) {
      this.offset = {
        x: this.pressOffset.x + position.x - this.pressPosition.x,
        y: this.pressOffset.y + position.y - this.pressPosition.y,
      };
    }

    this.samples.push({ ...position, time: now });
    this.samples = this.samples.filter(({ time }) => time >= now - VELOCITY_WINDOW);
  }

  // Returns whether the press turned into a drag
  release(now: number, noGlide?: boolean) {
    const wasDragging = this.isPressed && this.isDragging;
    this.isPressed = false;
    this.isDragging = false;
    if (!wasDragging) return false;

    const velocity = this.getReleaseVelocity(now);
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed <= 0 || noGlide) {
      this.restSince = now;
      return true;
    }

    const start = Math.min(speed, GLIDE_MAX);
    this.glide = {
      from: this.offset,
      directionX: velocity.x / speed,
      directionY: velocity.y / speed,
      speed: start,
      startedAt: now,
      duration: (Math.log(1 + (GLIDE_RATE * start) / GLIDE_BRAKE) / GLIDE_RATE) * 1000,
    };

    return true;
  }

  advance(now: number, elapsed: number) {
    this.advanceGlide(now);
    this.driftElapsed = Math.min(this.driftElapsed, elapsed);

    const scale = this.getDriftScale(now);
    while (this.driftElapsed < elapsed) {
      const step = Math.min(elapsed - this.driftElapsed, DRIFT_STEP);
      const middle = (this.driftElapsed + step / 2) / 1000;
      const wander = WANDER_AMPLITUDE * Math.sin(WANDER_SPEED * middle)
        + WANDER_SLOW_AMPLITUDE * Math.sin(WANDER_SLOW_SPEED * middle + WANDER_SLOW_PHASE);
      const heading = HEADING + wander;
      const distance = ((DRIFT_SPEED * step) / 1000) * scale;
      this.offset = {
        x: this.offset.x + Math.cos(heading) * distance,
        y: this.offset.y + Math.sin(heading) * distance,
      };
      this.driftElapsed += step;
    }
  }

  private getReleaseVelocity(now: number): Point {
    const samples = this.samples.filter(({ time }) => time >= now - VELOCITY_WINDOW);
    if (samples.length < 2) return { x: 0, y: 0 };

    const first = samples[0];
    const last = samples[samples.length - 1];
    if (last.time < now - STOP_GAP || last.time === first.time) return { x: 0, y: 0 };

    const ratio = 1000 / (last.time - first.time);
    return { x: (last.x - first.x) * ratio, y: (last.y - first.y) * ratio };
  }

  private getDriftScale(now: number) {
    if (this.isDragging || this.glide) return 0;
    if (!this.restSince) return 1;

    const resumeAt = this.restSince + DRIFT_RESUME_DELAY;
    if (now <= resumeAt) return 0;

    const progress = Math.min((now - resumeAt) / DRIFT_RESUME_RAMP, 1);
    return -(Math.cos(Math.PI * progress) - 1) / 2;
  }

  private advanceGlide(now: number) {
    const glide = this.glide;
    if (!glide) return;

    const terminal = GLIDE_BRAKE / GLIDE_RATE;
    const passed = clamp(now - glide.startedAt, 0, glide.duration);
    const t = passed / 1000;
    const distance = ((glide.speed + terminal) * (1 - Math.exp(-GLIDE_RATE * t))) / GLIDE_RATE - terminal * t;
    this.offset = {
      x: glide.from.x + glide.directionX * distance,
      y: glide.from.y + glide.directionY * distance,
    };

    if (passed >= glide.duration) {
      this.restSince = glide.startedAt + glide.duration;
      this.glide = undefined;
    }
  }
}

export function enumerateEmojiItems(area: LayerRect, origin: Point, count: number, seconds: number) {
  const items: LayerItem[] = [];
  if (!count) return items;

  const reach = getReach(area, EMOJI_OFFSET_MAX + EMOJI_BOB + MAX_EMOJI_ITEM_SIZE / 2);
  const rowFrom = Math.ceil((reach.top - origin.y) / EMOJI_SKIP_Y);
  const rowTill = Math.floor((reach.top + reach.height - origin.y) / EMOJI_SKIP_Y);
  for (let row = rowFrom; row <= rowTill; row++) {
    const isOdd = (row & 1) !== 0;
    const shift = isOdd ? 0.5 : 0;
    const tier = isOdd ? EMOJI_SMALL_TIER : EMOJI_BIG_TIER;
    const columnFrom = Math.ceil((reach.left - origin.x) / EMOJI_SKIP_X - shift);
    const columnTill = Math.floor((reach.left + reach.width - origin.x) / EMOJI_SKIP_X - shift);
    for (let column = columnFrom; column <= columnTill; column++) {
      const random = (salt: Salt) => getNodeRandom(row, column, salt);
      if (random(Salt.EmojiEmpty) < EMOJI_EMPTY_SHARE) continue;

      const radius = EMOJI_OFFSET_MIN + (EMOJI_OFFSET_MAX - EMOJI_OFFSET_MIN) * random(Salt.EmojiRadius);
      const angle = 2 * Math.PI * random(Salt.EmojiAngle);
      const bob = EMOJI_BOB * Math.sin(EMOJI_BOB_SPEED * seconds + 2 * Math.PI * random(Salt.EmojiBob));
      const size = EMOJI_SIZE * tier
        * (EMOJI_SCALE_MIN + (EMOJI_SCALE_MAX - EMOJI_SCALE_MIN) * random(Salt.EmojiScale));
      const place = placeItem(area, {
        x: origin.x + (column + shift) * EMOJI_SKIP_X + radius * Math.cos(angle),
        y: origin.y + row * EMOJI_SKIP_Y + radius * Math.sin(angle) + bob,
      }, size);
      if (!place) continue;

      const tilt = EMOJI_TILT_MAX * (2 * random(Salt.EmojiTilt) - 1);
      const sway = EMOJI_SWAY_ANGLE * Math.sin(EMOJI_SWAY_SPEED * seconds + 2 * Math.PI * random(Salt.EmojiSway));
      items.push({
        key: `${row}:${column}`,
        row,
        column,
        x: place.x,
        y: place.y,
        size: size * place.scale,
        rotation: tilt + sway,
        delay: random(Salt.EmojiDelay),
        pick: getPickIndex(row, column, count),
      });
    }
  }

  return items;
}

export function enumerateGiftModels(area: LayerRect, origin: Point) {
  const items: LayerItem[] = [];
  const reach = getReach(area, GIFT_MODEL_OFFSET + MAX_GIFT_MODEL_SIZE / Math.SQRT2);
  const rowFrom = Math.ceil((reach.top - origin.y) / GIFT_MODEL_SKIP_Y);
  const rowTill = Math.floor((reach.top + reach.height - origin.y) / GIFT_MODEL_SKIP_Y);
  for (let row = rowFrom; row <= rowTill; row++) {
    const shift = (row & 1) ? 0.5 : 0;
    const columnFrom = Math.ceil((reach.left - origin.x) / GIFT_MODEL_SKIP_X - shift);
    const columnTill = Math.floor((reach.left + reach.width - origin.x) / GIFT_MODEL_SKIP_X - shift);
    for (let column = columnFrom; column <= columnTill; column++) {
      const { flat, size } = getModelFlat(row, column, origin);
      const place = placeItem(area, flat, size);
      if (!place) continue;

      items.push({
        key: `${row}:${column}`,
        row,
        column,
        x: place.x,
        y: place.y,
        size: size * place.scale,
        rotation: GIFT_MODEL_TILT * (2 * getNodeRandom(row, column, Salt.ModelTilt) - 1),
        delay: getNodeRandom(row, column, Salt.ModelDelay),
        pick: 0,
      });
    }
  }

  return items;
}

export function enumerateGiftSymbols(area: LayerRect, origin: Point) {
  const items: LayerItem[] = [];
  const reach = getReach(area, Math.max(GIFT_SYMBOL_JITTER_X, GIFT_SYMBOL_JITTER_Y) + MAX_GIFT_SYMBOL_SIZE / 2);
  const rowFrom = Math.ceil((reach.top - origin.y) / GIFT_SYMBOL_SKIP_Y);
  const rowTill = Math.floor((reach.top + reach.height - origin.y) / GIFT_SYMBOL_SKIP_Y);
  for (let row = rowFrom; row <= rowTill; row++) {
    const shift = (row & 1) ? 0.5 : 0;
    const columnFrom = Math.ceil((reach.left - origin.x) / GIFT_SYMBOL_SKIP_X - shift);
    const columnTill = Math.floor((reach.left + reach.width - origin.x) / GIFT_SYMBOL_SKIP_X - shift);
    for (let column = columnFrom; column <= columnTill; column++) {
      const random = (salt: Salt) => getNodeRandom(row, column, salt);
      if (random(Salt.SymbolEmpty) < GIFT_SYMBOL_EMPTY_SHARE) continue;

      const flat = {
        x: origin.x + (column + shift) * GIFT_SYMBOL_SKIP_X + GIFT_SYMBOL_JITTER_X * (2 * random(Salt.SymbolX) - 1),
        y: origin.y + row * GIFT_SYMBOL_SKIP_Y + GIFT_SYMBOL_JITTER_Y * (2 * random(Salt.SymbolY) - 1),
      };
      const height = random(Salt.SymbolHeight);
      const size = GIFT_SYMBOL_SIZE * (GIFT_SYMBOL_SCALE_MIN + GIFT_SYMBOL_SCALE_RANGE * height * height);
      const place = placeItem(area, flat, size);
      if (!place || getIsNearModel(flat, size, origin)) continue;

      items.push({
        key: `${row}:${column}`,
        row,
        column,
        x: place.x,
        y: place.y,
        size: size * place.scale,
        rotation: 0,
        delay: random(Salt.SymbolDelay),
        pick: 0,
      });
    }
  }

  return items;
}

// The card's corner radius is unknown here, so an item inside the ellipse inscribed in the card counts as covered
export function getIsCoveredByCard(card: LayerRect, x: number, y: number, size: number) {
  const width = card.width * (1 - CARD_SHRINK);
  const height = card.height * (1 - CARD_SHRINK);
  if (width <= 0 || height <= 0) return false;

  const radius = size / Math.SQRT2;
  const ratioX = (Math.abs(x - (card.left + card.width / 2)) + radius) / (width / 2);
  const ratioY = (Math.abs(y - (card.top + card.height / 2)) + radius) / (height / 2);
  return ratioX * ratioX + ratioY * ratioY <= 1;
}

function getModelFlat(row: number, column: number, origin: Point) {
  const random = (salt: Salt) => getNodeRandom(row, column, salt);
  const shift = (row & 1) ? 0.5 : 0;
  const radius = GIFT_MODEL_OFFSET * random(Salt.ModelRadius);
  const angle = 2 * Math.PI * random(Salt.ModelAngle);

  return {
    flat: {
      x: origin.x + (column + shift) * GIFT_MODEL_SKIP_X + radius * Math.cos(angle),
      y: origin.y + row * GIFT_MODEL_SKIP_Y + radius * Math.sin(angle),
    },
    size: GIFT_MODEL_SIZE
      * (GIFT_MODEL_SCALE_MIN + (GIFT_MODEL_SCALE_MAX - GIFT_MODEL_SCALE_MIN) * random(Salt.ModelScale)),
  };
}

function getIsNearModel(flat: Point, size: number, origin: Point) {
  const rowNear = Math.round((flat.y - origin.y) / GIFT_MODEL_SKIP_Y);
  for (let row = rowNear - 1; row <= rowNear + 1; row++) {
    const shift = (row & 1) ? 0.5 : 0;
    const columnNear = Math.round((flat.x - origin.x) / GIFT_MODEL_SKIP_X - shift);
    for (let column = columnNear - 1; column <= columnNear + 1; column++) {
      const model = getModelFlat(row, column, origin);
      const clearance = (GIFT_CLEARANCE * (model.size + size)) / 2;
      if (Math.hypot(flat.x - model.flat.x, flat.y - model.flat.y) < clearance) return true;
    }
  }

  return false;
}

export function getPickIndex(row: number, column: number, count: number) {
  const q = column - (row - (row & 1)) / 2;
  const index = (q - row) % count;
  return index < 0 ? index + count : index;
}

function placeItem(area: LayerRect, flat: Point, size: number): LayerPlace | undefined {
  const x = mapAxis(flat.x, area.left + area.width / 2, area.width / 2);
  const y = mapAxis(flat.y, area.top + area.height / 2, area.height / 2);
  const scale = x.factor * y.factor;
  if (scale < SCALE_CUTOFF) return undefined;

  const extent = (size * scale) / Math.SQRT2;
  if (
    x.screen + extent < area.left || x.screen - extent > area.left + area.width
    || y.screen + extent < area.top || y.screen - extent > area.top + area.height
  ) {
    return undefined;
  }

  return { x: x.screen, y: y.screen, scale };
}

function getReach(area: LayerRect, margin: number): LayerRect {
  const getFlatHalf = (half: number) => getK(0) - getK(half) + margin;
  const halfX = getFlatHalf(area.width / 2);
  const halfY = getFlatHalf(area.height / 2);
  return {
    left: area.left + area.width / 2 - halfX,
    top: area.top + area.height / 2 - halfY,
    width: 2 * halfX,
    height: 2 * halfY,
  };
}

// Items shrink near the sides, and the factor follows the on-screen distance so the curve holds while dragging
function mapAxis(flat: number, center: number, half: number) {
  const shift = flat - center;
  const d = getKInverse(Math.abs(shift) + getK(half));
  const distance = half - d;
  return {
    screen: center + (shift < 0 ? -distance : distance),
    factor: d >= 0 ? getFactor(d / LAYER_BAND) : FALLOFF_MIN,
  };
}

function getFactor(t: number) {
  const u = clamp(t, 0, 1);
  return FALLOFF_MIN + (1 - FALLOFF_MIN) * u * u * (3 - 2 * u);
}

function buildIntegralTable() {
  const table = new Array<number>(TABLE_SIZE + 1).fill(0);
  const step = 1 / TABLE_SIZE;
  for (let i = TABLE_SIZE; i !== 0; i--) {
    const till = i * step;
    const from = till - step;
    const simpson = 1 / getFactor(from) + 4 / getFactor(from + step / 2) + 1 / getFactor(till);
    table[i - 1] = table[i] + (simpson * step) / 6;
  }

  return table;
}

function getIntegral(t: number) {
  const position = clamp(t, 0, 1) * TABLE_SIZE;
  const index = Math.min(Math.floor(position), TABLE_SIZE - 1);
  const fraction = position - index;
  return INTEGRALS[index] + (INTEGRALS[index + 1] - INTEGRALS[index]) * fraction;
}

function getIntegralInverse(value: number) {
  let firstSmaller = INTEGRALS.findIndex((integral) => integral <= value);
  if (firstSmaller === -1) firstSmaller = INTEGRALS.length;
  const till = clamp(firstSmaller, 1, TABLE_SIZE);
  const from = till - 1;
  const span = INTEGRALS[from] - INTEGRALS[till];
  const fraction = span > 0 ? (INTEGRALS[from] - value) / span : 0;
  return (from + clamp(fraction, 0, 1)) / TABLE_SIZE;
}

function getK(d: number) {
  if (d >= LAYER_BAND) return LAYER_BAND - d;
  if (d >= 0) return LAYER_BAND * getIntegral(d / LAYER_BAND);
  return LAYER_BAND * INTEGRALS[0] - d / FALLOFF_MIN;
}

function getKInverse(value: number) {
  const edge = LAYER_BAND * INTEGRALS[0];
  if (value <= 0) return LAYER_BAND - value;
  if (value <= edge) return LAYER_BAND * getIntegralInverse(value / LAYER_BAND);
  return (edge - value) * FALLOFF_MIN;
}

function getNodeRandom(row: number, column: number, salt: Salt) {
  return getNodeHash(row, column, salt) / UINT32_RANGE;
}

function getNodeHash(row: number, column: number, salt: number) {
  const seeded = getHash((Math.imul(salt, 0x9E3779B9) + row) >>> 0);
  return getHash((seeded ^ Math.imul(column, 0x85EBCA6B)) >>> 0);
}

function getHash(input: number) {
  let value = input >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7FEB352D) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846CA68B) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}
