import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import svgtofont from 'svgtofont';

const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.join(PROJECT_ROOT, 'src', 'assets', 'font-icons');
const STYLES_DIR = path.join(PROJECT_ROOT, 'src', 'styles');
const FONT_TYPES_PATH = path.join(PROJECT_ROOT, 'src', 'types', 'icons', 'font.ts');
const SVGTOFONT_PACKAGE_PATH = path.join(PROJECT_ROOT, 'node_modules', 'svgtofont', 'package.json');
const STYLE_TEMPLATES_DIR = path.join(PROJECT_ROOT, 'dev', 'icons-templates');
const PREVIEW_DIR = path.join(STYLES_DIR, 'icons');
const TEMP_DIR = path.join(PROJECT_ROOT, '.cache', 'icons-build');
const TEMP_INPUT_DIR = path.join(TEMP_DIR, 'input');
const FONT_NAME = 'icons';
const DEFAULT_START_CODEPOINT = 0xf101;
const SAFE_PUBLIC_NAME_PATTERN = /^[a-zA-Z0-9-_]+$/;

type IconSource = {
  publicName: string;
  sourcePath: string;
};

type IconDefinition = IconSource & {
  codepoint: number;
};

function compareNames(left: string, right: string) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function toPublicName(filePath: string) {
  const relativePath = path.relative(SOURCE_DIR, filePath);
  const rawPublicName = relativePath
    .replace(/\.svg$/i, '')
    .split(path.sep)
    .join('-');
  const normalizedPublicName = rawPublicName
    .replace(/\s+/g, '-')
    .replace(/['"]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalizedPublicName || !SAFE_PUBLIC_NAME_PATTERN.test(normalizedPublicName)) {
    throw new Error([
      `Could not derive a safe icon name from "${relativePath}".`,
      'Icon names must be safe for generated selectors, preview HTML, and src/types/icons/font.ts.',
      `Derived name: "${normalizedPublicName || '(empty)'}"`,
    ].join('\n'));
  }

  return normalizedPublicName;
}

async function collectSvgPaths(directoryPath: string): Promise<string[]> {
  const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });
  const sortedEntries = [...directoryEntries].sort((left, right) => compareNames(left.name, right.name));

  const nestedPaths = await Promise.all(sortedEntries.map(async (entry) => {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return collectSvgPaths(fullPath);
    }

    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.svg') {
      return [];
    }

    return [fullPath];
  }));

  return nestedPaths.flat();
}

function buildOrderedIconDefinitions(iconSources: IconSource[]) {
  const iconSourcesByName = new Map<string, IconSource>();

  for (const iconSource of iconSources) {
    const duplicateSource = iconSourcesByName.get(iconSource.publicName);
    if (duplicateSource) {
      throw new Error([
        `Duplicate icon name "${iconSource.publicName}" after flattening paths.`,
        `- ${duplicateSource.sourcePath}`,
        `- ${iconSource.sourcePath}`,
      ].join('\n'));
    }

    iconSourcesByName.set(iconSource.publicName, iconSource);
  }

  return [...iconSourcesByName.keys()]
    .sort(compareNames)
    .map((publicName, index) => {
      const iconSource = iconSourcesByName.get(publicName);
      if (!iconSource) {
        throw new Error(`Missing icon source for "${publicName}".`);
      }

      return {
        ...iconSource,
        codepoint: DEFAULT_START_CODEPOINT + index,
      };
    });
}

async function prepareTempInputs(iconDefinitions: IconDefinition[]) {
  await fs.rm(TEMP_INPUT_DIR, { force: true, recursive: true });
  await fs.mkdir(TEMP_INPUT_DIR, { recursive: true });

  await Promise.all(iconDefinitions.map(async ({ publicName, sourcePath }) => {
    const outputPath = path.join(TEMP_INPUT_DIR, `${publicName}.svg`);
    await fs.copyFile(sourcePath, outputPath);
  }));
}

function escapeCodepoint(codepoint: number) {
  return `\\${codepoint.toString(16)}`;
}

async function buildFontHash(iconDefinitions: IconDefinition[]) {
  const hash = createHash('md5');
  const svgtofontPackage = JSON.parse(await fs.readFile(SVGTOFONT_PACKAGE_PATH, 'utf8')) as {
    version?: string;
  };

  hash.update(FONT_NAME);
  hash.update('fontHeight:1000');
  hash.update('normalize:true');
  hash.update(svgtofontPackage.version || '');

  for (const { publicName, codepoint, sourcePath } of iconDefinitions) {
    hash.update(publicName);
    hash.update(codepoint.toString(16));
    hash.update(await fs.readFile(sourcePath));
  }

  return hash.digest('hex');
}

function buildFontTypes(iconDefinitions: IconDefinition[]) {
  const iconTypeLines = iconDefinitions.map(({ publicName }, index) => {
    const isLast = index === iconDefinitions.length - 1;

    return `  | '${publicName}'${isLast ? ';' : ''}`;
  });

  return [
    'export type FontIconName =',
    ...iconTypeLines,
    '',
  ].join('\n');
}

async function writeFontTypes(iconDefinitions: IconDefinition[]) {
  await fs.writeFile(FONT_TYPES_PATH, buildFontTypes(iconDefinitions));
}

async function buildIcons() {
  const svgPaths = await collectSvgPaths(SOURCE_DIR);
  if (!svgPaths.length) {
    throw new Error(`No SVG icons found in "${SOURCE_DIR}".`);
  }

  const iconSources = svgPaths.map((sourcePath) => ({
    publicName: toPublicName(sourcePath),
    sourcePath,
  }));
  const iconDefinitions = buildOrderedIconDefinitions(iconSources);
  const iconDefinitionsByName = new Map(
    iconDefinitions.map((iconDefinition) => [iconDefinition.publicName, iconDefinition]),
  );
  const fontHash = await buildFontHash(iconDefinitions);
  const templateIconDefinitions = iconDefinitions.map(({ publicName, codepoint }) => ({
    encodedCode: escapeCodepoint(codepoint),
    publicName,
  }));

  await prepareTempInputs(iconDefinitions);
  await fs.mkdir(PREVIEW_DIR, { recursive: true });

  await svgtofont({
    css: {
      fileName: FONT_NAME,
      hasTimestamp: false,
      include: /\.template$/u,
      output: STYLES_DIR,
      templateVars: {
        fontHash,
        iconDefinitions: templateIconDefinitions,
        previewPath: 'icons/preview.html',
      },
    },
    dist: STYLES_DIR,
    excludeFormat: ['eot', 'svg', 'ttf', 'symbol.svg'],
    fontName: FONT_NAME,
    getIconUnicode(name) {
      const iconDefinition = iconDefinitionsByName.get(name);
      if (!iconDefinition) {
        throw new Error(`Missing codepoint definition for "${name}".`);
      }

      return [String.fromCodePoint(iconDefinition.codepoint), iconDefinition.codepoint + 1];
    },
    log: false,
    src: TEMP_INPUT_DIR,
    startUnicode: iconDefinitions[0]?.codepoint ?? DEFAULT_START_CODEPOINT,
    styleTemplates: STYLE_TEMPLATES_DIR,
    svgicons2svgfont: {
      fontHeight: 1000,
      normalize: true,
    },
  });

  await writeFontTypes(iconDefinitions);
}

async function run() {
  try {
    await buildIcons();
  } finally {
    await fs.rm(TEMP_DIR, { force: true, recursive: true });
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
