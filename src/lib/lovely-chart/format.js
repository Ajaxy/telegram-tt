import { MONTHS, WEEK_DAYS, WEEK_DAYS_SHORT } from './constants';

export function buildDayLabels(labels) {
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

export function buildTimeLabels(labels) {
  return labels.map((value) => {
    const date = new Date(value);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();

    return ({
      value,
      text: `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`,
    });
  });
}

export function buildTextLabels(labels) {
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
    string += ` ${date.getUTCFullYear() + 1}`;
  }
  if (displayHours) {
    string += `, ${('0' + date.getUTCHours()).slice(-2)}:${('0' + date.getUTCMinutes()).slice(-2)}`
  }

  return string;
}
