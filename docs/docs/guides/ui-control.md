---
sidebar_position: 3
title: The offline control
---

# The offline control

`OfflineManagerControl` adds a button to the map that opens a panel for downloading and managing regions. It works as a control on both MapLibre and Mapbox GL. [Getting started](../getting-started.md) shows how to add it.

## Options

| Option | Type | Description |
|---|---|---|
| `styleUrl` | `string` | Required. The style to download. |
| `mapLib` | `MapLibProtocol` | Pass `maplibregl` on MapLibre. Leave it out on Mapbox GL, which uses the Service Worker instead. |
| `accessToken` | `string \| null` | Your Mapbox token, filled in on the download form. |
| `theme` | `'light' \| 'dark'` | The panel's starting theme. |
| `showBbox` | `boolean` | Show the bounds of stored regions on the map. |

## Keep it in step with your style switcher

If your app changes style, tell the control so that new downloads use the right one:

```ts
map.setStyle(newStyleUrl);
control.updateStyleUrl(newStyleUrl);
```

## Load a stored style from your own UI

```ts
await control.loadOfflineStyle('my-style-id');
```

`offlineManager.listStyles()` gives you the stored styles and their ids. `control.loadOfflineStyles()` shows the stored style, and asks which one if there are several.

## Language

The UI comes in English and Arabic, with right-to-left layout for Arabic. The choice is remembered in `localStorage`.

```ts
import { i18n } from 'map-gl-offline';

i18n.setLanguage('ar');
i18n.getLanguage(); // 'ar'
i18n.isRTL(); // true

const unsubscribe = i18n.subscribe(() => {
  console.log('Language changed to', i18n.getLanguage());
});
```

People can also switch language from the panel's header.

## Change the look

`style.css` defines its colours, corners and font as CSS variables. Override them after importing it:

```css
:root {
  /* The accent colour, for buttons and progress */
  --color-blue-600: #0b6e4f;
  --color-blue-700: #08543c;

  /* Neutrals, from panel backgrounds to text */
  --color-gray-50: #f7f7f5;
  --color-gray-900: #1c1c1a;

  /* Corners */
  --radius-lg: 8px;

  --font-sans: 'Inter', system-ui, sans-serif;
}
```

The default font is Barlow, used only if your page has it. This library is built for offline use, so it never downloads a font itself, and it falls back to system fonts. To use Barlow, add `@fontsource/barlow` to your app.

Colours for region outlines on the map are drawn by the map rather than CSS, so these variables don't affect them.
