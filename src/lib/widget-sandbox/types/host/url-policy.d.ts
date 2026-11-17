export type UrlKind = 'image' | 'fragment-only';
/** The profile's image types (PNG, JPEG, GIF, WebP: the decoder runs in the app process; SVG, AVIF, BMP and ICO are out). */
export declare const IMAGE_MIME: Set<string>;
/** blob: URLs created by the host itself. Nothing else may use the blob: scheme. */
export declare const hostBlobUrls: Set<string>;
/**
 * The most pixels a data: image may have. A decoder takes the size from the image's header and holds a bitmap
 * of it whatever the bytes are: a few hundred bytes of PNG can claim 65535² (16 GB as RGBA), and 2 KB of a one-colour
 * PNG is a real 4096² (64 MB). 1024² is 4 MB, an image across a 320 px bubble at 3×; the corpora's largest is 40 × 20
 * (docs/decisions.md, "Strict limits from the start").
 */
export declare const MAX_IMAGE_PIXELS: number;
/** An image no decoder takes: it fires `error` and has no size, as a broken one does. */
export declare const BROKEN_IMAGE = "data:image/png;base64,";
/**
 * The size a decoder would give a data: image, by its signature (the browser sniffs it: the declared type does not
 * pick the decoder), or null for none of the profile's formats — BMP, ICO or AVIF bytes behind an image/png type
 * could reach decoders the profile keeps out.
 */
export declare function dataImageSize(url: string): [number, number] | null;
/**
 * Returns the URL to use (normalized) if it is allowed for `kind`, else null.
 * Fragments are returned as-is. No relative URLs: there is nothing to resolve against.
 */
export declare function checkUrl(raw: string, kind: UrlKind): string | null;
export declare function isFragment(raw: string): boolean;
/** 1×1 transparent placeholder used where an external image was stripped. */
export declare const PLACEHOLDER_IMAGE: string;
