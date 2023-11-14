export function convertLayout(input: string): string {
  const engToRus: { [key: string]: string } = {
    q: 'й',
    w: 'ц',
    e: 'у',
    r: 'к',
    t: 'е',
    y: 'н',
    u: 'г',
    i: 'ш',
    o: 'щ',
    p: 'з',
    '[': 'х',
    ']': 'ъ',
    a: 'ф',
    s: 'ы',
    d: 'в',
    f: 'а',
    g: 'п',
    h: 'р',
    j: 'о',
    k: 'л',
    l: 'д',
    ';': 'ж',
    '\'': 'э',
    z: 'я',
    x: 'ч',
    c: 'с',
    v: 'м',
    b: 'и',
    n: 'т',
    m: 'ь',
    ',': 'б',
    '.': 'ю',
    '/': '.',
  };

  const rusToEng: { [key: string]: string } = Object.fromEntries(
    Object.entries(engToRus).map(([eng, rus]) => [rus, eng]),
  );

  return input.split('').map((char) => {
    const lowerChar = char.toLowerCase();
    const isUpperCase = char !== lowerChar;
    const convertedChar = engToRus[lowerChar] || rusToEng[lowerChar] || char;

    return isUpperCase ? convertedChar.toUpperCase() : convertedChar;
  }).join('');
}
