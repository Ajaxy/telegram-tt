# Design variables

This is the theming CSS-variable reference for the client. It covers global theme colors and message-list theming: message palettes, message-local aliases and wallpaper inputs. Layout, typography, animation and component-private properties are not documented here.

## Reading the tables

- **Light / Dark** are the initialized built-in theme values with no server theme, using the generic platform defaults. They are not a guarantee about a selected server theme.
- **CSS alias** means the declaration contains a live `var(...)` reference. Its linked variable supplies the default. **CSS-derived** means an expression reads other variables. **No CSS alias** means a literal, Sass result or separately assigned JavaScript value, even when its color matches another row.
- Custom properties normally inherit from the parent element. The reference column describes dependencies between variables, not just parent-to-child inheritance. Locally overridden properties and registered non-inheriting properties are identified below.
- Stylesheet fallbacks come from [variables](src/styles/_variables.scss). Initialization overlays [light/dark base colors](src/styles/themes.json), then the [runtime palette](src/util/theme.ts). A CSS fallback alias can therefore become a concrete initialized value. Per-chat scopes and message aliases can override the same names again.
- Runtime theme colors are registered as inheriting `<color>` properties when animatable. Literal white remains distinct from the foreground paired with an accent control.

## Global variables

These values are available from the root or shared page scope. Server palettes can override app accents, primary/secondary surfaces and text. Tinted themes also derive app surfaces and secondary text from the accent.

### Colors

The reference column describes the initialized defaults. In particular, matching light/dark literals do not imply an inheritance relationship.

