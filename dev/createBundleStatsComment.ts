import type { context as githubContext, getOctokit } from '@actions/github';
import { existsSync, readFileSync } from 'fs';
import { pathToFileURL } from 'url';

type BundleAssetStats = {
  name: string;
  size: number;
};

type BundleChunkStats = {
  entry?: boolean;
  initial?: boolean;
  files?: string[];
};

type BundleStats = {
  assets?: BundleAssetStats[];
  chunks?: BundleChunkStats[];
};

type SizeStats = {
  label: string;
  size: number;
};

type EntryStats = SizeStats & {
  key: string;
};

type BundleKey = 'auth' | 'main' | 'extra' | 'calls' | 'stars';

type BundleDefinition = {
  key: BundleKey;
  label: string;
};

type ManualBundleStats = SizeStats & {
  key: BundleKey;
};

type FileTypeDefinition = {
  key: string;
  label: string;
  extensions?: readonly string[];
};

type FileTypeKey = (typeof FILE_TYPES)[number]['key'];

type FileTypeStats = {
  [Key in FileTypeKey]: {
    key: Key;
    label: string;
    size: number;
  };
}[FileTypeKey];

type DiffRow = {
  label: string;
  before: number;
  after: number;
  diff: number;
  percent?: number;
  status: string;
  diffText: string;
  percentText: string;
};

type CreateCommentOptions = {
  baselineStatsPath: string;
  currentStatsPath: string;
  reportUrl: string;
};

type GithubCore = {
  info: (message: string) => void;
};

type CreateBundleStatsCommentOptions = {
  github: ReturnType<typeof getOctokit>;
  context: typeof githubContext;
  core: GithubCore;
};

const COMMENT_MARKER = '<!-- telegram-bundle-stats-comment -->';
const DEFAULT_CURRENT_STATS_PATH = 'dist/bundle-stats/baseline.json';
const DEFAULT_BASELINE_STATS_PATH = 'reference-bundle-stats/baseline.json';
const DEFAULT_REPORT_URL = '';
const REGRESSION_WARNING_PERCENT = 1.5;
const BYTES_PER_KB = 1000;
const BYTES_PER_MB = BYTES_PER_KB * 1000;
const ZERO_SIZE = 0;
const DIFF_STATUS_GOOD = '🟢';
const DIFF_STATUS_WARN = '🔴';
const DIFF_STATUS_NEUTRAL = '⚪️';
const MAIN_ENTRY_KEY = 'main';
const MAIN_ENTRY_LABEL = '🏠 Main';
const ENTRY_ORDER = [
  MAIN_ENTRY_KEY,
  'gramjs-worker',
  'fasttext-worker',
  'media-worker',
  'shared-state-worker',
  'service-worker',
];
const MANUAL_BUNDLES: BundleDefinition[] = [
  { key: 'auth', label: '🔐 Auth' },
  { key: 'main', label: '🏠 Main' },
  { key: 'extra', label: '➕ Extra' },
  { key: 'calls', label: '📞 Calls' },
  { key: 'stars', label: '⭐ Stars' },
];
const MANUAL_BUNDLE_ASSET_EXTENSIONS = ['.js', '.css'];
const FILE_TYPES: FileTypeDefinition[] = [
  { key: 'js', label: '🟨 JS', extensions: ['.js', '.mjs', '.cjs'] },
  { key: 'css', label: '🎨 CSS', extensions: ['.css'] },
  { key: 'wasm', label: '⚙️ WASM', extensions: ['.wasm'] },
  { key: 'other', label: '📄 Other' },
];
const OTHER_FILE_TYPE = FILE_TYPES[FILE_TYPES.length - 1];

