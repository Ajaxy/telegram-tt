export default function updateIcon(asUnread: boolean) {
  // Only the SVG icon has an unread variant
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]')
    .forEach((link) => {
      if (asUnread) {
        if (!link.href.includes('favicon-unread')) {
          link.href = link.href.replace('favicon', 'favicon-unread');
        }
      } else {
        link.href = link.href.replace('favicon-unread', 'favicon');
      }
    });
}
