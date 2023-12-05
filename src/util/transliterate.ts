export function transliterate(input: string): string {
  const engToRus: { [key: string]: string } = {
    a: 'а',
    b: 'б',
    v: 'в',
    g: 'г',
    d: 'д',
    e: 'е',
    z: 'з',
    i: 'и',
    y: 'й',
    k: 'к',
    l: 'л',
    m: 'м',
    n: 'н',
    o: 'о',
    p: 'п',
    r: 'р',
    s: 'с',
    t: 'т',
    u: 'у',
    f: 'ф',
    h: 'х',
    c: 'ц',
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