export default async function createBundleStatsComment({ github, context, core }: CreateBundleStatsCommentOptions) {
  const body = createCommentBody({
    baselineStatsPath: process.env.BASELINE_BUNDLE_STATS_PATH || DEFAULT_BASELINE_STATS_PATH,
    currentStatsPath: process.env.CURRENT_BUNDLE_STATS_PATH || DEFAULT_CURRENT_STATS_PATH,
    reportUrl: process.env.REPORT_URL || DEFAULT_REPORT_URL,
  });

  await upsertComment({ github, context, core, body });
}

export async function createBundleStatsPendingComment({ github, context, core }: CreateBundleStatsCommentOptions) {
  await upsertComment({ github, context, core, body: createPendingCommentBody() });
}

export function createCommentBody({ baselineStatsPath, currentStatsPath, reportUrl }: CreateCommentOptions) {
  const currentStats = readStats(currentStatsPath);
  const baselineStats = readStats(baselineStatsPath);

  if (!currentStats) {
    return [
      COMMENT_MARKER,
      '**Bundle stats diff with master**',
      '',
      `Current stats file was not found at \`${currentStatsPath}\`.`,
    ].join('\n');
  }

  const currentAnalysis = analyzeStats(currentStats);

  if (!baselineStats) {
    const entryRows = getCurrentEntryRows(currentAnalysis.entries);
    const bundleRows = getCurrentBundleRows(currentAnalysis.bundles);
    const fileTypeRows = getCurrentFileTypeRows(currentAnalysis.fileTypes);
    const lines = [
      COMMENT_MARKER,
      '**Bundle stats diff with master**',
      '',
      `Master baseline stats were not found at \`${baselineStatsPath}\`.`,
      `Current total bundle size: ${formatSize(currentAnalysis.totalSize)}`,
      '',
      '**📦 File type**',
      ...fileTypeRows.map(renderCurrentSizeLine),
      '',
      '**🚪 Entry point**',
      ...entryRows.map(renderCurrentSizeLine),
      '',
      '**🧩 Bundle**',
      ...bundleRows.map(renderCurrentSizeLine),
    ];
    return lines.join('\n');
  }

  const baselineAnalysis = analyzeStats(baselineStats);
  const entryRows = getEntryRows(baselineAnalysis.entries, currentAnalysis.entries);
  const bundleRows = getBundleRows(baselineAnalysis.bundles, currentAnalysis.bundles);
  const fileTypeRows = getFileTypeRows(baselineAnalysis.fileTypes, currentAnalysis.fileTypes);
  const totalRow = createDiffRow('📊 Total bundle', baselineAnalysis.totalSize, currentAnalysis.totalSize);

  const lines = [
    COMMENT_MARKER,
    '**Bundle stats diff with master**',
    '',
    renderDiffLine(totalRow),
  ];
  addDiffSection(lines, '**📦 File type**', fileTypeRows);
  addDiffSection(lines, '**🚪 Entry point**', entryRows);
  addDiffSection(lines, '**🧩 Bundle**', bundleRows);
  addReportLine(lines, reportUrl);
  return lines.join('\n');
}

function createPendingCommentBody() {
  return [
    COMMENT_MARKER,
    '**Bundle stats diff with master**',
    '',
    [
      '> [!NOTE]',
      '> Bundle size measuring is in progress.',
      '> This comment will be updated with the latest results when the build finishes.',
    ].join('\n'),
  ].join('\n');
}

function readStats(filepath: string): BundleStats | undefined {
  if (!existsSync(filepath)) return undefined;
  return JSON.parse(readFileSync(filepath, 'utf8')) as BundleStats;
}

