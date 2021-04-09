# telegram-t

## Demo

https://telegram-t-rc-7.netlify.app/

## Local setup

```sh
mv .env.example .env

npm i
```

Obtain API ID and API hash on [my.telegram.org](https://my.telegram.org) and populate the `.env` file.

## Dev mode

```sh
npm run dev
```

## **Features** (as of August 22, 2020)
### Performance
- Transferred size: 156 kB on auth screen, 277 kB within a chat
- Instant launch with preserved state
- Smooth UI launch with no avatars and fonts flickering
- Only visible set of messages is rendered while scrolling the viewport
- Progressive media loading and playing when moving the viewport
- Lazy loading for heavy assets and features
- Unstable network support with auto-reconnects any sync
- Ripple effect is flawless during rendering (when switching chats)
### Nice stuff
- Apple emojis on all platforms
- Previews of media documents
- Custom media viewer controls
- Tails in photo messages
- Smart sticky dates in message list
- Deeply optimized animations and lists
### Message types and features
- Regular, replies (with focusing), forwarded
- With photo, stickers (incl. animated), video (incl. playing inline, GIF and round), audio, voice (with marking as read), documents (with downloading), polls (with voting), albums, web-pages, contacts, emoji-only
- Text formatting, links, mentions, hashtags, code samples, quotes, and other entities
- Various combinations of all above
- Service messages with interactive mentions
### Bigger features
- Navigating to any point in messages history, loading history starting from unread messages
- Updates support for all implemented UI features, incl. new/edited/deleted/pinned messages (incl. older chats) and various indicators for chats and users
- Support for attaching and copy-pasting quick photos and videos, documents, polls, recording audio, sending emojis, stickers, GIFs and web pages with preview. Flawless optimistic transitions between local and server sent messages
- Shared Media with infinite scroll and progressive loading. All messages with links (not only WebPages) are shown, support for audio files playback and documents download
- Message Search with infinite scroll and progressive loading
- Top Contacts, Recent Chats and fully-functional Global Search for chats and messages
- Media Viewer with preloading, navigation, forwarding and downloading
- Message Context Menu supporting reply, forward, edit, pin, copy (incl. media and selected text), delete features (incl. a popup with deleting options), respecting user permissions
- Creating groups and channels
- Profile management
- Full chat permissions support (incl. admin rights and slow mode)
- Full stickers and GIFs panel support with saved, favorites, search and trending
### Indicators
- Chats: online users, unread inbox counter, mentions, pending/delivered/read outbox, pinned, verified, muted, time/date formatting
- Messages: pending/delivered/read, "edited" mark, channel views counter
- Download progress spinners
- Profiles and chats information in the middle and the right columns, incl. online members counter for supergroups
- "typing..." and "uploading [media]..." statuses
### Misc
- The latest MTProto Layer 112 is used
- Cancelling sending media messages
- Manual read/unread marks for chats
- HTML and Markdown in message composer
- Drafts
- Charts statistics (mocked)
- Pinned message (with unpinning and focusing)
- \<Esc> key support for closing chat, reply form, popup, context menu, etc.
- Chat with self is displayed as Saved Messages
- Phone numbers formatting
- Nearest country auto-detect
