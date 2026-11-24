/* ============================================================
 * 轻量 SVG 柱状图（无第三方库）
 * 规则来自 dataviz 规范：
 *   单序列 → 不放图例；柱宽 ≤24px、顶端 4px 圆角、底部方角；
 *   网格线 1px 实线；只标注极值与末点；未记录日期不画柱；
 *   悬停提示 + 表格视图作为颜色之外的等价读数通道。
 * ============================================================ */
(function (root) {
  'use strict';

  function niceMax(value) {
    if (!isFinite(value) || value <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(value)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] * mag >= value) return steps[i] * mag;
    }
    return 10 * mag;
  }

  function barPath(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h));
    return 'M' + x + ',' + (y + h) +
      ' L' + x + ',' + (y + r) +
      ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      ' L' + (x + w - r) + ',' + y +
      ' Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
      ' L' + (x + w) + ',' + (y + h) + ' Z';
  }

  function compact(value) {
    if (value >= 10000) return (value / 10000).toFixed(1) + '万';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
    return String(Math.round(value));
  }

  /**
   * @param {HTMLElement} container
   * @param {Object} options
   *   data: [{date, value|null, note}]  value 为 null 表示未记录（不画柱）
   *   height: 画布高度
   *   unitLabel: 左上角单位说明
   *   format: 值格式化（tooltip / 标注用）
   */
  function bars(container, options) {
    var opts = options || {};
    var data = opts.data || [];
    var height = opts.height || 240;
    var width = Math.max(280, Math.round(container.getBoundingClientRect().width || 640));
    var format = opts.format || function (v) { return String(v); };

    var padL = 46, padR = 14, padT = 26, padB = 28;
    var plotW = Math.max(40, width - padL - padR);
    var plotH = Math.max(60, height - padT - padB);

    var values = data.map(function (d) { return d.value; }).filter(function (v) { return v !== null && v !== undefined; });
    var maxValue = values.length ? Math.max.apply(null, values) : 0;
    var axisMax = niceMax(maxValue || 1);

    // 宽屏限制绘图区宽度并居中，避免柱子被拉散
    var MAX_PLOT = 900;
    var x0 = padL;
    if (plotW > MAX_PLOT) {
      plotW = MAX_PLOT;
      x0 = padL + Math.round((width - padL - padR - plotW) / 2);
    }

    var band = plotW / Math.max(1, data.length);
    var barW = Math.max(2, Math.min(24, band - Math.max(2, band * 0.28)));

    var parts = [];
    parts.push('<svg viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '" role="img" aria-label="' + (opts.ariaLabel || '柱状图') + '">');

    // 单位说明
    parts.push('<text x="0" y="12" fill="var(--c-text-muted)" font-size="11" font-family="var(--font-body)">' + (opts.unitLabel || '') + '</text>');

    // 网格线与 Y 轴刻度（1px 实线，克制）
    [0, 0.5, 1].forEach(function (ratio) {
      var y = padT + plotH - ratio * plotH;
      parts.push('<line x1="' + x0 + '" y1="' + y.toFixed(1) + '" x2="' + (x0 + plotW) + '" y2="' + y.toFixed(1) +
        '" stroke="' + (ratio === 0 ? 'var(--c-border-strong)' : 'var(--c-border-subtle)') + '" stroke-width="1" shape-rendering="crispEdges"/>');
      parts.push('<text x="' + (x0 - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="var(--c-text-muted)" font-size="11" ' +
        'style="font-variant-numeric: tabular-nums" font-family="var(--font-mono)">' + compact(axisMax * ratio) + '</text>');
    });

    // 柱体
    var maxIndex = -1, maxBar = -1;
    data.forEach(function (d, i) {
      var v = d.value;
      if (v === null || v === undefined) return;
      if (v > maxBar) { maxBar = v; maxIndex = i; }
      if (v <= 0) return;
      var h = (v / axisMax) * plotH;
      var x = x0 + i * band + (band - barW) / 2;
      var y = padT + plotH - h;
      parts.push('<path d="' + barPath(x, y, barW, h, 4) + '" fill="var(--c-chart)"/>');
    });

    // X 轴标签（按密度抽样，避免重叠）
    var step = data.length <= 8 ? 1 : Math.ceil(data.length / 7);
    data.forEach(function (d, i) {
      if (i % step !== 0 && i !== data.length - 1) return;
      var x = x0 + i * band + band / 2;
      parts.push('<text x="' + x.toFixed(1) + '" y="' + (padT + plotH + 17) + '" text-anchor="middle" fill="var(--c-text-muted)" ' +
        'font-size="11" style="font-variant-numeric: tabular-nums" font-family="var(--font-mono)">' + (d.label || '') + '</text>');
    });

    // 直接标注：只标极值（最大值）
    if (maxIndex >= 0 && maxBar > 0) {
      var h = (maxBar / axisMax) * plotH;
      var lx = x0 + maxIndex * band + band / 2;
      var ly = Math.max(padT - 4, padT + plotH - h - 6);
      parts.push('<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" fill="var(--c-text-display)" ' +
        'font-size="11" font-weight="600" style="font-variant-numeric: tabular-nums" font-family="var(--font-mono)">' + format(maxBar) + '</text>');
    }

    // 交互热区（整条 band，命中面积远大于柱体）
    data.forEach(function (d, i) {
      parts.push('<rect x="' + (x0 + i * band).toFixed(1) + '" y="' + padT + '" width="' + band.toFixed(1) + '" height="' + plotH +
        '" fill="transparent" data-i="' + i + '" class="chart-hit"></rect>');
    });

    parts.push('</svg>');
    container.innerHTML = parts.join('');

    // 悬停提示
    var tip = document.createElement('div');
    tip.className = 'c-chart-tip';
    tip.hidden = true;
    container.appendChild(tip);

    var svg = container.querySelector('svg');
    var hits = svg.querySelectorAll('.chart-hit');
    Array.prototype.forEach.call(hits, function (rect) {
      var i = Number(rect.getAttribute('data-i'));
      var d = data[i];
      function show() {
        tip.innerHTML =
          '<div class="c-chart-tip__date">' + (d.fullLabel || d.label || d.date) + '</div>' +
          (d.value === null || d.value === undefined
            ? '<div class="c-chart-tip__row"><span>件数</span><span>未记录</span></div>'
            : '<div class="c-chart-tip__row"><span>数值</span><span>' + format(d.value) + '</span></div>') +
          (d.note ? '<div class="c-chart-tip__row"><span>备注</span><span>' + d.note + '</span></div>' : '');
        tip.hidden = false;
        var bandX = x0 + i * band;
        var left = Math.max(0, Math.min(bandX + band / 2 - tip.offsetWidth / 2, width - tip.offsetWidth));
        tip.style.left = left + 'px';
        tip.style.top = '2px';
      }
      function hide() { tip.hidden = true; }
      rect.addEventListener('mouseenter', show);
      rect.addEventListener('mouseleave', hide);
      rect.addEventListener('pointerdown', show);
    });

    return { maxValue: maxBar, maxIndex: maxIndex, axisMax: axisMax };
  }

  root.Chart = { bars: bars, niceMax: niceMax };
})(typeof globalThis !== 'undefined' ? globalThis : this);
