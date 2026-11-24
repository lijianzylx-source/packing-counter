/* ============================================================
 * 头像模块（前端部分）
 *   选图 → 校验 → 居中裁剪缩放 → DataURL → 供界面渲染
 * 后端接口尚未就绪时，头像先落在本机（psc.avatar.v1）；
 * 后端补齐后只需把 uploadAvatar 接上，无需改动界面。
 * ============================================================ */
(function (root) {
  'use strict';

  var MAX_FILE_SIZE = 8 * 1024 * 1024;   // 原始文件上限 8MB
  var OUTPUT_SIZE = 256;                  // 统一输出 256×256
  var JPEG_QUALITY = 0.85;                // 压缩质量（体积与清晰度平衡）

  /** 读取文件为 dataURL */
  function readAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsDataURL(file);
    });
  }

  /** 加载图片 */
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('图片解析失败，请换一张')); };
      img.src = src;
    });
  }

  /**
   * 处理用户选择的图片
   * @returns {Promise<{dataUrl:string, width:number, height:number}>}
   */
  function process(file) {
    if (!file) return Promise.reject(new Error('未选择文件'));
    if (!/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('请选择图片文件（JPG / PNG / WebP 等）'));
    }
    if (file.size > MAX_FILE_SIZE) {
      return Promise.reject(new Error('图片过大（' + Math.round(file.size / 1024 / 1024) + 'MB），请选择 8MB 以内的图片'));
    }

    return readAsDataURL(file)
      .then(loadImage)
      .then(function (img) {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) throw new Error('图片尺寸无效');

        // 居中裁剪为正方形后缩放到 OUTPUT_SIZE
        var side = Math.min(w, h);
        var sx = (w - side) / 2;
        var sy = (h - side) / 2;

        var canvas = document.createElement('canvas');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

        // PNG 透明图转 JPEG 会出现黑底，这里统一输出 PNG（保留透明）
        var hasAlpha = /png|webp|gif/i.test(file.type || '');
        var dataUrl = hasAlpha
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', JPEG_QUALITY);

        return { dataUrl: dataUrl, width: w, height: h };
      });
  }

  /**
   * 渲染头像到容器
   * @param {HTMLElement} el 头像元素
   * @param {string} dataUrl  头像图片（空则显示首字母）
   * @param {string} fallback 首字母兜底
   */
  function render(el, dataUrl, fallback) {
    if (!el) return;
    if (dataUrl) {
      el.style.backgroundImage = 'url("' + dataUrl + '")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.textContent = '';
      el.classList.add('has-image');
    } else {
      el.style.backgroundImage = '';
      el.style.backgroundSize = '';
      el.textContent = fallback || '';
      el.classList.remove('has-image');
    }
  }

  /** 取首字母作为默认头像文字 */
  function initialOf(username) {
    return username ? username.slice(0, 1).toUpperCase() : '—';
  }

  root.Avatar = {
    process: process,
    render: render,
    initialOf: initialOf,
    MAX_FILE_SIZE: MAX_FILE_SIZE,
    OUTPUT_SIZE: OUTPUT_SIZE
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
