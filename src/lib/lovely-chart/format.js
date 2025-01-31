import { MONTHS, WEEK_DAYS, WEEK_DAYS_SHORT } from './constants';

export function statsFormatDayHour(labels) {
  return labels.map((value) => ({
    value,
    text: `${value}:00`,
  }));
}

export function statsFormatDayHourFull(value) {
  return `${value}:00`;
}

export function statsFormatDay(labels) {
  return labels.map((value) => {
    const date = new Date(value);
    const day = date.getDate();
    const month = MONTHS[date.getMonth()];

    return ({
      value,
      text: `${day} ${month}`,
    });
  });
}

export function statsFormatMin(labels) {
  return labels.map((value) => ({
    value,
    text: new Date(value).toString().match(/(\d+:\d+):/)[1],
  }));
}

export function statsFormatText(labels) {
  return labels.map((value, i) => {
    return ({
      value: i,
      text: value,
    });
  });
}

export function humanize(value, decimals = 1) {
  if (value >= 1e6) {
    return keepThreeDigits(value / 1e6, decimals) + 'M';
  } else if (value >= 1e3) {
    return keepThreeDigits(value / 1e3, decimals) + 'K';
  }

  return value;
}

// TODO perf
function keepThreeDigits(value, decimals) {
  return value
    .toFixed(decimals)
    .replace(/(\d{3,})\.\d+/, '$1')
    .replace(/\.0+$/, '');
}

export function formatInteger(n) {
  return String(n).replace(/\d(?=(\d{3})+$)/g, '$& ');
}

export function formatCryptoValue(n) {
  return Number(n / 10 ** 9);
}

export function getFullLabelDate(label, { isShort = false } = {}) {
  return getLabelDate(label, { isShort, displayWeekDay: true });
}

export function getLabelDate(label, { isShort = false, displayWeekDay = false, displayYear = true, displayHours = false } = {}) {
  const { value } = label;
  const date = new Date(value);
  const weekDaysArray = isShort ? WEEK_DAYS_SHORT : WEEK_DAYS;

  let string = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  if (displayWeekDay) {
    string = `${weekDaysArray[date.getUTCDay()]}, ` + string;
  }
  if (displayYear) {
    string += ` ${date.getUTCFullYear()}`;
  }
  if (displayHours) {
    string += `, ${('0' + date.getUTCHours()).slice(-2)}:${('0' + date.getUTCMinutes()).slice(-2)}`
  }

  return string;
}

export function getLabelTime(label) {
  return new Date(label.value).toString().match(/(\d+:\d+):/)[1];
}
