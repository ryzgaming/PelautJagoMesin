// These assets are also loaded by the public Shinko document.
export const studioFiles = [
  'three.min.js', 'OrbitControls.js', 'simulator-theme.css', 'studio.css', 'assembly-diagram.js', 'studio.js'
];

function inlineScript(source) {
  return '<script>' + source.replace(/<\/script/gi, '<\\/script') + '</script>';
}

export function preparePremiumWorkspace(html, id, assets) {
  // The archived MAN admin and assembly previews add their own controls and
  // event handlers. Remove those specific bundles before the document executes.
  html = html.replace(/<style id="(?:man-v4-native-css|om-assembly-css)">[\s\S]*?<\/style>/gi, '')
    .replace(/<script id="(?:man-v4-native-js|om-assembly-js)">[\s\S]*?<\/script>/gi, '');

  // Preserve engine boot order in the opaque iframe without relying on a CDN.
  html = html.replace(/<script src="(?:https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(?:build|examples\/js\/controls)|assets)\/(three\.min\.js|OrbitControls\.js)"><\/script>/g,
    (_, name) => inlineScript(assets[name]));

  // Bridge the archived PelautSim engine versions served from private storage.
  // Keep the selection reset inside the same closure as the native picking handler.
  if (html.includes('function select(p,focus,sub)') && !html.includes('clearSelection:function')) {
    html = html.replace('window.__pp={', 'window.__pp={clearSelection:function(){select(null,false,null);},');
  }
  if (html.includes('function placeMeshes(dt)') && !html.includes('setOverviewPose:')) {
    html = html.replace('window.__pp={', 'window.__pp={setOverviewPose:function(spread){exLvl=spread?1:2;ex.cur=ex.tgt=Number(spread);$("ex").value=ex.cur;placeMeshes(0);},');
  }
  // The archived generators store exterior paint separately from metal and seals.
  if (id === 'alfa-laval-mab206s') {
    html = html.replace('function mats(K){return {pt:K.M(0x6f8f7e,',
      'function mats(K,paint=0x245395){return {pt:K.M(paint,');
    html = html.replace(/(part\(\{key:"ccover"[^\n]+?var m=mats\(K)\)/, '$1,0xd7d9cc)');
  }
  if (id === 'man-l2330h') {
    html = html.replaceAll('0x5cb84c', '0x369568').replaceAll('0x4fa443', '0x33825d');
  }
  const styles = '<style>' + assets['simulator-theme.css'] + '\n' + assets['studio.css'] + '</style>';
  const scripts = inlineScript(assets['assembly-diagram.js']) + inlineScript(assets['studio.js']);
  const head = html.search(/<\/head\s*>/i);
  html = head < 0 ? styles + html : html.slice(0, head) + styles + html.slice(head);
  const body = html.toLowerCase().lastIndexOf('</body');
  return body < 0 ? html + scripts : html.slice(0, body) + scripts + html.slice(body);
}
