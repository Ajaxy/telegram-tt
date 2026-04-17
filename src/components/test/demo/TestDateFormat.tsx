import type { FormatDateTimeOptions } from '../../../util/localization/dateFormat';

import buildClassName from '../../../util/buildClassName';
import { formatDateTime, formatMessageListDate } from '../../../util/localization/dateFormat';

import useLang from '../../../hooks/useLang';

import styles from './TestDateFormat.module.scss';

type Row = {
  label: string;
  value: string;
};

const ANCHOR_DATE = new Date(2026, 2, 16, 12, 34, 56);
const ANCHOR_TIMESTAMP = ANCHOR_DATE.getTime();

const ABSOLUTE_CASES: Array<{ label: string; options: FormatDateTimeOptions }> = [
  { label: 'default', options: {} },
  { label: 'date: numeric', options: { date: 'numeric' } },
  { label: 'date: short', options: { date: 'short' } },
  { label: 'date: long', options: { date: 'long' } },
  { label: 'date: short, no year', options: { date: 'short', includeYear: false } },
  { label: 'date: short, no day', options: { date: 'short', includeDay: false } },
  { label: 'date: long, no year', options: { date: 'long', includeYear: false } },
  { label: 'date: long, no day', options: { date: 'long', includeDay: false } },
  { label: 'time: short', options: { time: 'short' } },
  { label: 'time: long', options: { time: 'long' } },
  { label: 'weekday: short', options: { weekday: 'short' } },
  { label: 'weekday: long', options: { weekday: 'long' } },
  { label: 'weekday: short + date: short', options: { weekday: 'short', date: 'short' } },
  { label: 'weekday: long + date: long', options: { weekday: 'long', date: 'long' } },
  { label: 'weekday: short + time: short', options: { weekday: 'short', time: 'short' } },
  { label: 'date: short + time: short', options: { date: 'short', time: 'short' } },
  { label: 'date: short + time: long', options: { date: 'short', time: 'long' } },
  { label: 'date: long + time: short', options: { date: 'long', time: 'short' } },
  { label: 'date: long + time: long', options: { date: 'long', time: 'long' } },
  {
    label: 'weekday + date: short + time: short',
    options: { weekday: 'short', date: 'short', time: 'short' },
  },
  {
    label: 'weekday: long + date: long + time: long',
    options: { weekday: 'long', date: 'long', time: 'long' },
  },
];

const RELATIVE_CASES: Array<{ label: string; startDate: Date; anchorDate?: Date }> = [
  { label: '30 seconds later', startDate: new Date(2026, 2, 16, 12, 35, 26) },
  { label: '5 minutes later', startDate: new Date(2026, 2, 16, 12, 39, 56) },
  { label: '3 hours later', startDate: new Date(2026, 2, 16, 15, 34, 56) },
  { label: 'tomorrow', startDate: new Date(2026, 2, 17, 12, 34, 56) },
  { label: '2 days later', startDate: new Date(2026, 2, 18, 12, 34, 56) },
  { label: '10 days later', startDate: new Date(2026, 2, 26, 12, 34, 56) },
  { label: '45 seconds earlier', startDate: new Date(2026, 2, 16, 12, 34, 11) },
  { label: '2 hours earlier', startDate: new Date(2026, 2, 16, 10, 34, 56) },
  { label: 'yesterday', startDate: new Date(2026, 2, 15, 12, 34, 56) },
  { label: '3 days earlier', startDate: new Date(2026, 2, 13, 12, 34, 56) },
  {
    label: '25 hours later, but 2 calendar days later',
    anchorDate: new Date(2026, 2, 16, 23, 0, 0),
    startDate: new Date(2026, 2, 18, 0, 0, 0),
  },
  {
    label: '25 hours earlier, but 2 calendar days earlier',
    anchorDate: new Date(2026, 2, 16, 1, 0, 0),
    startDate: new Date(2026, 2, 14, 0, 0, 0),
  },
];
const MESSAGE_LIST_CASES: Array<{ label: string; date: Date; anchorDate?: Date }> = [
  { label: 'today', date: new Date(2026, 2, 16, 9, 0, 0) },
  { label: 'yesterday', date: new Date(2026, 2, 15, 23, 0, 0) },
  { label: '3 days earlier', date: new Date(2026, 2, 13, 12, 0, 0) },
  { label: '8 days earlier', date: new Date(2026, 2, 8, 12, 0, 0) },
  { label: 'same year, older date', date: new Date(2026, 0, 14, 12, 0, 0) },
  { label: 'different year', date: new Date(2025, 0, 14, 12, 0, 0) },
  {
    label: 'yesterday across year boundary',
    anchorDate: new Date(2026, 0, 1, 12, 0, 0),
    date: new Date(2025, 11, 31, 12, 0, 0),
  },
];

