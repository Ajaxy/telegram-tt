import type { ApiGeoPoint } from '../api/types';

const PROVIDERS = {
  google: 'https://maps.google.com/maps',
  bing: 'https://bing.com/maps/default.aspx',
  osm: 'https://www.openstreetmap.org',
  apple: 'https://maps.apple.com',
};

// https://github.com/TelegramMessenger/Telegram-iOS/blob/2a32c871882c4e1b1ccdecd34fccd301723b30d9/submodules/LocationResources/Sources/VenueIconResources.swift#L82
const VENUE_COLORS = new Map(Object.entries({
  'building/medical': '#43b3f4',
  'building/gym': '#43b3f4',
  'education/cafeteria': '#f7943f',
  'travel/bedandbreakfast': '#9987ff',
  'travel/hotel': '#9987ff',
  'travel/hostel': '#9987ff',
  'travel/resort': '#9987ff',
  'travel/hotel_bar': '#e56dd6',
  arts_entertainment: '#e56dd6',
  building: '#6e81b2',
  education: '#a57348',
  event: '#959595',
  food: '#f7943f',
  home: '#00aeef',
  nightlife: '#e56dd6',
  parks_outdoors: '#6cc039',
  shops: '#ffb300',
  travel: '#1c9fff',
  work: '#ad7854',
}));

const RANDOM_COLORS = [
  '#e56cd5', '#f89440', '#9986ff', '#44b3f5', '#6dc139', '#ff5d5a', '#f87aad', '#6e82b3', '#f5ba21',
];

export function prepareMapUrl(provider: keyof typeof PROVIDERS, point: Omit<ApiGeoPoint, 'accessHash'>, zoom = 15) {
  const { lat, long } = point;
  const providerUrl = PROVIDERS[provider];
  switch (provider) {
    case 'google':
      return `${providerUrl}/place/${lat}+${long}/@${lat},${long},${zoom}z`;
    case 'bing':
      return `${providerUrl}?cp=${lat}~${long}&lvl=${zoom}&sp=point.${lat}_${long}`;
    case 'apple':
      return `${providerUrl}?q=${lat},${long}`;
    case 'osm':
    default:
      return `${providerUrl}/?mlat=${lat}&mlon=${long}&zoom=${zoom}`;
  }
}

export function getMetersPerPixel(lat: number, zoom: number) {
  // https://groups.google.com/g/google-maps-js-api-v3/c/hDRO4oHVSeM/m/osOYQYXg2oUJ
  return (156543.03392 * Math.cos(lat * (Math.PI / 180))) / 2 ** zoom;
}

export function getVenueIconUrl(type?: string) {
  if (!type) return '';
  return `https://ss3.4sqi.net/img/categories_v2/${type}_88.png`;
}

// https://github.com/TelegramMessenger/Telegram-iOS/blob/2a32c871882c4e1b1ccdecd34fccd301723b30d9/submodules/LocationResources/Sources/VenueIconResources.swift#L104
export function getVenueColor(type?: string) {
  if (!type) return '#008df2';
  return VENUE_COLORS.get(type)
    || VENUE_COLORS.get(type.split('/')[0])
    || RANDOM_COLORS[stringToNumber(type) % RANDOM_COLORS.length];
}

function stringToNumber(str: string) {
  return str.split('').reduce((prevHash, currVal) => (
    // eslint-disable-next-line no-bitwise
    (((prevHash << 5) - prevHash) + currVal.charCodeAt(0)) | 0), 0);
}
