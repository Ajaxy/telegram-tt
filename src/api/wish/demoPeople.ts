import dmitriyAvatar from '../../assets/wish/dmitriy.jpg';

// Fictional supporters for the demo, so no real accounts appear in it
export type WishDemoPerson = {
  id: string;
  name: string;
  avatarUrl: string;
  peerColorId: number;
};

type FacePalette = {
  background: string;
  skin: string;
  hair: string;
};

const DEMO_ID_PREFIX = 'wish-demo-';
const FACE_PALETTES: FacePalette[] = [
  { background: '#7cc6fe', skin: '#ffd8be', hair: '#5a3825' },
  { background: '#ffb86b', skin: '#f1c27d', hair: '#2b2b2b' },
  { background: '#b39ddb', skin: '#ffe0bd', hair: '#d4a373' },
  { background: '#81c784', skin: '#c68642', hair: '#1f1f1f' },
  { background: '#f48fb1', skin: '#ffdbac', hair: '#8d5524' },
];
const FACE_SIZE = 80;
const FACE_TILT_STEP = 7;
const FACE_TILT_RANGE = 3;

const DEMO_PEOPLE: WishDemoPerson[] = [
  buildPerson(1, 'Emma Wilson'),
  buildPerson(2, 'Liam Carter'),
  { id: `${DEMO_ID_PREFIX}3`, name: 'Dmitriy', avatarUrl: dmitriyAvatar, peerColorId: 5 },
  buildPerson(4, 'Olivia Brooks'),
  buildPerson(5, 'Noah Bennett'),
  buildPerson(6, 'Ava Mitchell'),
];

const DEMO_PEOPLE_BY_ID = new Map(DEMO_PEOPLE.map((person) => [person.id, person]));

export function getDemoPeopleIds() {
  return DEMO_PEOPLE.map(({ id }) => id);
}

export function getDemoPerson(id: string) {
  return DEMO_PEOPLE_BY_ID.get(id);
}

function buildPerson(index: number, name: string): WishDemoPerson {
  return {
    id: `${DEMO_ID_PREFIX}${index}`,
    name,
    avatarUrl: buildFaceAvatarUrl(index),
    peerColorId: index % FACE_PALETTES.length,
  };
}

// A small illustrated face in the spirit of AI-generated placeholder avatars, drawn as inline SVG
function buildFaceAvatarUrl(seed: number) {
  const { background, skin, hair } = FACE_PALETTES[seed % FACE_PALETTES.length];
  const tilt = ((seed * FACE_TILT_STEP) % (FACE_TILT_RANGE * 2 + 1)) - FACE_TILT_RANGE;
  const hasLongHair = seed % 2 === 0;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${FACE_SIZE} ${FACE_SIZE}'>`
    + `<defs><linearGradient id='b' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${background}'/>`
    + `<stop offset='1' stop-color='${background}' stop-opacity='.65'/></linearGradient></defs>`
    + `<rect width='80' height='80' fill='url(#b)'/>`
    + `<g transform='rotate(${tilt * 2} 40 44)'>`
    + (hasLongHair ? `<path d='M18 44c0-20 9-30 22-30s22 10 22 30v26H18z' fill='${hair}'/>` : '')
    + `<path d='M27 64h26v16H27z' fill='${skin}'/>`
    + `<path d='M14 80c2-12 13-18 26-18s24 6 26 18z' fill='${hair}' opacity='.85'/>`
    + `<ellipse cx='40' cy='42' rx='17' ry='19' fill='${skin}'/>`
    + `<path d='M23 38c1-12 8-18 17-18s16 6 17 18c-5-6-11-9-17-9s-12 3-17 9z' fill='${hair}'/>`
    + `<circle cx='33.5' cy='44' r='2.2' fill='#2d2a32'/><circle cx='46.5' cy='44' r='2.2' fill='#2d2a32'/>`
    + `<path d='M35 52q5 4 10 0' stroke='#2d2a32' stroke-width='1.8' fill='none' stroke-linecap='round'/>`
    + `<circle cx='29' cy='50' r='2.6' fill='#ff8a80' opacity='.35'/>`
    + `<circle cx='51' cy='50' r='2.6' fill='#ff8a80' opacity='.35'/>`
    + '</g></svg>';

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
