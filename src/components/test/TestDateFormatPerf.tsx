import { useEffect, useState } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import {
  formatDateTimeToString as oldFormatDateTimeToString,
  formatDateToString as oldFormatDateToString,
  formatPastTimeShort as oldFormatPastTimeShort,
  formatTime as oldFormatTime,
} from '../../util/dates/oldDateFormat';
import { formatDateTime } from '../../util/localization/dateFormat';

import useLang from '../../hooks/useLang';
import useOldLang, { type OldLangFn } from '../../hooks/useOldLang';

const BENCHMARK_COUNT = 10000;
const RANDOM_SEED = 123456789;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type NewLangFn = ReturnType<typeof useLang>;
type BenchmarkFormatter = (date: Date) => string;
type BenchmarkCase = {
  name: string;
  oldFormatter: BenchmarkFormatter;
  newFormatter: BenchmarkFormatter;
};
type Measurement = {
  totalMs: number;
  perCallMs: number;
  checksum: number;
  sample: string;
};
type BenchmarkResult = {
  name: string;
  old: Measurement;
  new: Measurement;
};

function createSeededRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function generateRandomDates(count: number, now: Date) {
  const random = createSeededRandom(RANDOM_SEED);
  const dates: Date[] = [];

  for (let i = 0; i < count; i++) {
    const bucket = random();
    let offsetMs: number;

    if (bucket < 0.45) {
      offsetMs = -Math.floor(random() * DAY_IN_MS);
    } else if (bucket < 0.8) {
      offsetMs = -Math.floor(random() * 7 * DAY_IN_MS);
    } else if (bucket < 0.97) {
      offsetMs = -Math.floor((7 + random() * 358) * DAY_IN_MS);
    } else {
      offsetMs = Math.floor(random() * 2 * DAY_IN_MS);
    }

    dates.push(new Date(now.getTime() + offsetMs));
  }

  return dates;
}