| Variable | Purpose | Light | Dark | Default reference / inheritance |
| --- | --- | --- | --- | --- |
| <a id="color-background"></a>`--color-background` | Primary app surface | `#FFFFFF` | `#212121` | No; generated palette value |
| <a id="color-background-compact-menu"></a>`--color-background-compact-menu` | Background compact menu | `#FFFFFFBB` | `#212121DD` | No; literal or Sass-computed value |
| <a id="color-background-compact-menu-reactions"></a>`--color-background-compact-menu-reactions` | Background compact menu reactions | `#FFFFFFEB` | `#212121DD` | No; literal or Sass-computed value |
| <a id="color-background-compact-menu-hover"></a>`--color-background-compact-menu-hover` | Background compact menu hover | `#00000011` | `#00000066` | No; literal or Sass-computed value |
| <a id="color-background-menu-separator"></a>`--color-background-menu-separator` | Background menu separator | `#0000001a` | `#ffffff1a` | No; literal or Sass-computed value |
| <a id="color-web-app-placeholder"></a>`--color-web-app-placeholder` | Mini app splash logo when no custom background is set | `#EFEFF4` | `#333334` | No; literal or Sass-computed value |
| <a id="color-background-selected"></a>`--color-background-selected` | Selected app surface | `#F4F4F5` | `#2C2C2C` | No; generated palette value |
| <a id="color-background-secondary"></a>`--color-background-secondary` | Secondary app surface | `#F4F4F5` | `#0F0F0F` | No; generated palette value |
| <a id="color-background-secondary-accent"></a>`--color-background-secondary-accent` | Accented secondary surface | `#E4E4E5` | `#191919` | No; generated palette value |
| <a id="color-background-sidebar"></a>`--color-background-sidebar` | Background sidebar | `#E4E4E5` | `#0F0F0F` | No; literal or Sass-computed value |
| <a id="color-text"></a>`--color-text` | Primary app text | `#000000` | `#ffffff` | No; generated palette value |
| <a id="color-text-rgb"></a>`--color-text-rgb` | Comma-separated primary-text channels | `0, 0, 0` | `255, 255, 255` | No CSS alias; channels of [--color-text](#color-text) |
| <a id="color-text-lighter"></a>`--color-text-lighter` | Text lighter | `#2e3939` | `#2e3939` | No; literal or Sass-computed value |
| <a id="color-text-secondary"></a>`--color-text-secondary` | Secondary text | `#707579` | `#AAAAAA` | No; generated palette value |
| <a id="color-icon-secondary"></a>`--color-icon-secondary` | Secondary icons | `#707579` | `#AAAAAA` | No CSS alias; copies the palette secondary value ([--color-text-secondary](#color-text-secondary)) |
| <a id="color-text-secondary-rgb"></a>`--color-text-secondary-rgb` | Comma-separated secondary-text channels | `112, 117, 121` | `170, 170, 170` | No CSS alias; channels of [--color-text-secondary](#color-text-secondary) |
| <a id="color-text-secondary-apple"></a>`--color-text-secondary-apple` | Text secondary apple | `#707579` | `#AAAAAA` | No CSS alias; copies the palette secondary value ([--color-text-secondary](#color-text-secondary)) |
| <a id="color-text-meta"></a>`--color-text-meta` | Metadata text | `#707579` | `#AAAAAA` | No CSS alias; copies the palette secondary value ([--color-text-secondary](#color-text-secondary)) |
| <a id="color-text-meta-rgb"></a>`--color-text-meta-rgb` | Comma-separated metadata-text channels | `112, 117, 121` | `170, 170, 170` | No CSS alias; channels of the palette secondary value ([--color-text-secondary-rgb](#color-text-secondary-rgb)) |
| <a id="color-text-meta-colored"></a>`--color-text-meta-colored` | Text meta colored | `#4DCD5E` | `#8378DB` | No; literal or Sass-computed value |
| <a id="color-text-meta-apple"></a>`--color-text-meta-apple` | Text meta apple | `#707579` | `#AAAAAA` | No CSS alias; copies the palette secondary value ([--color-text-secondary](#color-text-secondary)) |
| <a id="color-text-green"></a>`--color-text-green` | Text green | `#4fae4e` | `#4fae4e` | No; literal or Sass-computed value |
| <a id="color-text-green-rgb"></a>`--color-text-green-rgb` | Text green rgb | `79, 174, 78` | `79, 174, 78` | No; literal or Sass-computed value |
| <a id="color-borders"></a>`--color-borders` | Borders | `#DADCE0` | `#303030` | No; literal or Sass-computed value |
| <a id="color-borders-input"></a>`--color-borders-input` | Borders input | `#DADCE0` | `#5B5B5A` | No; literal or Sass-computed value |
| <a id="color-borders-alternate"></a>`--color-borders-alternate` | Borders alternate | `rgba(0, 0, 0, 0.1)` | `rgba(0, 0, 0, 0.1)` | No; literal or Sass-computed value |
| <a id="color-borders-read-story"></a>`--color-borders-read-story` | Borders read story | `#C4C9CC` | `#737373` | No; literal or Sass-computed value |
| <a id="color-dividers"></a>`--color-dividers` | Dividers | `#C8C6CC` | `#3B3B3D` | No; literal or Sass-computed value |
| <a id="color-dividers-android"></a>`--color-dividers-android` | Dividers android | `#E7E7E7` | `#0F0F0F` | No; literal or Sass-computed value |
| <a id="color-interactive-active"></a>`--color-interactive-active` | Active interactive elements | `var(--color-primary)` | `var(--color-primary)` | CSS alias: [--color-primary](#color-primary) |
| <a id="color-interactive-inactive"></a>`--color-interactive-inactive` | Inactive interactive elements | `rgba(var(--color-text-secondary-rgb), 0.25)` | `rgba(var(--color-text-secondary-rgb), 0.25)` | CSS-derived: [--color-text-secondary-rgb](#color-text-secondary-rgb) |
| <a id="color-interactive-buffered"></a>`--color-interactive-buffered` | Buffered overlay over the inactive surface | `rgba(var(--color-text-secondary-rgb), 0.25)` | `rgba(var(--color-text-secondary-rgb), 0.25)` | CSS-derived: [--color-text-secondary-rgb](#color-text-secondary-rgb) |
| <a id="color-interactive-element-hover"></a>`--color-interactive-element-hover` | Interactive hover overlay | `rgba(var(--color-text-secondary-rgb), 0.08)` | `rgba(var(--color-text-secondary-rgb), 0.08)` | CSS-derived: [--color-text-secondary-rgb](#color-text-secondary-rgb) |
| <a id="color-toast-background"></a>`--color-toast-background` | Toast background | `#202020CC` | `#000000CC` | No; literal or Sass-computed value |
| <a id="color-primary"></a>`--color-primary` | App accent and filled primary controls | `#3390EC` | `#8774E1` | Runtime palette accent; server-theme base adjustments can change it; the wallet card buttons override it at runtime with a color derived from the card backdrop |
| <a id="color-primary-foreground"></a>`--color-primary-foreground` | Text/icons on filled primary controls | `#ffffff` | `#ffffff` | Chosen runtime filled-control foreground; not an alias to white |
| <a id="color-primary-shade"></a>`--color-primary-shade` | Primary hover/pressed shade | `#2f84d9` | `#7c6bcf` | No CSS alias; [--color-primary](#color-primary) mixed 8% toward the selected neutral; the wallet card buttons override it at runtime with a color derived from the card backdrop |
| <a id="color-primary-shade-darker"></a>`--color-primary-shade-darker` | Primary pressed shade without ripple | `#2b79c6` | `#7161bd` | No CSS alias; base-theme values mix [--color-primary](#color-primary) 16% toward black; runtime palettes mix toward their selected neutral; the wallet card buttons override it at runtime with a color derived from the card backdrop |
| <a id="color-primary-shade-rgb"></a>`--color-primary-shade-rgb` | Comma-separated channels of the primary shade | `47, 132, 217` | `124, 107, 207` | No CSS alias; channels of [--color-primary-shade](#color-primary-shade) |
| <a id="color-primary-opacity"></a>`--color-primary-opacity` | Low-opacity primary surface | `#3390EC1e` | `#8774E11e` | No CSS alias after initialization; [--color-primary](#color-primary) with alpha `1e` |
| <a id="color-primary-opacity-hover"></a>`--color-primary-opacity-hover` | Primary hover tint | `#3390EC40` | `#8774E140` | No CSS alias after initialization; [--color-primary](#color-primary) with alpha `40` |
| <a id="color-primary-tint"></a>`--color-primary-tint` | Subtle primary tint | `#3390EC1a` | `#8774E11a` | No CSS alias after initialization; [--color-primary](#color-primary) with alpha `1a` |
| <a id="color-active"></a>`--color-active` | Active accent | `#3390EC` | `#8774E1` | No CSS alias; copies the palette accent ([--color-primary](#color-primary)) |
| <a id="color-active-darker"></a>`--color-active-darker` | Active accent shade | `#2f84d9` | `#7c6bcf` | No CSS alias; copies the generated [--color-primary-shade](#color-primary-shade) |
| <a id="color-success"></a>`--color-success` | Success | `#00C73E` | `#00C73E` | No; literal or Sass-computed value |
| <a id="accent-color"></a>`--accent-color` | Shared peer/component accent | `var(--color-primary)` | `var(--color-primary)` | CSS alias: [--color-primary](#color-primary) |
| <a id="accent-background-color"></a>`--accent-background-color` | Shared accent-tinted surface | `var(--color-primary-tint)` | `var(--color-primary-tint)` | CSS alias: [--color-primary-tint](#color-primary-tint) |
| <a id="accent-background-active-color"></a>`--accent-background-active-color` | Shared active accent surface | `var(--color-primary-opacity-hover)` | `var(--color-primary-opacity-hover)` | CSS alias: [--color-primary-opacity-hover](#color-primary-opacity-hover) |
| <a id="color-green"></a>`--color-green` | Green | `#00C73E` | `#00C73E` | No; literal or Sass-computed value |
| <a id="color-green-darker"></a>`--color-green-darker` | Green darker | `#00A734` | `#00A734` | No; literal or Sass-computed value |
| <a id="color-green-rgb"></a>`--color-green-rgb` | Green rgb | `0, 199, 62` | `0, 199, 62` | No; literal or Sass-computed value |
| <a id="color-error"></a>`--color-error` | Destructive/error text | `#ff3b30` | `#eb5545` | No; generated palette value |
| <a id="color-error-background"></a>`--color-error-background` | Filled destructive controls | `#b3261e` | `#b3261e` | No; generated palette value |
| <a id="color-error-foreground"></a>`--color-error-foreground` | Text/icons on destructive controls | `#ffffff` | `#ffffff` | No; generated palette value |
| <a id="color-error-shade"></a>`--color-error-shade` | Error shade | `#b3261e` | `#b3261e` | No; generated palette value |
| <a id="color-error-rgb"></a>`--color-error-rgb` | Error rgb | `255, 59, 48` | `235, 85, 69` | No CSS alias; channels of [--color-error](#color-error) |
| <a id="color-warning"></a>`--color-warning` | Warning | `#fb8c00` | `#fb8c00` | No; literal or Sass-computed value |
| <a id="color-yellow"></a>`--color-yellow` | Yellow | `#fdd764` | `#fdd764` | No; literal or Sass-computed value |
| <a id="color-marked"></a>`--color-marked` | Marked | `rgba(253, 215, 100, 0.5)` | `rgba(253, 215, 100, 0.5)` | No; literal or Sass-computed value |
| <a id="color-orange"></a>`--color-orange` | Orange | `#d08a31` | `#d08a31` | No; literal or Sass-computed value |
| <a id="color-light-coral"></a>`--color-light-coral` | Light coral | `rgba(208, 138, 49, 0.2)` | `rgba(208, 138, 49, 0.2)` | No; literal or Sass-computed value |
| <a id="color-links"></a>`--color-links` | App links | `#3390EC` | `#8774E1` | No CSS alias; copies the palette accent ([--color-primary](#color-primary)) |
| <a id="color-placeholders"></a>`--color-placeholders` | Placeholders | `#a2acb4` | `#a2acb4` | No; literal or Sass-computed value |
| <a id="color-list-icon"></a>`--color-list-icon` | List icon | `#ABAFB1` | `#A2A2A2` | No; literal or Sass-computed value |
| <a id="color-white"></a>`--color-white` | Literal white; independent of the theme accent | `#ffffff` | `#ffffff` | No; literal or Sass-computed value |
| <a id="color-gray"></a>`--color-gray` | Gray | `#C4C9CC` | `#717579` | No; literal or Sass-computed value |
| <a id="color-chat-username"></a>`--color-chat-username` | Chat username | `#3C7EB0` | `#E9EEF4` | No; literal or Sass-computed value |
| <a id="color-chat-hover"></a>`--color-chat-hover` | Chat hover | `#F4F4F5` | `#2C2C2C` | No; literal or Sass-computed value |
| <a id="color-chat-active"></a>`--color-chat-active` | Chat active | `#3390EC` | `#8774E1` | No CSS alias; copies the palette accent ([--color-primary](#color-primary)) |
| <a id="color-item-hover"></a>`--color-item-hover` | Item hover | `#F4F4F5` | `#2C2C2C` | No; literal or Sass-computed value |
| <a id="color-item-active"></a>`--color-item-active` | Item active | `#EDEDED` | `#292929` | No; literal or Sass-computed value |
| <a id="color-text-selection"></a>`--color-text-selection` | Selected-text background of the global `::selection` rule | `#3390EC4d` | `#8774E14d` | No CSS alias after initialization; [--color-primary](#color-primary) with alpha `4d` |
| <a id="color-selection-highlight-emoji"></a>`--color-selection-highlight-emoji` | Selected custom-emoji background | `#3390EC4d` | `#8774E14d` | No CSS alias after initialization; [--color-primary](#color-primary) with alpha `4d`, matching [--color-text-selection](#color-text-selection) |
| <a id="color-avatar-story-unread-from"></a>`--color-avatar-story-unread-from` | Avatar story unread from | `#34c578` | `#34c578` | No; literal or Sass-computed value |
| <a id="color-avatar-story-unread-to"></a>`--color-avatar-story-unread-to` | Avatar story unread to | `#3ca3f3` | `#3ca3f3` | No; literal or Sass-computed value |
| <a id="color-avatar-story-friend-unread-from"></a>`--color-avatar-story-friend-unread-from` | Avatar story friend unread from | `#c9eb38` | `#c9eb38` | No; literal or Sass-computed value |
| <a id="color-avatar-story-friend-unread-to"></a>`--color-avatar-story-friend-unread-to` | Avatar story friend unread to | `#09c167` | `#09c167` | No; literal or Sass-computed value |
| <a id="color-default-shadow"></a>`--color-default-shadow` | Default shadow | `#72727240` | `#1010109c` | No; literal or Sass-computed value |
| <a id="color-light-shadow"></a>`--color-light-shadow` | Light shadow | `#7272722B` | `#00000040` | No; literal or Sass-computed value |
| <a id="color-skeleton-background"></a>`--color-skeleton-background` | Skeleton background | `rgba(33, 33, 33, 0.15)` | `rgba(33, 33, 33, 0.15)` | No; literal or Sass-computed value |
| <a id="color-skeleton-foreground"></a>`--color-skeleton-foreground` | Skeleton foreground | `rgba(232, 232, 232, 0.2)` | `rgba(232, 232, 232, 0.2)` | No; literal or Sass-computed value |
| <a id="color-scrollbar"></a>`--color-scrollbar` | Scrollbar | `rgba(90, 90, 90, 0.3)` | `rgba(90, 90, 90, 0.3)` | No; literal or Sass-computed value |
| <a id="color-telegram-blue"></a>`--color-telegram-blue` | Fixed Telegram brand blue | `#3390ec` | `#3390ec` | No; literal or Sass-computed value |
| <a id="color-forum-hover-unread-topic"></a>`--color-forum-hover-unread-topic` | Forum hover unread topic | `#e9e9e9` | `#e9e9e9` | No; literal or Sass-computed value |
| <a id="color-forum-hover-unread-topic-hover"></a>`--color-forum-hover-unread-topic-hover` | Forum hover unread topic hover | `#e2e2e2` | `#3f3f3f` | No; literal or Sass-computed value |
| <a id="color-deleted-account"></a>`--color-deleted-account` | Deleted account | `#9eaab5` | `#9eaab5` | No; literal or Sass-computed value |
| <a id="color-archive"></a>`--color-archive` | Archive | `#9eaab5` | `#9eaab5` | No; literal or Sass-computed value |
| <a id="stars-gradient"></a>`--stars-gradient` | Stars gradient | `linear-gradient(90deg, #FFAA00 0%, #FFCD3A 100%)` | `linear-gradient(90deg, #FFAA00 0%, #FFCD3A 100%)` | No; literal or Sass-computed value |
| <a id="color-stars"></a>`--color-stars` | Stars | `#FFAA00` | `#FFAA00` | No; literal or Sass-computed value |
| <a id="color-heart"></a>`--color-heart` | Heart | `#ff3c32` | `#ff3c32` | No; literal or Sass-computed value |
| <a id="color-gift-uncommon"></a>`--color-gift-uncommon` | Gift uncommon | `#40A920` | `#40A920` | No; literal or Sass-computed value |
| <a id="color-gift-uncommon-bg"></a>`--color-gift-uncommon-bg` | Gift uncommon bg | `rgba(64, 169, 32, 0.15)` | `rgba(64, 169, 32, 0.15)` | No; literal or Sass-computed value |
| <a id="color-gift-rare"></a>`--color-gift-rare` | Gift rare | `#11AABE` | `#11AABE` | No; literal or Sass-computed value |
| <a id="color-gift-rare-bg"></a>`--color-gift-rare-bg` | Gift rare bg | `rgba(17, 170, 190, 0.15)` | `rgba(17, 170, 190, 0.15)` | No; literal or Sass-computed value |
| <a id="color-gift-epic"></a>`--color-gift-epic` | Gift epic | `#955CDB` | `#955CDB` | No; literal or Sass-computed value |
| <a id="color-gift-epic-bg"></a>`--color-gift-epic-bg` | Gift epic bg | `rgba(149, 92, 219, 0.15)` | `rgba(149, 92, 219, 0.15)` | No; literal or Sass-computed value |
| <a id="color-gift-legendary"></a>`--color-gift-legendary` | Gift legendary | `#BF7600` | `#BF7600` | No; literal or Sass-computed value |
| <a id="color-gift-legendary-bg"></a>`--color-gift-legendary-bg` | Gift legendary bg | `rgba(191, 118, 0, 0.15)` | `rgba(191, 118, 0, 0.15)` | No; literal or Sass-computed value |
| <a id="color-negative-progress"></a>`--color-negative-progress` | Negative progress | `#CE4C47` | `#CE4C47` | No; literal or Sass-computed value |
| <a id="premium-gradient"></a>`--premium-gradient` | Premium gradient | `linear-gradient(84.4deg, #6C93FF -4.85%, #976FFF 51.72%, #DF69D1 110.7%)` | `linear-gradient(84.4deg, #6C93FF -4.85%, #976FFF 51.72%, #DF69D1 110.7%)` | No; literal or Sass-computed value |
| <a id="color-web-app-browser"></a>`--color-web-app-browser` | Web app browser | `#FFFFFFBB` | `#0303038F` | No; literal or Sass-computed value |
| <a id="color-chat-active-greyed"></a>`--color-chat-active-greyed` | Chat active greyed | `#2973bd` | `#6c5db4` | No CSS alias; [--color-primary](#color-primary) mixed 20% toward the selected neutral |
| <a id="color-topic-blue"></a>`--color-topic-blue` | Topic blue | `#2F7772` | `#6ff9f0` | No; literal or Sass-computed value |
| <a id="color-topic-yellow"></a>`--color-topic-yellow` | Topic yellow | `#7F693B` | `#ffd67e` | No; literal or Sass-computed value |
| <a id="color-topic-violet"></a>`--color-topic-violet` | Topic violet | `#8B5A96` | `#cb86db` | No; literal or Sass-computed value |
| <a id="color-topic-green"></a>`--color-topic-green` | Topic green | `#44774A` | `#8eee98` | No; literal or Sass-computed value |
| <a id="color-topic-rose"></a>`--color-topic-rose` | Topic rose | `#9B576B` | `#ff93b2` | No; literal or Sass-computed value |
| <a id="color-topic-red"></a>`--color-topic-red` | Topic red | `#EB6858` | `#fb6f5f` | No; literal or Sass-computed value |
| <a id="color-topic-grey"></a>`--color-topic-grey` | Topic grey | `#6C6C6C` | `#999999` | No; literal or Sass-computed value |
| <a id="color-forum-unread-topic-hover"></a>`--color-forum-unread-topic-hover` | Forum unread topic hover | `#e9e9e9` | `#363636` | No; literal or Sass-computed value |
| <a id="color-hover-overlay"></a>`--color-hover-overlay` | Hover overlay | `#00000006` | `#ffffff06` | No; literal or Sass-computed value |

The primary alpha variants have stylesheet fallback references to [--color-primary](#color-primary), but initialization replaces them with generated alpha colors. The same distinction applies to the outgoing compatibility variables in the message section.

### Peer colors

[Peer-color generation](src/util/theme.ts) writes indexed root variables. IDs 0–6 initially use `#D45246`, `#F68136`, `#6C61DF`, `#46BA43`, `#5CAFFA`, `#408ACF` and `#D95574`; server peer colors can replace them, including separate dark colors.

| Variable / family | Default | Default reference / inheritance |
| --- | --- | --- |
| <a id="color-peer-{id}"></a>`--color-peer-{id}` | `First configured peer color` | No CSS alias; runtime color |
| <a id="color-peer-bg-{id}"></a>`--color-peer-bg-{id}` | `Peer color with alpha 1a` | No CSS alias; generated from [--color-peer-{id}](#color-peer-{id}) |
| <a id="color-peer-bg-active-{id}"></a>`--color-peer-bg-active-{id}` | `Peer color with alpha 2b` | No CSS alias; generated from [--color-peer-{id}](#color-peer-{id}) |
| <a id="color-peer-gradient-{id}"></a>`--color-peer-gradient-{id}` | `Repeating -45deg stripes in 5px steps when multiple colors exist` | No CSS alias; generated from the peer-color list |
| <a id="bar-gradient"></a>`--bar-gradient` | `var(--color-peer-gradient-{id})` | CSS alias in .peer-color-{id}: [--color-peer-gradient-{id}](#color-peer-gradient-{id}) |

Inside `.peer-color-{id}`, [--accent-color](#accent-color) aliases [--color-peer-{id}](#color-peer-{id}) with [--color-text](#color-text) as fallback. Accent backgrounds alias the indexed peer background variables, falling back to [--hover-color](#hover-color) and [--active-color](#active-color). The `.peer-color-count-*` wrappers use those hover/active aliases directly.

## Message-specific variables

The [runtime palette](src/util/theme.ts) defines separate incoming and outgoing roles. [Message styles](src/components/middle/message/Message.scss) select the incoming family by default; `.Message.own` selects the outgoing family. Message lists resolve their own chat palette, so retained lists do not borrow another chat's colors. Selecting a global color theme temporarily replaces the open chat's palette and wallpaper in that tab, until navigation leaves the chat. CSS fallbacks exist before initialization; the following default tables describe the initialized current implementation, not a contrast guarantee. An inline result's widget preview ([WidgetResult styles](src/components/middle/composer/inlineResults/WidgetResult.module.scss)) sits outside any message and re-aliases the incoming family itself, so it takes an incoming bubble's colors.

### Direction aliases

Every row is a live CSS alias. The alias is local to `.Message`; the directional source is supplied by the inherited chat palette.

| Variable | Default source (incoming) | Source in .Message.own | Purpose |
| --- | --- | --- | --- |
| <a id="message-background"></a>`--message-background` | [--message-incoming-background](#message-incoming-background) | [--message-outgoing-background](#message-outgoing-background) | Solid bubble fill / gradient fallback |
| <a id="message-text"></a>`--message-text` | [--message-incoming-text](#message-incoming-text) | [--message-outgoing-text](#message-outgoing-text) | Primary message text |
| <a id="message-secondary"></a>`--message-secondary` | [--message-incoming-secondary](#message-incoming-secondary) | [--message-outgoing-secondary](#message-outgoing-secondary) | Secondary message text |
| <a id="message-links"></a>`--message-links` | [--message-incoming-links](#message-incoming-links) | [--message-outgoing-links](#message-outgoing-links) | Links and mentions |
| <a id="message-links-decoration"></a>`--message-links-decoration` | [--message-incoming-links-decoration](#message-incoming-links-decoration) | [--message-outgoing-links-decoration](#message-outgoing-links-decoration) | Underline when links and primary text use the same color |
| <a id="message-links-decoration-hover"></a>`--message-links-decoration-hover` | [--message-incoming-links-decoration-hover](#message-incoming-links-decoration-hover) | [--message-outgoing-links-decoration-hover](#message-outgoing-links-decoration-hover) | Link decoration on hover and press; the opposite of [--message-links-decoration](#message-links-decoration) |
| <a id="message-meta"></a>`--message-meta` | [--message-incoming-meta](#message-incoming-meta) | [--message-outgoing-meta](#message-outgoing-meta) | Time and other metadata |
| <a id="message-accent"></a>`--message-accent` | [--message-incoming-accent](#message-incoming-accent) | [--message-outgoing-accent](#message-outgoing-accent) | Reply, quote and content accents |
| <a id="message-accent-foreground"></a>`--message-accent-foreground` | [--message-incoming-accent-foreground](#message-incoming-accent-foreground) | [--message-outgoing-accent-foreground](#message-outgoing-accent-foreground) | Foreground on a filled accent |
| <a id="message-control"></a>`--message-control` | [--message-incoming-control](#message-incoming-control) | [--message-outgoing-control](#message-outgoing-control) | Filled media/control color |
| <a id="message-control-foreground"></a>`--message-control-foreground` | [--message-incoming-control-foreground](#message-incoming-control-foreground) | [--message-outgoing-control-foreground](#message-outgoing-control-foreground) | Foreground on a filled control |
| <a id="message-file-title"></a>`--message-file-title` | [--message-incoming-file-title](#message-incoming-file-title) | [--message-outgoing-file-title](#message-outgoing-file-title) | Document/audio title |
| <a id="message-file-description"></a>`--message-file-description` | [--message-incoming-file-description](#message-incoming-file-description) | [--message-outgoing-file-description](#message-outgoing-file-description) | Document/audio secondary details |
| <a id="message-checkbox-fill"></a>`--message-checkbox-fill` | [--message-incoming-checkbox-fill](#message-incoming-checkbox-fill) | [--message-outgoing-checkbox-fill](#message-outgoing-checkbox-fill) | Poll/todo checked fill |
| <a id="message-checkbox-foreground"></a>`--message-checkbox-foreground` | [--message-incoming-checkbox-foreground](#message-incoming-checkbox-foreground) | [--message-outgoing-checkbox-foreground](#message-outgoing-checkbox-foreground) | Checked-marker foreground |
| <a id="message-table-background"></a>`--message-table-background` | [--message-incoming-table-background](#message-incoming-table-background) | [--message-outgoing-table-background](#message-outgoing-table-background) | Rich-text table surface |
| <a id="message-table-border"></a>`--message-table-border` | [--message-incoming-table-border](#message-incoming-table-border) | [--message-outgoing-table-border](#message-outgoing-table-border) | Rich-text table borders |
| <a id="message-tint"></a>`--message-tint` | [--message-incoming-tint](#message-incoming-tint) | [--message-outgoing-tint](#message-outgoing-tint) | Reply/reaction tinted surface |
| <a id="message-tint-hover"></a>`--message-tint-hover` | [--message-incoming-tint-hover](#message-incoming-tint-hover) | [--message-outgoing-tint-hover](#message-outgoing-tint-hover) | Stronger hover/active tint |
| <a id="message-selected"></a>`--message-selected` | [--message-incoming-selected](#message-incoming-selected) | [--message-outgoing-selected](#message-outgoing-selected) | Selected bubble fill |
| <a id="message-selected-text"></a>`--message-selected-text` | [--message-incoming-selected-text](#message-incoming-selected-text) | [--message-outgoing-selected-text](#message-outgoing-selected-text) | Text on the selected bubble |
| <a id="message-error"></a>`--message-error` | [--message-incoming-error](#message-incoming-error) | [--message-outgoing-error](#message-outgoing-error) | Error/wrong-answer text |
| <a id="message-error-background"></a>`--message-error-background` | [--message-incoming-error-background](#message-incoming-error-background) | [--message-outgoing-error-background](#message-outgoing-error-background) | Filled error marker |
| <a id="message-error-foreground"></a>`--message-error-foreground` | [--message-incoming-error-foreground](#message-incoming-error-foreground) | [--message-outgoing-error-foreground](#message-outgoing-error-foreground) | Foreground on filled error marker |
| <a id="message-text-rgb"></a>`--message-text-rgb` | [--message-incoming-text-rgb](#message-incoming-text-rgb) | [--message-outgoing-text-rgb](#message-outgoing-text-rgb) | Primary text channels, without alpha |
| <a id="message-secondary-rgb"></a>`--message-secondary-rgb` | [--message-incoming-secondary-rgb](#message-incoming-secondary-rgb) | [--message-outgoing-secondary-rgb](#message-outgoing-secondary-rgb) | Secondary text channels, without alpha |
| <a id="message-meta-rgb"></a>`--message-meta-rgb` | [--message-incoming-meta-rgb](#message-incoming-meta-rgb) | [--message-outgoing-meta-rgb](#message-outgoing-meta-rgb) | Metadata text channels, without alpha |
| <a id="message-accent-rgb"></a>`--message-accent-rgb` | [--message-incoming-accent-rgb](#message-incoming-accent-rgb) | [--message-outgoing-accent-rgb](#message-outgoing-accent-rgb) | Accent channels, without alpha |
| <a id="message-ripple"></a>`--message-ripple` | [--message-incoming-ripple](#message-incoming-ripple) | [--message-outgoing-ripple](#message-outgoing-ripple) | Ripple overlay |
| <a id="message-code-dark"></a>`--message-code-dark` | [--message-incoming-code-dark](#message-incoming-code-dark) | [--message-outgoing-code-dark](#message-outgoing-code-dark) | `1` selects a black `#00000080` code surface and dark [syntax colors](src/components/common/code/_codeHighlight.scss), `0` selects the [--accent-background-color](#message-alias-accent-background-color) surface and light syntax colors |

### Directional palette defaults

`{direction}` means `incoming` or `outgoing`. Each row anchors both concrete variables. Values are generated or copied by JavaScript, not CSS aliases to the shorter message role.

| Variable family | Incoming light / dark | Outgoing light / dark | Default reference / derivation |
| --- | --- | --- | --- |
| <a id="message-incoming-background"></a>`--message-incoming-background`<br><a id="message-outgoing-background"></a>`--message-outgoing-background` | `#FFFFFF`<br>`#212121` | `#E1FFC7`<br>`#766AC8` | No CSS alias; generated palette role |
| <a id="message-incoming-text"></a>`--message-incoming-text`<br><a id="message-outgoing-text"></a>`--message-outgoing-text` | `#000000`<br>`#ffffff` | `#000000`<br>`#ffffff` | No CSS alias; generated palette role |
| <a id="message-incoming-secondary"></a>`--message-incoming-secondary`<br><a id="message-outgoing-secondary"></a>`--message-outgoing-secondary` | `#52525299`<br>`#ffffff80` | `#3f8c00cc`<br>`#ffffffa6` | No CSS alias; generated palette role; light incoming is a fixed translucent gray |
| <a id="message-incoming-links"></a>`--message-incoming-links`<br><a id="message-outgoing-links"></a>`--message-outgoing-links` | `#3390EC`<br>`#8774E1` | `#3390EC`<br>`#ffffff` | No CSS alias; generated palette role; in the light theme, incoming links use the default light [--color-links](#color-links) value regardless of the theme accent, and outgoing links on dark-text fills use the outbox accent, falling back to the same blue; dark incoming links copy the accent, and other outgoing links copy the text color |
| <a id="message-incoming-links-decoration"></a>`--message-incoming-links-decoration`<br><a id="message-outgoing-links-decoration"></a>`--message-outgoing-links-decoration` | `none`<br>`none` | `none`<br>`underline` | No CSS alias; underline if link and text colors match, otherwise none |
| <a id="message-incoming-links-decoration-hover"></a>`--message-incoming-links-decoration-hover`<br><a id="message-outgoing-links-decoration-hover"></a>`--message-outgoing-links-decoration-hover` | `underline`<br>`underline` | `underline`<br>`none` | No CSS alias; none if link and text colors match, otherwise underline, so hover always flips the resting decoration; stylesheet fallback is `none` to match the `underline` fallback of [--message-incoming-links-decoration](#message-incoming-links-decoration) |
| <a id="message-incoming-meta"></a>`--message-incoming-meta`<br><a id="message-outgoing-meta"></a>`--message-outgoing-meta` | `#52525299`<br>`#ffffff80` | `#3f8c00cc`<br>`#ffffffa6` | No CSS alias; copies the secondary palette value ([--message-secondary](#message-secondary)) |
| <a id="message-incoming-accent"></a>`--message-incoming-accent`<br><a id="message-outgoing-accent"></a>`--message-outgoing-accent` | `#3390EC`<br>`#8774E1` | `#3f8c00`<br>`#ffffff` | No CSS alias; generated palette role |
| <a id="message-incoming-accent-foreground"></a>`--message-incoming-accent-foreground`<br><a id="message-outgoing-accent-foreground"></a>`--message-outgoing-accent-foreground` | `#ffffff`<br>`#ffffff` | `#ffffff`<br>`#000000` | No CSS alias; generated palette role |
| <a id="message-incoming-control"></a>`--message-incoming-control`<br><a id="message-outgoing-control"></a>`--message-outgoing-control` | `#3390EC`<br>`#8774E1` | `#3f8c00`<br>`#ffffff` | No CSS alias; generated palette role; stylesheet-only fallback aliases [--color-primary](#color-primary) |
| <a id="message-incoming-control-foreground"></a>`--message-incoming-control-foreground`<br><a id="message-outgoing-control-foreground"></a>`--message-outgoing-control-foreground` | `#ffffff`<br>`#ffffff` | `#ffffff`<br>`#000000` | No CSS alias; incoming copies the primary foreground; outgoing chooses black or white from the control fill's brightness |
| <a id="message-incoming-file-title"></a>`--message-incoming-file-title`<br><a id="message-outgoing-file-title"></a>`--message-outgoing-file-title` | `#000000`<br>`#ffffff` | `#000000`<br>`#ffffff` | No CSS alias; generated palette role; stylesheet-only fallback aliases [--color-text](#color-text) |
| <a id="message-incoming-file-description"></a>`--message-incoming-file-description`<br><a id="message-outgoing-file-description"></a>`--message-outgoing-file-description` | `#999999`<br>`#ffffff80` | `#3f8c00cc`<br>`#ffffffa6` | No CSS alias; generated palette role; light incoming is a fixed `#999999`; stylesheet-only fallback aliases [--color-text-secondary](#color-text-secondary) |
| <a id="message-incoming-checkbox-fill"></a>`--message-incoming-checkbox-fill`<br><a id="message-outgoing-checkbox-fill"></a>`--message-outgoing-checkbox-fill` | `#3390EC`<br>`#8774E1` | `#3f8c00`<br>`#ffffff` | No CSS alias; generated palette role; stylesheet-only fallback aliases [--color-primary](#color-primary) |
| <a id="message-incoming-checkbox-foreground"></a>`--message-incoming-checkbox-foreground`<br><a id="message-outgoing-checkbox-foreground"></a>`--message-outgoing-checkbox-foreground` | `#ffffff`<br>`#ffffff` | `#ffffff`<br>`#000000` | No CSS alias; copies the corresponding filled-control foreground in JavaScript |
| <a id="message-incoming-table-background"></a>`--message-incoming-table-background`<br><a id="message-outgoing-table-background"></a>`--message-outgoing-table-background` | `#0000000d`<br>`#8774E11a` | `#3f8c001a`<br>`#ffffff1a` | No CSS alias; generated palette role |
| <a id="message-incoming-table-border"></a>`--message-incoming-table-border`<br><a id="message-outgoing-table-border"></a>`--message-outgoing-table-border` | `#0000001a`<br>`#8774E140` | `#3f8c0040`<br>`#ffffff40` | No CSS alias; generated palette role |
| <a id="message-incoming-tint"></a>`--message-incoming-tint`<br><a id="message-outgoing-tint"></a>`--message-outgoing-tint` | `#3390EC1f`<br>`#8774E11f` | `#3f8c001f`<br>`#ffffff1f` | No CSS alias; [--message-accent](#message-accent) with alpha 1f |
| <a id="message-incoming-tint-hover"></a>`--message-incoming-tint-hover`<br><a id="message-outgoing-tint-hover"></a>`--message-outgoing-tint-hover` | `#3390EC3d`<br>`#8774E13d` | `#3f8c003d`<br>`#ffffff3d` | No CSS alias; [--message-accent](#message-accent) with alpha 3d |
| <a id="message-incoming-selected"></a>`--message-incoming-selected`<br><a id="message-outgoing-selected"></a>`--message-outgoing-selected` | `#e6e6e6`<br>`#1e1e1e` | `#cbe6b3`<br>`#6a5fb4` | No CSS alias; solid fill mixed 10% toward black |
| <a id="message-incoming-selected-text"></a>`--message-incoming-selected-text`<br><a id="message-outgoing-selected-text"></a>`--message-outgoing-selected-text` | `#000000`<br>`#ffffff` | `#000000`<br>`#ffffff` | No CSS alias; copies primary text ([--message-text](#message-text)) |
| <a id="message-incoming-error"></a>`--message-incoming-error`<br><a id="message-outgoing-error"></a>`--message-outgoing-error` | `#ff3b30`<br>`#ffffff` | `#ff3b30`<br>`#ffffff` | No CSS alias; generated palette role |
| <a id="message-incoming-error-background"></a>`--message-incoming-error-background`<br><a id="message-outgoing-error-background"></a>`--message-outgoing-error-background` | `#b3261e`<br>`#b3261e` | `#b3261e`<br>`#b3261e` | No CSS alias; literal #b3261e |
| <a id="message-incoming-error-foreground"></a>`--message-incoming-error-foreground`<br><a id="message-outgoing-error-foreground"></a>`--message-outgoing-error-foreground` | `#ffffff`<br>`#ffffff` | `#ffffff`<br>`#ffffff` | No CSS alias; literal white |
| <a id="message-incoming-text-rgb"></a>`--message-incoming-text-rgb`<br><a id="message-outgoing-text-rgb"></a>`--message-outgoing-text-rgb` | `0, 0, 0`<br>`255, 255, 255` | `0, 0, 0`<br>`255, 255, 255` | No CSS alias; separately assigned RGB channels of [--message-text](#message-text) |
| <a id="message-incoming-secondary-rgb"></a>`--message-incoming-secondary-rgb`<br><a id="message-outgoing-secondary-rgb"></a>`--message-outgoing-secondary-rgb` | `82, 82, 82`<br>`255, 255, 255` | `63, 140, 0`<br>`255, 255, 255` | No CSS alias; separately assigned RGB channels of [--message-secondary](#message-secondary) |
| <a id="message-incoming-meta-rgb"></a>`--message-incoming-meta-rgb`<br><a id="message-outgoing-meta-rgb"></a>`--message-outgoing-meta-rgb` | `82, 82, 82`<br>`255, 255, 255` | `63, 140, 0`<br>`255, 255, 255` | No CSS alias; separately assigned RGB channels of [--message-meta](#message-meta) |
| <a id="message-incoming-accent-rgb"></a>`--message-incoming-accent-rgb`<br><a id="message-outgoing-accent-rgb"></a>`--message-outgoing-accent-rgb` | `51, 144, 236`<br>`135, 116, 225` | `63, 140, 0`<br>`255, 255, 255` | No CSS alias; separately assigned RGB channels of [--message-accent](#message-accent) |
| <a id="message-incoming-ripple"></a>`--message-incoming-ripple`<br><a id="message-outgoing-ripple"></a>`--message-outgoing-ripple` | `#ffffff14`<br>`#00000014` | `#ffffff14`<br>`#00000014` | No CSS alias; opposite primary-text polarity with alpha 14 |
| <a id="message-incoming-code-dark"></a>`--message-incoming-code-dark`<br><a id="message-outgoing-code-dark"></a>`--message-outgoing-code-dark` | `0`<br>`1` | `0`<br>`1` | No CSS alias; `1` under white text, otherwise `0` |
| <a id="message-outgoing-text-selection"></a>`--message-outgoing-text-selection` | Outgoing only | `#bbde9f`<br>`#ffffff4d` | No CSS alias; follows iOS: under dark text the solid fill multiplied in HSV by (1.013 × 0.75, 1.292, 0.871), with a fixed `#bbde9f` for the built-in light bubble; under white text white with alpha `4d` |
| <a id="message-outgoing-text-selection-emoji"></a>`--message-outgoing-text-selection-emoji` | Outgoing only | `#bbde9fb3`<br>`#ffffff4d` | No CSS alias; [--message-outgoing-text-selection](#message-outgoing-text-selection) with alpha `b3` when that is opaque, so custom emoji stay visible under it; otherwise the same value |

Server message colors replace the outgoing stops. When stops are absent, the base theme supplies its fallback. Light/day/classic outgoing accents, controls, secondary text and file details are derived separately; night/tinted palettes use their selected black/white foreground family. Incoming night and tinted fills also depend on the base theme. The outgoing canvas consumes the same stop list as the palette's solid fallback; the stop list itself is not a CSS variable.

### Shared message surfaces

These roles are shared by incoming and outgoing messages. Fixed values remain separate literals even when they match another variable.

| Variable | Purpose | Default | Default reference / inheritance |
| --- | --- | --- | --- |
| <a id="action-message-bg"></a>`--action-message-bg` | Dates, service chips and other neutral translucent message surfaces | Re-expressed at 85% alpha with the same composite over the backdrop. Light: the wallpaper tint against the wallpaper's average color. Dark masked patterns: the chat's [--message-incoming-background](#message-incoming-background) against the black base. Other dark wallpapers: the average wallpaper color with saturation raised and HSV value × 0.65, at 0.4 alpha. Light `#00000040`, dark `#00000080` when no tint is known | No CSS alias; assigned on the document root from the global wallpaper and copied into chat theme overrides from the chat's wallpaper (custom, server theme or peer) |
| <a id="message-service-background"></a>`--message-service-background` | Service chips, custom-shape content and inline-button surfaces | `var(--action-message-bg)` | Live CSS alias: [--action-message-bg](#action-message-bg), resolved on the document root for inherited modal/preview content and redeclared by chat theme overrides |
| <a id="message-service-text"></a>`--message-service-text` | Text/icons on service surfaces | `#ffffff` | No; generated palette value |
| <a id="message-media-background"></a>`--message-media-background` | Metadata/background overlay on photos and videos | `#000000b3` | No; generated palette value |
| <a id="message-media-text"></a>`--message-media-text` | Text/icons on media overlays | `#ffffff` | No; generated palette value |
| <a id="message-color-transition-duration"></a>`--message-color-transition-duration` | Color transition duration of message surfaces | Unset; consumer fallback applies | No alias; theme application temporarily sets `0ms` for paired-color updates, then removes it |

Outside `.Message`, the document root assigns [--message-code-dark](#message-code-dark) from the incoming value, so composer and Instant View code blocks follow the app surface. Code text uses [--color-text](#color-text). Light code surfaces use the quote tint, so a code block in forwarded or quoted content matches the sender's peer-color bar. Service/date colors depend on the wallpaper and can be translucent. These tables describe the current color rules; they do not assert a numeric contrast bound.

### Compatibility colors

These older shared variables remain available globally. Their global defaults are below. Inside a message, the scope mappings in the next table take precedence where a mapping exists.

| Variable | Purpose | Global light | Global dark | Default reference / inheritance |
| --- | --- | --- | --- | --- |
| <a id="color-background-own"></a>`--color-background-own` | Outgoing solid fallback fill | `#E1FFC7` | `#766AC8` | No CSS alias; outgoing palette fill ([--message-outgoing-background](#message-outgoing-background)) |
| <a id="color-background-own-selected"></a>`--color-background-own-selected` | Outgoing selected fill | `#cbe6b3` | `#6a5fb4` | No CSS alias; outgoing selected fill ([--message-outgoing-selected](#message-outgoing-selected)) |
| <a id="color-text-own"></a>`--color-text-own` | Text own | `#000000` | `#ffffff` | No CSS alias after initialization; outgoing text ([--message-outgoing-text](#message-outgoing-text)) |
| <a id="color-text-own-rgb"></a>`--color-text-own-rgb` | Text own rgb | `0, 0, 0` | `255, 255, 255` | No CSS alias after initialization; outgoing text channels ([--message-outgoing-text-rgb](#message-outgoing-text-rgb)) |
| <a id="color-text-secondary-own"></a>`--color-text-secondary-own` | Text secondary own | `#3f8c00cc` | `#ffffffa6` | No CSS alias after initialization; outgoing secondary text ([--message-outgoing-secondary](#message-outgoing-secondary)) |
| <a id="color-text-secondary-own-rgb"></a>`--color-text-secondary-own-rgb` | Text secondary own rgb | `63, 140, 0` | `255, 255, 255` | No CSS alias after initialization; outgoing secondary channels ([--message-outgoing-secondary-rgb](#message-outgoing-secondary-rgb)) |
| <a id="color-poll-check-own"></a>`--color-poll-check-own` | Outgoing poll check foreground | `#ffffff` | `#000000` | No CSS alias after initialization; outgoing accent foreground ([--message-outgoing-accent-foreground](#message-outgoing-accent-foreground)) |
| <a id="color-webpage-initial-background"></a>`--color-webpage-initial-background` | Unloaded web-page image placeholder | `#2e3939` | `#2e3939` | No; literal or Sass-computed value |
| <a id="color-composer-button"></a>`--color-composer-button` | Unfilled composer icons | `#000000` | `#FFFFFF` | No; literal or Sass-computed value |
| <a id="color-voice-transcribe-button"></a>`--color-voice-transcribe-button` | Voice transcribe button | `#e8f3ff` | `#2a2a3c` | No; literal or Sass-computed value |
| <a id="color-voice-transcribe-button-own"></a>`--color-voice-transcribe-button-own` | Voice transcribe button own | `#cceebf` | `#8373d3` | No; literal or Sass-computed value |
| <a id="color-own-links"></a>`--color-own-links` | Outgoing links | `#3390EC` | `#ffffff` | No CSS alias; copies outgoing links ([--message-outgoing-links](#message-outgoing-links)) |
| <a id="color-code"></a>`--color-code` | Legacy inline-code text | `#4a729a` | `#8774E1` | No; literal or Sass-computed value |
| <a id="color-code-bg"></a>`--color-code-bg` | Inline-code background | `#70757914` | `#00000080` | No; literal or Sass-computed value |
| <a id="color-code-own"></a>`--color-code-own` | Legacy outgoing inline-code text | `#3f8c00` | `#ffffff` | No CSS alias; copies outgoing accent |
| <a id="color-code-own-bg"></a>`--color-code-own-bg` | Outgoing inline-code background | `#70757914` | `#00000050` | No; literal or Sass-computed value; replaces [--color-code-bg](#color-code-bg) on inline code in `.Message.own` |
| <a id="color-accent-own"></a>`--color-accent-own` | Outgoing accent | `#3f8c00` | `#ffffff` | No CSS alias; outgoing palette accent ([--message-outgoing-accent](#message-outgoing-accent)) |
| <a id="color-accent-own-rgb"></a>`--color-accent-own-rgb` | Accent own rgb | `63, 140, 0` | `255, 255, 255` | No CSS alias; outgoing accent channels ([--message-outgoing-accent-rgb](#message-outgoing-accent-rgb)) |
| <a id="color-message-meta-own"></a>`--color-message-meta-own` | Outgoing metadata | `#3f8c00cc` | `#ffffffa6` | No CSS alias; outgoing secondary value ([--message-outgoing-meta](#message-outgoing-meta)) |
| <a id="color-message-reaction"></a>`--color-message-reaction` | Message reaction | `#ebf3fd` | `#2b2a35` | No; literal or Sass-computed value |
| <a id="color-message-reaction-hover"></a>`--color-message-reaction-hover` | Message reaction hover | `#c5def9` | `#343147` | No; literal or Sass-computed value |
| <a id="color-message-reaction-own"></a>`--color-message-reaction-own` | Message reaction own | `#c6eab2` | `#675CAF` | No; literal or Sass-computed value |
| <a id="color-message-reaction-hover-own"></a>`--color-message-reaction-hover-own` | Message reaction hover own | `#b5e0a4` | `#5B529B` | No; literal or Sass-computed value |
| <a id="color-message-reaction-chosen-hover"></a>`--color-message-reaction-chosen-hover` | Message reaction chosen hover | `#1a82ea` | `#7864dd` | No; literal or Sass-computed value |
| <a id="color-message-reaction-chosen-hover-own"></a>`--color-message-reaction-chosen-hover-own` | Message reaction chosen hover own | `#3f8c00` | `#ffffff` | No CSS alias; outgoing accent ([--message-outgoing-accent](#message-outgoing-accent)) |
| <a id="color-message-non-contact"></a>`--color-message-non-contact` | Message non contact | `#cceebf` | `#AAAAAA` | No; literal or Sass-computed value |
| <a id="color-message-story-mention-from"></a>`--color-message-story-mention-from` | Message story mention from | `#4ef390` | `#4ef390` | No; literal or Sass-computed value |
| <a id="color-message-story-mention-to"></a>`--color-message-story-mention-to` | Message story mention to | `#74bcff` | `#74bcff` | No; literal or Sass-computed value |
| <a id="color-reply-hover"></a>`--color-reply-hover` | Reply hover | `#F4F4F4` | `#272727` | No; literal or Sass-computed value |
| <a id="color-reply-active"></a>`--color-reply-active` | Reply active | `#E8E9E9` | `#2E2F2F` | No; literal or Sass-computed value |
| <a id="color-reply-own-hover"></a>`--color-reply-own-hover` | Reply own hover | `#CFF5B8` | `#8775DA` | No; literal or Sass-computed value |
| <a id="color-reply-own-active"></a>`--color-reply-own-active` | Reply own active | `#BEECAA` | `#917DEA` | No; literal or Sass-computed value |
| <a id="color-scrollbar-code"></a>`--color-scrollbar-code` | Code scrollbar | `rgba(200, 200, 200, 0.3)` | `rgba(200, 200, 200, 0.3)` | No; literal or Sass-computed value |

### Message-local mappings

These are the actual CSS aliases declared on `.Message` in addition to the direction aliases above. An existing global variable keeps its global table anchor; a `message-alias-*` anchor identifies its local remapping here. Leaf components can override these aliases for media/service surfaces.

| Variable in .Message | Default value | Default reference / inheritance |
| --- | --- | --- |
| <a id="message-alias-color-background"></a>`--color-background` | `var(--message-background)` | CSS alias / dependency: [--message-background](#message-background) |
| <a id="message-alias-color-background-selected"></a>`--color-background-selected` | `var(--message-selected)` | CSS alias / dependency: [--message-selected](#message-selected) |
| <a id="message-alias-color-background-own-selected"></a>`--color-background-own-selected` | `var(--message-selected)` | CSS alias / dependency: [--message-selected](#message-selected) |
| <a id="message-alias-color-text"></a>`--color-text` | `var(--message-text)` | CSS alias / dependency: [--message-text](#message-text) |
| <a id="message-alias-color-text-rgb"></a>`--color-text-rgb` | `var(--message-text-rgb)` | CSS alias / dependency: [--message-text-rgb](#message-text-rgb) |
| <a id="message-alias-color-text-secondary"></a>`--color-text-secondary` | `var(--message-secondary)` | CSS alias / dependency: [--message-secondary](#message-secondary) |
| <a id="message-alias-color-text-secondary-rgb"></a>`--color-text-secondary-rgb` | `var(--message-secondary-rgb)` | CSS alias / dependency: [--message-secondary-rgb](#message-secondary-rgb) |
| <a id="message-alias-color-text-meta"></a>`--color-text-meta` | `var(--message-meta)` | CSS alias / dependency: [--message-meta](#message-meta) |
| <a id="message-alias-color-text-meta-rgb"></a>`--color-text-meta-rgb` | `var(--message-meta-rgb)` | CSS alias / dependency: [--message-meta-rgb](#message-meta-rgb) |
| <a id="message-alias-color-message-meta-own"></a>`--color-message-meta-own` | `var(--message-meta)` | CSS alias / dependency: [--message-meta](#message-meta) |
| <a id="message-alias-color-links"></a>`--color-links` | `var(--message-links)` | CSS alias / dependency: [--message-links](#message-links) |
| <a id="message-alias-color-primary"></a>`--color-primary` | `var(--message-control)` | CSS alias / dependency: [--message-control](#message-control) |
| <a id="message-alias-color-primary-shade"></a>`--color-primary-shade` | `color-mix(in srgb, var(--message-control) 90%, black)` | CSS alias / dependency: [--message-control](#message-control) |
| <a id="message-alias-color-primary-shade-darker"></a>`--color-primary-shade-darker` | `color-mix(in srgb, var(--message-control) 85%, black)` | CSS alias / dependency: [--message-control](#message-control) |
| <a id="message-alias-color-active"></a>`--color-active` | `var(--message-control)` | CSS alias / dependency: [--message-control](#message-control) |
| <a id="message-alias-color-active-darker"></a>`--color-active-darker` | `var(--message-control)` | CSS alias / dependency: [--message-control](#message-control) |
| <a id="message-alias-color-primary-foreground"></a>`--color-primary-foreground` | `var(--message-control-foreground)` | CSS alias / dependency: [--message-control-foreground](#message-control-foreground) |
| <a id="message-alias-color-accent-own"></a>`--color-accent-own` | `var(--message-accent)` | CSS alias / dependency: [--message-accent](#message-accent) |
| <a id="message-alias-color-accent-own-rgb"></a>`--color-accent-own-rgb` | `var(--message-accent-rgb)` | CSS alias / dependency: [--message-accent-rgb](#message-accent-rgb) |
| <a id="message-alias-color-text-green"></a>`--color-text-green` | `var(--message-accent)` | CSS alias / dependency: [--message-accent](#message-accent) |
| <a id="message-alias-color-text-green-rgb"></a>`--color-text-green-rgb` | `var(--message-accent-rgb)` | CSS alias / dependency: [--message-accent-rgb](#message-accent-rgb) |
| <a id="message-alias-color-error"></a>`--color-error` | `var(--message-error)` | CSS alias / dependency: [--message-error](#message-error) |
| <a id="message-alias-color-error-background"></a>`--color-error-background` | `var(--message-error-background)` | CSS alias / dependency: [--message-error-background](#message-error-background) |
| <a id="message-alias-color-error-shade"></a>`--color-error-shade` | `var(--message-error-background)` | CSS alias / dependency: [--message-error-background](#message-error-background) |
| <a id="message-alias-color-error-foreground"></a>`--color-error-foreground` | `var(--message-error-foreground)` | CSS alias / dependency: [--message-error-foreground](#message-error-foreground) |
| <a id="message-alias-color-interactive-active"></a>`--color-interactive-active` | `var(--message-accent)` | CSS alias / dependency: [--message-accent](#message-accent) |
| <a id="message-alias-color-interactive-inactive"></a>`--color-interactive-inactive` | `var(--message-tint)` | CSS alias / dependency: [--message-tint](#message-tint) |
| <a id="message-alias-color-interactive-buffered"></a>`--color-interactive-buffered` | `var(--message-tint)` | CSS alias / dependency: [--message-tint](#message-tint) |
| <a id="message-alias-color-interactive-element-hover"></a>`--color-interactive-element-hover` | `var(--message-tint)` | CSS alias / dependency: [--message-tint](#message-tint) |
| <a id="background-color"></a>`--background-color` | `var(--message-background)` | CSS alias / dependency: [--message-background](#message-background) |
| <a id="hover-color"></a>`--hover-color` | `var(--message-tint)` | CSS alias / dependency: [--message-tint](#message-tint) |
| <a id="color-reaction"></a>`--color-reaction` | `color-mix(in srgb, var(--message-accent) 10%, transparent)` | CSS alias / dependency: [--message-accent](#message-accent); dark theme: `rgb(255, 255, 255, 0.1)` |
| <a id="color-reaction-hover"></a>`--color-reaction-hover` | `color-mix(in srgb, var(--message-accent) 30%, transparent)` | CSS alias / dependency: [--message-accent](#message-accent); dark theme: `rgb(255, 255, 255, 0.2)` |
| <a id="text-color-reaction"></a>`--text-color-reaction` | `var(--accent-color)` | CSS alias / dependency: [--accent-color](#message-alias-accent-color); dark theme: `var(--message-text)` |
| <a id="color-reaction-chosen"></a>`--color-reaction-chosen` | `var(--accent-color)` | CSS alias / dependency: [--accent-color](#message-alias-accent-color); dark `.own`: `color-mix(in srgb, var(--message-accent) 75%, transparent)` |
| <a id="text-color-reaction-chosen"></a>`--text-color-reaction-chosen` | `var(--message-accent-foreground)` | CSS alias / dependency: [--message-accent-foreground](#message-accent-foreground); light `.own`: `var(--message-background)`; dark `.own`: `color-mix(in srgb, var(--message-accent-foreground) 75%, var(--message-accent))` |
| <a id="color-reaction-chosen-hover"></a>`--color-reaction-chosen-hover` | `color-mix(in srgb, var(--message-accent) 90%, black)` | CSS alias / dependency: [--message-accent](#message-accent); dark theme: `90%, white`; dark `.own`: `color-mix(in srgb, var(--message-accent) 85%, transparent)` |
| <a id="active-color"></a>`--active-color` | `var(--message-tint-hover)` | CSS alias / dependency: [--message-tint-hover](#message-tint-hover) |
| <a id="message-alias-accent-color"></a>`--accent-color` | `var(--message-accent)` | CSS alias / dependency: [--message-accent](#message-accent) |
| <a id="accent-shade-color"></a>`--accent-shade-color` | `var(--message-accent)` | CSS alias / dependency: [--message-accent](#message-accent) |
| <a id="message-alias-accent-background-color"></a>`--accent-background-color` | `var(--message-tint)` | CSS alias / dependency: [--message-tint](#message-tint) |
| <a id="message-alias-accent-background-active-color"></a>`--accent-background-active-color` | `var(--message-tint-hover)` | CSS alias / dependency: [--message-tint-hover](#message-tint-hover) |
| <a id="secondary-color"></a>`--secondary-color` | `var(--message-secondary)` | CSS alias / dependency: [--message-secondary](#message-secondary) |
| <a id="color-voice-transcribe"></a>`--color-voice-transcribe` | `var(--message-tint)` | CSS alias / dependency: [--message-tint](#message-tint) |
| <a id="thumbs-background"></a>`--thumbs-background` | `var(--message-background)` | CSS alias / dependency: [--message-background](#message-background) |

Outgoing bubbles override [--color-text-selection](#color-text-selection) with [--message-outgoing-text-selection](#message-outgoing-text-selection) and [--color-selection-highlight-emoji](#color-selection-highlight-emoji) with [--message-outgoing-text-selection-emoji](#message-outgoing-text-selection-emoji); incoming bubbles keep the accent-based global values. Selected bubbles override [--background-color](#background-color) with [--message-selected](#message-selected); story-mention service content uses [--message-service-background](#message-service-background). Peer-color wrappers can supply author accents. Outgoing content with `noUserColors` uses the outgoing message accents. Outgoing document file tiles override [--color-primary](#message-alias-color-primary) with [--message-incoming-control](#message-incoming-control) and [--color-primary-foreground](#message-alias-color-primary-foreground) with [--message-incoming-control-foreground](#message-incoming-control-foreground), so they match incoming tiles. Reactions outside bubbles use [--message-service-background](#message-service-background) and [--message-service-text](#message-service-text), with fixed colors when chosen; paid reactions use fixed colors in their component styles.

### Print overrides

[Print styles](src/styles/print.scss) replace the theme and chat palettes with a light, fill-free palette. Theme and chat palettes are inline, so every override below is `!important` and wins in any theme.

| Scope | Variables | Print value |
| --- | --- | --- |
| Document root, `#MiddleColumn`, `.MessageList` | [--color-background](#color-background) / [--color-text](#color-text) | `#fff` / `#000` |
| Same | [--color-text-secondary](#color-text-secondary), [--color-text-meta](#color-text-meta) | `#555` |
| Same | [--color-links](#color-links) | `#000` |
| Same | [--action-message-bg](#action-message-bg), [--message-service-background](#message-service-background) | `transparent` |
| Same | [--message-service-text](#message-service-text) | `#000` |
| `.MessageList` | `--message-{direction}-background`, `-control`, `-tint`, `-tint-hover`, `-table-background` | `transparent` |
| Same | `--message-{direction}-text`, `-accent`, `-links`, `-control-foreground`, `-file-title` and their `-rgb` channels | `#000` |
| Same | `--message-{direction}-secondary`, `-meta`, `-file-description` and their `-rgb` channels | `#555` |
| Same | `--message-{direction}-links-decoration` / `-table-border` / `-code-dark` | `underline` / `#999` / `0` |
| Peer-color wrappers in `.MessageList` | [--accent-background-color](#accent-background-color) | `transparent` |
| `.Message` | [--color-reaction-chosen](#color-reaction-chosen) / [--text-color-reaction-chosen](#text-color-reaction-chosen) | `transparent` / `#000` |
| Custom-shape content (stickers, round videos) | [--message-media-text](#message-media-text) | `#555`, since badges sit on the cleared service surface |

The cleared [--message-incoming-control](#message-incoming-control) also clears its [--color-primary](#message-alias-color-primary) alias, so diff insertions, incoming voice durations and embed sources get explicit print colors. Exceptions keep their screen colors: the unique gift card keeps its backdrop and sets [--message-service-text](#message-service-text) back to `#fff`, and media metadata and duration overlays keep [--message-media-background](#message-media-background) and [--message-media-text](#message-media-text) with exact color printing.

### Wallpaper inputs

[Wallpaper rendering](src/hooks/useChatBackground.ts) defines these on the wrapper shared by the backdrop and chat content; the image URL is on the background layer. Missing values use the renderer's defaults rather than a global root declaration.

| Variable | Default / value | Default reference / inheritance |
| --- | --- | --- |
| <a id="pattern-color"></a>`--pattern-color` | `Runtime wallpaper tint` | No CSS alias; built-in light #4A8E3A8C, dark #48576166 |
| <a id="theme-background-color"></a>`--theme-background-color` | `Wallpaper model base color` | No; runtime value |
| <a id="pattern-mask"></a>`--pattern-mask` | `url(resolvedPattern)` | No; preview-local URL with no global default; supplies the original overlay image or the dark multicolor alpha mask |
| <a id="pattern-intensity"></a>`--pattern-intensity` | `Runtime pattern opacity` | No; inherited scalar, consumer fallback 0.5; multicolor patterns use absolute server intensity times the user factor / 10000. The user factor defaults to 100 and preserves explicit saved values. Single-color overlays use the user factor / 100 in light mode and 1 in dark mode |
| <a id="pattern-dimming"></a>`--pattern-dimming` | `Unset outside dark single-color patterns` | No; inherited runtime opacity for a black layer over the whole wallpaper, computed as 1 minus absolute server intensity times the user factor / 10000; previews use the same calculation |
| <a id="custom-background"></a>`--custom-background` | `url(resolvedImage)` | No; runtime image URL on the backdrop layer |

Browser wallpaper colors are assigned on the document root by [theme application](src/util/switchTheme.ts) while a wallpaper controls browser colors. Both values are removed when that wallpaper unmounts or a surface controls browser colors.

| Variable | Default / value | Default reference / inheritance |
| --- | --- | --- |
| <a id="browser-top-color"></a>`--browser-top-color` | `Unset in light and dark mode` | No CSS alias; inherited computed upper wallpaper edge color, also copied to the browser theme-color metadata; dark single-color patterns include [--pattern-dimming](#pattern-dimming), dark multicolor patterns use the black base |
| <a id="browser-bottom-color"></a>`--browser-bottom-color` | `Unset in light and dark mode` | No CSS alias; inherited computed lower wallpaper edge color, with the same pattern dimming and black-base rules as [--browser-top-color](#browser-top-color) |

## Updating this reference

Update the tables when changing global theme colors, the theme base map, the runtime palette, message aliases or wallpaper inputs. Check stylesheet fallbacks and initialized values separately; a matching color is not sufficient evidence of a CSS alias.

