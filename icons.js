/* ============================================================
   Action Leap · 原创图标系统 (Original Icon System)
   风格：线性 · 圆角端点 · 1.8px 描边 · currentColor 着色
   原则：零 emoji、零图形黑话；靛蓝品牌色统一；可随主题变深
   用法：
     <script src="icons.js"></script>
     然后 AL.icon('today') 返回 <svg><use.../></svg> 字符串，
     直接拼进 HTML 模板；静态位置也可写 <svg class="ic-svg"><use href="#al-ic-today"/></svg>
   ============================================================ */
(function () {
  'use strict';

  // 每个 symbol 的 viewBox 统一 0 0 24 24；描边 1.8，圆角端点
  var P = {
    today:    '<circle cx="12" cy="13" r="4.4"/><path d="M12 4v2.2"/><path d="M4.6 13H3"/><path d="M21 13h-1.6"/><path d="M5.8 8.8 4.4 7.4"/><path d="M18.2 8.8l1.4-1.4"/><path d="M3 19.5h18"/>',
    framework:'<circle cx="12" cy="12" r="9"/><path d="M15.2 8.8l-1.9 4.7-4.7 1.9 1.9-4.7z"/>',
    progress: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6.5" y="12" width="3" height="6" rx="1.3"/><rect x="11" y="8" width="3" height="10" rx="1.3"/><rect x="15.5" y="4.5" width="3" height="13.5" rx="1.3"/>',
    leaf:     '<path d="M5 19c0-7.6 5.2-13 14-14"/><path d="M19 5c0 5-3 9-9 10"/><path d="M5 19c2-4 5-6 9-7"/>',
    step:     '<circle cx="6" cy="18" r="1.7"/><circle cx="11" cy="13" r="1.9"/><circle cx="16.5" cy="8" r="2.1"/><path d="M7.5 16.8l3-4 3.4-4"/>',
    flame:    '<path d="M12 3c1.1 3-1.4 4-1.4 6.4 0 1 .7 1.8 1.4 1.8.9 0 1.5-.8 1.5-2 1.5 1 2.5 2.8 2.5 4.6A5 5 0 0 1 7 14c0-2.2 1.5-3.6 2.5-5C10 7 11.4 5 12 3z"/>',
    pause:    '<rect x="8" y="5" width="3" height="14" rx="1.6"/><rect x="13" y="5" width="3" height="14" rx="1.6"/>',
    spark:    '<path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7z"/>',
    send:     '<path d="M21 3L3.5 11l7.2 2.8"/><path d="M3.5 11l2.8 6.2L12.7 14"/><path d="M21 3L3.5 11l7.2 2.8"/>',
    plus:     '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    check:    '<path d="M5 12.5l5 5 9-11"/>',
    close:    '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
    copy:     '<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15"/>',
    export:   '<path d="M12 3v12"/><path d="M7.5 11l4.5 5 4.5-5"/><path d="M5 20.5h14"/>',
    ai:       '<path d="M12 4l1.2 3.4L17 8l-3.8 1.6L12 13l-1.2-3.4L7 8l3.8-1.6z"/><circle cx="18" cy="17" r="1.3"/><circle cx="6" cy="17" r="1.1"/>',
    sprout:   '<path d="M12 20.5v-7"/><path d="M12 13.5c0-3-2-5-5-5 0 3 2 5 5 5z"/><path d="M12 13.5c0-2.6 2-4.6 5-4.6 0 2.6-2 4.6-5 4.6z"/>',
    path:     '<path d="M5 19c3-1 4-4 7-4s3 3 7 2"/><path d="M17.5 8v8"/><path d="M17.5 8h4v4"/>',
    folder:   '<path d="M3 7.5A2 2 0 0 1 5 5.5h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    compass:  '<circle cx="12" cy="12" r="9"/><path d="M15.2 8.8l-1.9 4.7-4.7 1.9 1.9-4.7z"/>',
    star:     '<path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.8L12 16.9 6.9 19.3l1.1-5.8-4.3-4 5.8-.7z"/>',
    target:   '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>'
  };

  // 注入隐藏 sprite 到 <body> 顶部
  function mount() {
    if (document.getElementById('al-icon-sprite')) return;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('id', 'al-icon-sprite');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    var defs = '';
    for (var k in P) {
      defs += '<symbol id="al-ic-' + k + '" viewBox="0 0 24 24">' + P[k] + '</symbol>';
    }
    svg.innerHTML = defs;
    if (document.body) document.body.insertBefore(svg, document.body.firstChild);
    else document.addEventListener('DOMContentLoaded', function () {
      document.body.insertBefore(svg, document.body.firstChild);
    });
  }

  // 返回 <svg> 字符串；opts: {size:24, cls:'', sw:1.8}
  function icon(name, opts) {
    opts = opts || {};
    var size = opts.size || 24;
    var cls = opts.cls ? ' ' + opts.cls : '';
    var sw = opts.sw || 1.8;
    return '<svg class="ic-svg' + cls + '" viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="' + sw +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#al-ic-' + name + '"/></svg>';
  }

  window.AL = window.AL || {};
  AL.icon = icon;
  AL.iconsReady = mount;
  mount();
})();
