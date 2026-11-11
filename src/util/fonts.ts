const SITE_FONTS = ['400 1em Roboto', '500 1em Roboto', '500 1em \'Numbers Rounded\''];

export default function preloadFonts(targetDocument = document) {
  if ('fonts' in targetDocument) {
    if (targetDocument !== document) {
      const usedFonts = Array.from(document.fonts).filter((font) => (
        font.status === 'loaded' || font.status === 'loading'
      ));
      const targetFonts = Array.from(targetDocument.fonts).filter((font) => usedFonts.some((usedFont) => (
        font.family === usedFont.family
        && font.style === usedFont.style
        && font.weight === usedFont.weight
        && font.stretch === usedFont.stretch
        && font.unicodeRange === usedFont.unicodeRange
      )));

      return Promise.all(targetFonts.map((font) => font.load()));
    }

    return Promise.all(SITE_FONTS.map((font) => targetDocument.fonts.load(font)));
  }

  return undefined;
}