function analyzeStats(stats: BundleStats) {
  const entries = new Map<string, EntryStats>();
  const bundles = createManualBundleStatsMap();
  const fileTypes = createFileTypeStatsMap();
  const chunkFiles = new Set(stats.chunks?.flatMap(({ files = [] }) => files) || []);
  const initialFiles = new Set(
    stats.chunks
      ?.filter(({ entry, initial }) => entry || initial)
      .flatMap(({ files = [] }) => files) || [],
  );

  let totalSize = ZERO_SIZE;
  let mainSize = ZERO_SIZE;

  stats.assets?.forEach(({ name, size }) => {
    if (isIgnoredAsset(name)) return;

    totalSize += size;
    addFileTypeSize(fileTypes, name, size);
    addManualBundleSize(bundles, name, size);

    const workerEntry = getWorkerEntry(name, chunkFiles);
    if (workerEntry) {
      const previousSize = entries.get(workerEntry.key)?.size || ZERO_SIZE;
      entries.set(workerEntry.key, {
        ...workerEntry,
        size: previousSize + size,
      });
      return;
    }

    if (initialFiles.has(name) || getStableAssetName(name) === 'index.css') {
      mainSize += size;
    }
  });

  entries.set(MAIN_ENTRY_KEY, {
    key: MAIN_ENTRY_KEY,
    label: MAIN_ENTRY_LABEL,
    size: mainSize,
  });

  return { entries, bundles, fileTypes, totalSize };
}

function getEntryRows(baselineEntries: Map<string, EntryStats>, currentEntries: Map<string, EntryStats>) {
  const keys = [...new Set([...baselineEntries.keys(), ...currentEntries.keys()])];

  return keys
    .map((key) => {
      const currentEntry = currentEntries.get(key);
      const baselineEntry = baselineEntries.get(key);
      const label = currentEntry?.label || baselineEntry?.label || key;
      return createDiffRow(label, baselineEntry?.size, currentEntry?.size);
    })
    .sort(compareEntryRows);
}

function getCurrentEntryRows(entries: Map<string, EntryStats>) {
  return [...entries.values()].sort(compareCurrentEntryRows);
}

function getBundleRows(
  baselineBundles: Map<BundleKey, ManualBundleStats>,
  currentBundles: Map<BundleKey, ManualBundleStats>,
) {
  return MANUAL_BUNDLES.map(({ key, label }) => {
    const currentBundle = currentBundles.get(key);
    const baselineBundle = baselineBundles.get(key);
    const bundleLabel = currentBundle?.label || baselineBundle?.label || label;
    return createDiffRow(bundleLabel, baselineBundle?.size, currentBundle?.size);
  });
}

function getCurrentBundleRows(bundles: Map<BundleKey, ManualBundleStats>) {
  return MANUAL_BUNDLES.map(({ key }) => bundles.get(key)!);
}

function getFileTypeRows(
  baselineFileTypes: Map<FileTypeKey, FileTypeStats>,
  currentFileTypes: Map<FileTypeKey, FileTypeStats>,
) {
  return FILE_TYPES.map(({ key, label }) => {
    const currentFileType = currentFileTypes.get(key);
    const baselineFileType = baselineFileTypes.get(key);
    const fileTypeLabel = currentFileType?.label || baselineFileType?.label || label;
    return createDiffRow(fileTypeLabel, baselineFileType?.size, currentFileType?.size);
  });
}

function getCurrentFileTypeRows(fileTypes: Map<FileTypeKey, FileTypeStats>) {
  return FILE_TYPES.map(({ key }) => fileTypes.get(key)!);
}

function createDiffRow(label: string, before = ZERO_SIZE, after = ZERO_SIZE): DiffRow {
  const diff = after - before;
  const percent = before ? (diff / before) * 100 : undefined;
  const status = getDiffStatus(percent, diff);

  return {
    label,
    before,
    after,
    diff,
    percent,
    status,
    diffText: formatDiff(diff),
    percentText: formatPercent(percent, diff),
  };
}

function compareEntryRows(a: DiffRow, b: DiffRow) {
  const aIndex = ENTRY_ORDER.indexOf(getEntryKey(a.label));
  const bIndex = ENTRY_ORDER.indexOf(getEntryKey(b.label));

  if (aIndex !== -1 || bIndex !== -1) {
    return normalizeEntryOrder(aIndex) - normalizeEntryOrder(bIndex);
  }

  return a.label.localeCompare(b.label);
}

