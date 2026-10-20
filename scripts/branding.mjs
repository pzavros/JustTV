/** Reviewed branding changes; never imported by the TV runtime. */
export const PRODUCT_NAME = 'JustTV';
export const LEGACY_PRODUCT_NAME = 'Clear Home';
export const ICON_SHA256 = '55fd7d0c40a9800297232a38fdc64ad110ca9601c24f58b644c53755a56305ff';

/** Normalize only the display-name fields approved for the rebrand. */
export function normalizeBranding(text) {
  return text
    .replaceAll('<title>' + PRODUCT_NAME + '</title>', '<title>' + LEGACY_PRODUCT_NAME + '</title>')
    .replaceAll('aria-label="' + PRODUCT_NAME + '"', 'aria-label="' + LEGACY_PRODUCT_NAME + '"')
    .replaceAll('<name>' + PRODUCT_NAME + '</name>', '<name>' + LEGACY_PRODUCT_NAME + '</name>');
}