function DebugTable({ rows }: { rows: Row[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.cell}>Case</th>
          <th className={styles.cell}>Output</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, value }) => (
          <tr key={label}>
            <td className={styles.cell}><code className={styles.code}>{label}</code></td>
            <td className={styles.cell}><code className={styles.code}>{value}</code></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const DateFormatTest = () => {
  const lang = useLang();
  const languageInfo = lang.languageInfo;

  const absoluteRows: Row[] = ABSOLUTE_CASES.map(({ label, options }) => ({
    label,
    value: formatDateTime(lang, ANCHOR_DATE, options),
  }));

  const relativeRows: Row[] = RELATIVE_CASES.map(({ label, startDate, anchorDate }) => {
    const startDateLabel = startDate.toLocaleString();
    const effectiveAnchorDate = anchorDate || ANCHOR_DATE;
    const anchorDateLabel = anchorDate ? `; anchor ${anchorDate.toLocaleString()}` : '';

    return {
      label: `${label} (${startDateLabel}${anchorDateLabel})`,
      value: formatDateTime(lang, startDate, { relative: 'auto', anchorDate: effectiveAnchorDate }),
    };
  });
  const messageListRows: Row[] = MESSAGE_LIST_CASES.map(({ label, date, anchorDate }) => {
    const effectiveAnchorDate = anchorDate || ANCHOR_DATE;
    const anchorDateLabel = anchorDate ? `; anchor ${anchorDate.toLocaleString()}` : '';

    return {
      label: `${label} (${date.toLocaleString()}${anchorDateLabel})`,
      value: formatMessageListDate(lang, date, { anchorDate: effectiveAnchorDate }),
    };
  });

  const contextRows: Row[] = [
    { label: 'lang.code', value: lang.code },
    { label: 'lang.rawCode', value: lang.rawCode },
    { label: 'lang.languageInfo ready', value: String(Boolean(languageInfo)) },
    { label: 'lang.languageInfo.pluralCode', value: languageInfo?.pluralCode || '' },
    { label: 'lang.timeFormat', value: lang.timeFormat },
    { label: 'anchorDate.toString()', value: ANCHOR_DATE.toString() },
    { label: 'anchorDate.toISOString()', value: ANCHOR_DATE.toISOString() },
    { label: 'anchorDate.getTime()', value: String(ANCHOR_TIMESTAMP) },
  ];

  return (
    <div className={buildClassName(styles.root, 'full-height', 'custom-scroll')}>
      <h2>Date Format Test</h2>
      <p>Formats one fixed date through the new localized date formatter in as many useful combinations as possible.</p>

      <h3>Context</h3>
      <DebugTable rows={contextRows} />

      <h3>Absolute Options</h3>
      <DebugTable rows={absoluteRows} />

      <h3>Relative Formatting</h3>
      <DebugTable rows={relativeRows} />

      <h3>Message List Date Formatting</h3>
      <DebugTable rows={messageListRows} />
    </div>
  );
};

export default DateFormatTest;
