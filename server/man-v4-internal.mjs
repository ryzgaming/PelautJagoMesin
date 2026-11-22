import {manV4Styles} from './man-v4-styles.mjs';
import {manV4Runtime} from './man-v4-runtime.mjs';

export const MAN_V4_REVIEW_ORIGIN = 'https://chatgpt-man-workspace-v4-ui.pelautjagomesin.pages.dev';
export const MAN_V4_PRODUCTION_ORIGIN = 'https://pelautjagomesin.pages.dev';

/**
 * Add the redesign INSIDE the authenticated MAN simulator HTML.
 * The original premium simulator remains private in Supabase Storage.
 * This module contains only UI CSS and JS, no private 3D geometry.
 */
export function injectManV4(html) {
  if(typeof html!=='string')throw new TypeError('MAN HTML must be a string');
  if(!/<\/head\s*>/i.test(html)||!/<\/body\s*>/i.test(html))throw new Error('MAN_HTML_INVALID');
  if(html.includes('id="man-v4-native-css"'))return html;
  // Avoid accidental HTML script termination if a future UI string changes.
  const css=manV4Styles.replace(/<\/style/gi,'<\\/style');
  const js=manV4Runtime.replace(/<\/script/gi,'<\\/script');
  const head=html.search(/<\/head\s*>/i);
  let out=html.slice(0,head)+'<style id="man-v4-native-css">'+css+'</style>'+html.slice(head);
  const end=out.toLowerCase().lastIndexOf('</body>');
  return out.slice(0,end)+'<script id="man-v4-native-js">'+js+'</script>'+out.slice(end);
}
