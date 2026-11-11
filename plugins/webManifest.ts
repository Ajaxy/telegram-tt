import type { Plugin } from 'vite';

type Options = {
  id?: string;
  isProductionApp: boolean;
};

const MANIFEST_FILE_NAME = 'site.webmanifest';
const APPLE_MANIFEST_FILE_NAME = 'site_apple.webmanifest';
const MANIFEST_ICON_SIZES = [192, 512];

export default function buildWebManifestPlugin({ id, isProductionApp }: Options): Plugin {
  const devSuffix = isProductionApp ? '' : '-dev';
  const maskableIcon = {
    src: `icon-maskable${devSuffix}-512x512.png`,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  };
  const manifests = {
    [MANIFEST_FILE_NAME]: buildManifest(id, isProductionApp, [...buildIcons(`icon${devSuffix}`), maskableIcon]),
    [APPLE_MANIFEST_FILE_NAME]: buildManifest(id, isProductionApp, buildIcons(`icon-square${devSuffix}`)),
  };

  return {
    name: 'web-manifest',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const fileName = req.url?.split('?')[0].slice(1);
        const manifest = fileName && manifests[fileName as keyof typeof manifests];
        if (!manifest) {
          next();
          return;
        }

        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifest);
      });
    },
    generateBundle() {
      Object.entries(manifests).forEach(([fileName, source]) => {
        this.emitFile({ type: 'asset', fileName, source });
      });
    },
  };
}

function buildManifest(id: string | undefined, isProductionApp: boolean, icons: object[]) {
  const name = isProductionApp ? 'Telegram Web' : 'Telegram Web Beta';

  return JSON.stringify({
    id,
    name,
    short_name: name,
    description: 'Telegram is a cloud-based mobile and desktop messaging app with a focus on security and speed.',
    start_url: './',
    icons,
    share_target: {
      action: './share/',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [{ name: 'files', accept: '*/*' }],
      },
    },
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
  }, undefined, 2);
}

function buildIcons(prefix: string) {
  return MANIFEST_ICON_SIZES.map((size) => ({
    src: `${prefix}-${size}x${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
  }));
}
