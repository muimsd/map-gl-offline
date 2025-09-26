/**
 * Tabler Icons utility for the offline map manager
 * Provides consistent icon usage throughout the application using inline SVG strings
 */

// Tabler Icons SVG strings for inline use
const TABLER_ICONS = {
  mapPin:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-map-pin" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="11" r="3" /><path d="m17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" /></svg>',
  trash:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-trash" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="4" y1="7" x2="20" y2="7" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>',
  eye: '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-eye" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="2" /><path d="m22 12c-2.667 4 -6 6 -10 6s-7.333 -2 -10 -6c2.667 -4 6 -6 10 -6s7.333 2 10 6" /></svg>',
  focus:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-focus" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="3" /><path d="M3 7v-1a3 3 0 0 1 3 -3h1" /><path d="M17 3h1a3 3 0 0 1 3 3v1" /><path d="M21 17v1a3 3 0 0 1 -3 3h-1" /><path d="M7 21h-1a3 3 0 0 1 -3 -3v-1" /></svg>',
  download:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-download" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><polyline points="7,11 12,16 17,11" /><line x1="12" y1="4" x2="12" y2="16" /></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-x" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>',
  check:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-check" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="m5 12l5 5l10 -10" /></svg>',
  alertTriangle:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-alert-triangle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="m12 9v2m0 4v.01" /><path d="m5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75" /></svg>',
  cleaning:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-wash" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3.486 8.965c.168 .02 .34 .033 .514 .035c.79 .009 1.539 -.178 2 -.5c.461 -.322 1.21 -.322 1.671 0c.461 .322 1.21 .322 1.671 0c.461 -.322 1.21 -.322 1.671 0c.461 .322 1.21 .322 1.671 0c.461 -.322 1.21 -.322 1.671 0c.461 .322 1.21 .322 1.671 0c.46 -.322 1.209 -.322 1.67 0c.462 .322 1.211 .322 1.672 0c.574 -.391 1.675 -.576 2.5 -.5" /><path d="M3.486 12.965c.168 .02 .34 .033 .514 .035c.79 .009 1.539 -.178 2 -.5c.461 -.322 1.21 -.322 1.671 0c.461 .322 1.21 .322 1.671 0c.461 -.322 1.21 -.322 1.671 0c.461 .322 1.21 .322 1.671 0c.461 -.322 1.21 -.322 1.671 0c.461 .322 1.21 .322 1.671 0c.46 -.322 1.209 -.322 1.67 0c.462 .322 1.211 .322 1.672 0c.574 -.391 1.675 -.576 2.5 -.5" /><path d="M3.486 16.965c.168 .02 .34 .033 .514 .035c.79 .009 1.539 -.178 2 -.5c.461 -.322 1.21 -.322 1.671 0c.461 .322 1.21 .322 1.671 0c.461 -.322 1.21 -.322 1.671 0c.461 .322 1.21 .322 1.671 0c.461 -.322 1.21 -.322 1.671 0c.461 .322 1.21 .322 1.671 0c.46 -.322 1.209 -.322 1.67 0c.462 .322 1.211 .322 1.672 0c.574 -.391 1.675 -.576 2.5 -.5" /></svg>',
  deviceFloppy:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-device-floppy" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><circle cx="12" cy="14" r="2" /><polyline points="14,4 14,8 8,8 8,4" /></svg>',
  clock:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-clock" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9" /><polyline points="12,7 12,12 15,15" /></svg>',
  cloud:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-cloud" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.881 -.573 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878z" /></svg>',
  fileText:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-file-text" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><line x1="9" y1="9" x2="10" y2="9" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg>',
  deviceMobile:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-device-mobile" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="7" y="4" width="10" height="16" rx="1" /><line x1="11" y1="5" x2="13" y2="5" /><line x1="12" y1="17" x2="12" y2="17.01" /></svg>',
  checkCircle:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-circle-check" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9" /><path d="m9 12l2 2l4 -4" /></svg>',
  settings:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-settings" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><circle cx="12" cy="12" r="3" /></svg>',
  map: '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-map" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><polyline points="3,7 9,4 15,7 21,4 21,17 15,20 9,17 3,20 3,7" /><line x1="9" y1="4" x2="9" y2="17" /><line x1="15" y1="7" x2="15" y2="20" /></svg>',
  refresh:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-refresh" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>',
  plus: '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-plus" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>',
  moon: '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-moon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" /></svg>',
  sun: '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-sun" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="4" /><path d="m3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>',
  upload:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-upload" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><polyline points="7,9 12,4 17,9" /><line x1="12" y1="4" x2="12" y2="16" /></svg>',
  infoCircle:
    '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-info-circle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12.01" y2="8" /><polyline points="11,12 12,12 12,16 13,16" /></svg>',
} as const;