function compareCurrentEntryRows(a: EntryStats, b: EntryStats) {
  const aIndex = ENTRY_ORDER.indexOf(a.key);
  const bIndex = ENTRY_ORDER.indexOf(b.key);

  if (aIndex !== -1 || bIndex !== -1) {
    return normalizeEntryOrder(aIndex) - normalizeEntryOrder(bIndex);
  }

  return a.label.localeCompare(b.label);
}

function getEntryKey(label: string) {
  return label
    .replace(/^\S+\s+/, '')
    .toLowerCase()
    .replaceAll(' ', '-');
}

function normalizeEntryOrder(index: number) {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function renderDiffLine(row: DiffRow) {
  return `${row.label} (${formatSize(row.after)}): ${row.status} ${row.diffText} (${row.percentText})`;
}

function renderCurrentSizeLine(row: SizeStats) {
  return `${row.label} (${formatSize(row.size)})`;
}

function addDiffSection(lines: string[], title: string, rows: DiffRow[]) {
  const changedRows = rows.filter(isChangedDiffRow);
  if (!changedRows.length) return;

  lines.push('', title, ...changedRows.map(renderDiffLine));
}

function isChangedDiffRow(row: DiffRow) {
  return row.diff !== ZERO_SIZE;
}

function createManualBundleStatsMap(): Map<BundleKey, ManualBundleStats> {
  return new Map(MANUAL_BUNDLES.map((bundle) => [bundle.key, createManualBundleStats(bundle)]));
}

function addManualBundleSize(bundles: Map<BundleKey, ManualBundleStats>, name: string, size: number) {
  const bundleKey = getManualBundleKey(name);
  if (!bundleKey) return;

  const bundle = bundles.get(bundleKey)!;
  bundles.set(bundleKey, {
    ...bundle,
    size: bundle.size + size,
  });
}

function getManualBundleKey(name: string): BundleKey | undefined {
  if (!MANUAL_BUNDLE_ASSET_EXTENSIONS.some((extension) => name.endsWith(extension))) return undefined;

  const stableBaseName = getStableAssetBaseName(name);
  const bundle = MANUAL_BUNDLES.find(({ key }) => key === stableBaseName);
  return bundle?.key;
}

function createManualBundleStats({ key, label }: BundleDefinition): ManualBundleStats {
  return {
    key,
    label,
    size: ZERO_SIZE,
  };
}

function createFileTypeStatsMap(): Map<FileTypeKey, FileTypeStats> {
  return new Map(FILE_TYPES.map((fileType) => [fileType.key, createFileTypeStats(fileType)]));
}

function addFileTypeSize(fileTypes: Map<FileTypeKey, FileTypeStats>, name: string, size: number) {
  const fileType = getFileTypeStats(name);
  const previousSize = fileTypes.get(fileType.key)?.size || ZERO_SIZE;
  fileTypes.set(fileType.key, {
    ...fileType,
    size: previousSize + size,
  });
}

function getFileTypeStats(name: string): FileTypeStats {
  const fileType = FILE_TYPES.find(({ extensions }) => (
    extensions?.some((extension) => name.endsWith(extension))
  )) || OTHER_FILE_TYPE;
  return createFileTypeStats(fileType);
}

function createFileTypeStats({ key, label }: (typeof FILE_TYPES)[number]): FileTypeStats {
  return {
    key,
    label,
    size: ZERO_SIZE,
  };
}

function getWorkerEntry(name: string, chunkFiles: Set<string>) {
  if (/^service\.worker-[\w-]+\.js$/.test(name)) {
    return { key: 'service-worker', label: '🛠️ Service worker' };
  }

  if (chunkFiles.has(name) && !isWorkerAssetName(name)) return undefined;

  if (/^worker-[\w-]+\.js$/.test(name)) {
    return { key: 'gramjs-worker', label: '⚙️ GramJS worker' };
  }

  if (/^fasttext\.worker-[\w-]+\.js$/.test(name)) {
    return { key: 'fasttext-worker', label: '🌐 FastText worker' };
  }

  if (/^index\.worker-[\w-]+\.js$/.test(name)) {
    return { key: 'media-worker', label: '🎞️ Media worker' };
  }

  if (/^sharedState\.worker-[\w-]+\.js$/.test(name)) {
    return { key: 'shared-state-worker', label: '🔄 Shared state worker' };
  }

  return undefined;
}

function isWorkerAssetName(name: string) {
  return /^(?:worker|fasttext\.worker|index\.worker|sharedState\.worker)-[\w-]+\.js$/.test(name);
}

function isIgnoredAsset(name: string) {
  return name.endsWith('.map') || name.startsWith('bundle-stats/');
}

function getStableAssetName(name: string) {
  return name
    .replace(/\.[\w-]{6,}(?=\.[^.]+$)/, '')
    .replace(/-[\w-]{6,}(?=\.[^.]+$)/, '');
}

function getStableAssetBaseName(name: string) {
  return getStableAssetName(name).split('/').pop()!.replace(/\.[^.]+$/, '');
}

function getDiffStatus(percent: number | undefined, diff: number) {
  if (diff < ZERO_SIZE) return DIFF_STATUS_GOOD;
  if (percent === undefined && diff > ZERO_SIZE) return DIFF_STATUS_WARN;
  if (percent !== undefined && percent > REGRESSION_WARNING_PERCENT) return DIFF_STATUS_WARN;
  return DIFF_STATUS_NEUTRAL;
}

function formatSize(size: number) {
  const absoluteSize = Math.abs(size);

  if (absoluteSize >= BYTES_PER_MB) {
    return `${formatNumber(absoluteSize / BYTES_PER_MB)}MB`;
  }

  if (absoluteSize >= BYTES_PER_KB) {
    return `${formatNumber(absoluteSize / BYTES_PER_KB)}KB`;
  }

  return `${absoluteSize}B`;
}

function formatDiff(diff: number) {
  const sign = diff > ZERO_SIZE ? '+' : (diff < ZERO_SIZE ? '-' : '');
  return `${sign}${formatSize(diff)}`;
}

function formatPercent(percent: number | undefined, diff: number) {
  if (percent === undefined) {
    if (diff === ZERO_SIZE) return '0%';
    return 'new';
  }

  const sign = percent > ZERO_SIZE ? '+' : '';
  return `${sign}${formatNumber(percent)}%`;
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function addReportLine(lines: string[], reportUrl: string) {
  if (!reportUrl) return;
  lines.push('', `Detailed comparison report: [open HTML artifact](${reportUrl})`);
}

async function upsertComment({
  github,
  context,
  core,
  body,
}: CreateBundleStatsCommentOptions & { body: string }) {
  const { owner, repo } = context.repo;
  const issueNumber = Number(process.env.PR_NUMBER || context.issue.number);
  if (!issueNumber) {
    throw new Error('Cannot create bundle stats comment without a PR number');
  }

  const { data: comments } = await github.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  const previousComment = comments.find(({ body: commentBody = '' }) => commentBody.includes(COMMENT_MARKER));

  if (previousComment) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: previousComment.id,
      body,
    });
    core.info(`Updated bundle stats comment ${previousComment.id}.`);
    return;
  }

  const { data: comment } = await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
  core.info(`Created bundle stats comment ${comment.id}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [
    ,,
    currentStatsPath = DEFAULT_CURRENT_STATS_PATH,
    baselineStatsPath = DEFAULT_BASELINE_STATS_PATH,
  ] = process.argv;
  const body = createCommentBody({
    baselineStatsPath,
    currentStatsPath,
    reportUrl: process.env.REPORT_URL || DEFAULT_REPORT_URL,
  });
  // eslint-disable-next-line no-console
  console.log(body);
}