function getDayStart(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatPastTimeShortWithNewCore(lang: NewLangFn, date: Date) {
  const time = formatDateTime(lang, date, { time: 'short' });

  const today = getDayStart(new Date());
  if (date >= today) {
    return time;
  }

  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  if (date >= weekAgo) {
    return formatDateTime(lang, date, { weekday: 'short' });
  }

  return formatDateTime(lang, date, {
    date: 'short',
    includeYear: date.getFullYear() === today.getFullYear() ? false : undefined,
  });
}

function createBenchmarkCases(oldLang: OldLangFn, lang: NewLangFn): BenchmarkCase[] {
  return [
    {
      name: 'time short',
      oldFormatter: (date) => oldFormatTime(oldLang, date),
      newFormatter: (date) => formatDateTime(lang, date, { time: 'short' }),
    },
    {
      name: 'past time short',
      oldFormatter: (date) => oldFormatPastTimeShort(oldLang, date),
      newFormatter: (date) => formatPastTimeShortWithNewCore(lang, date),
    },
    {
      name: 'date short',
      oldFormatter: (date) => oldFormatDateToString(date, oldLang.code, false, 'short'),
      newFormatter: (date) => formatDateTime(lang, date, { date: 'short' }),
    },
    {
      name: 'date + time short',
      oldFormatter: (date) => oldFormatDateTimeToString(date, oldLang.code, true, oldLang.timeFormat),
      newFormatter: (date) => formatDateTime(lang, date, { date: 'short', time: 'short' }),
    },
  ];
}

function measureFormatting(dates: Date[], formatter: BenchmarkFormatter): Measurement {
  let checksum = 0;
  let sample = '';

  const start = performance.now();
  for (let i = 0; i < dates.length; i++) {
    const value = formatter(dates[i]);

    if (!sample) {
      sample = value;
    }

    checksum = ((checksum * 33) + value.length + value.charCodeAt(0)) >>> 0;
  }
  const totalMs = performance.now() - start;

  return {
    totalMs,
    perCallMs: totalMs / dates.length,
    checksum,
    sample,
  };
}

function warmUp(dates: Date[], formatter: BenchmarkFormatter) {
  const warmUpCount = Math.min(250, dates.length);

  for (let i = 0; i < warmUpCount; i++) {
    formatter(dates[i]);
  }
}

function summarizeDates(dates: Date[]) {
  const today = getDayStart(new Date()).getTime();
  const weekAgo = today - (7 * DAY_IN_MS);

  let todayCount = 0;
  let lastWeekCount = 0;
  let olderCount = 0;
  let futureCount = 0;

  for (let i = 0; i < dates.length; i++) {
    const timestamp = dates[i].getTime();

    if (timestamp >= today) {
      if (timestamp >= Date.now()) {
        futureCount++;
      } else {
        todayCount++;
      }
      continue;
    }

    if (timestamp >= weekAgo) {
      lastWeekCount++;
      continue;
    }

    olderCount++;
  }

  return {
    today: todayCount,
    lastWeek: lastWeekCount,
    older: olderCount,
    future: futureCount,
  };
}

function logBenchmarkResults(
  lang: NewLangFn,
  oldLang: OldLangFn,
  now: Date,
  dates: Date[],
  results: BenchmarkResult[],
) {
  const formattedResults = Object.fromEntries(results.map((result) => {
    return [result.name, {
      old: {
        totalMs: Number(result.old.totalMs.toFixed(2)),
        perCallMs: Number(result.old.perCallMs.toFixed(8)),
        checksum: result.old.checksum,
        sample: result.old.sample,
      },
      new: {
        totalMs: Number(result.new.totalMs.toFixed(2)),
        perCallMs: Number(result.new.perCallMs.toFixed(8)),
        checksum: result.new.checksum,
        sample: result.new.sample,
      },
      newVsOld: Number((result.new.totalMs / result.old.totalMs).toFixed(2)),
    }];
  }));
  const label = [
    '[TestDateFormatPerf]',
    `lang=${lang.code}`,
    `oldLang=${oldLang.code}`,
    `timeFormat=${lang.timeFormat}`,
    `N=${BENCHMARK_COUNT}`,
  ].join(' ');

  // eslint-disable-next-line no-console
  console.group(label);
  // eslint-disable-next-line no-console
  console.log('dataset', {
    seed: RANDOM_SEED,
    generatedAt: now.toISOString(),
    distribution: summarizeDates(dates),
  });
  // eslint-disable-next-line no-console
  console.log('results', formattedResults);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

const TestDateFormatPerf = () => {
  const lang = useLang();
  const oldLang = useOldLang();

  const [lastRunAt, setLastRunAt] = useState<string>();
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    let isActive = true;

    const runBenchmarks = () => {
      const now = new Date();
      const dates = generateRandomDates(BENCHMARK_COUNT, now);
      const benchmarkCases = createBenchmarkCases(oldLang, lang);

      const results: BenchmarkResult[] = benchmarkCases.map((benchmarkCase) => {
        warmUp(dates, benchmarkCase.oldFormatter);
        warmUp(dates, benchmarkCase.newFormatter);

        return {
          name: benchmarkCase.name,
          old: measureFormatting(dates, benchmarkCase.oldFormatter),
          new: measureFormatting(dates, benchmarkCase.newFormatter),
        };
      });

      logBenchmarkResults(lang, oldLang, now, dates, results);

      if (isActive) {
        setLastRunAt(new Date().toLocaleTimeString());
      }
    };

    const frameId = window.requestAnimationFrame(runBenchmarks);

    return () => {
      isActive = false;

      if (frameId !== undefined) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [lang, oldLang, runId]);

  return (
    <div className={buildClassName('full-height', 'custom-scroll')}>
      <h2>Date Format Perf</h2>
      <p>Generates 10,000 random dates, benchmarks old and new formatting paths, and prints results to the console.</p>
      <p>
        Current context:
        {' '}
        <code>{`${lang.code} / ${lang.timeFormat}`}</code>
      </p>
      <p>
        Benchmarks:
        {' '}
        <code>formatTime</code>
        {', '}
        <code>formatPastTimeShort</code>
        {', '}
        <code>date short</code>
        {', '}
        <code>date + time short</code>
      </p>
      {lastRunAt && (
        <p>
          Last run:
          {' '}
          <code>{lastRunAt}</code>
        </p>
      )}
      <button type="button" onClick={() => setRunId((current) => current + 1)}>
        Run benchmark again
      </button>
    </div>
  );
};

export default TestDateFormatPerf;
