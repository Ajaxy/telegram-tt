export default function updateIcon(asUnread: boolean) {
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="alternate icon"]')
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