/**
 * Configuration for icon rendering
 */
interface IconConfig {
  size?: number;
  color?: string;
  className?: string;
  style?: string;
}

/**
 * Default icon configuration
 */
const defaultConfig: IconConfig = {
  size: 16,
  color: 'currentColor',
};

/**
 * Renders a Tabler icon as an SVG string with custom configuration
 */
function renderIcon(iconSvg: string, config: IconConfig = {}): string {
  const finalConfig = { ...defaultConfig, ...config };

  // Create a temporary element to parse and modify the SVG
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = iconSvg;
  const svg = tempDiv.querySelector('svg');

  if (!svg) {
    console.warn('Failed to parse icon SVG');
    return iconSvg;
  }

  // Apply configuration
  if (finalConfig.size) {
    svg.setAttribute('width', finalConfig.size.toString());
    svg.setAttribute('height', finalConfig.size.toString());
  }

  if (finalConfig.color && finalConfig.color !== 'currentColor') {
    svg.setAttribute('stroke', finalConfig.color);
  }

  if (finalConfig.className) {
    const existingClass = svg.getAttribute('class') || '';
    svg.setAttribute('class', `${existingClass} ${finalConfig.className}`.trim());
  }

  if (finalConfig.style) {
    const existingStyle = svg.getAttribute('style') || '';
    svg.setAttribute('style', `${existingStyle}; ${finalConfig.style}`.trim());
  }

  // Ensure proper display
  const currentStyle = svg.getAttribute('style') || '';
  if (!currentStyle.includes('display:') && !currentStyle.includes('vertical-align:')) {
    svg.setAttribute(
      'style',
      `${currentStyle}; display: inline-block; vertical-align: middle;`.trim()
    );
  }

  return svg.outerHTML;
}

/**
 * Available icons in the application
 */
export const icons = {
  // Map and location icons
  mapPin: (config?: IconConfig) => renderIcon(TABLER_ICONS.mapPin, config),
  focus: (config?: IconConfig) => renderIcon(TABLER_ICONS.focus, config),

  // Action icons
  download: (config?: IconConfig) => renderIcon(TABLER_ICONS.download, config),
  trash: (config?: IconConfig) => renderIcon(TABLER_ICONS.trash, config),
  eye: (config?: IconConfig) => renderIcon(TABLER_ICONS.eye, config),
  refresh: (config?: IconConfig) => renderIcon(TABLER_ICONS.refresh, config),
  cleaning: (config?: IconConfig) => renderIcon(TABLER_ICONS.cleaning, config),
  plus: (config?: IconConfig) => renderIcon(TABLER_ICONS.plus, config),

  // UI icons
  x: (config?: IconConfig) => renderIcon(TABLER_ICONS.x, config),
  check: (config?: IconConfig) => renderIcon(TABLER_ICONS.check, config),
  checkCircle: (config?: IconConfig) => renderIcon(TABLER_ICONS.checkCircle, config),

  // Status icons
  alertTriangle: (config?: IconConfig) => renderIcon(TABLER_ICONS.alertTriangle, config),

  // Content icons
  fileText: (config?: IconConfig) => renderIcon(TABLER_ICONS.fileText, config),
  clock: (config?: IconConfig) => renderIcon(TABLER_ICONS.clock, config),
  cloud: (config?: IconConfig) => renderIcon(TABLER_ICONS.cloud, config),
  deviceMobile: (config?: IconConfig) => renderIcon(TABLER_ICONS.deviceMobile, config),
  deviceFloppy: (config?: IconConfig) => renderIcon(TABLER_ICONS.deviceFloppy, config),
  settings: (config?: IconConfig) => renderIcon(TABLER_ICONS.settings, config),
  map: (config?: IconConfig) => renderIcon(TABLER_ICONS.map, config),

  // Theme icons
  moon: (config?: IconConfig) => renderIcon(TABLER_ICONS.moon, config),
  sun: (config?: IconConfig) => renderIcon(TABLER_ICONS.sun, config),

  // Import/Export icons
  upload: (config?: IconConfig) => renderIcon(TABLER_ICONS.upload, config),
  infoCircle: (config?: IconConfig) => renderIcon(TABLER_ICONS.infoCircle, config),
};

/**
 * Utility type for icon names
 */
export type IconName = keyof typeof icons;

/**
 * Helper function to get an icon by name
 */
export function getIcon(name: IconName, config?: IconConfig): string {
  return icons[name](config);
}
