/* ============================================================
 * 全局配置：接口地址、存储键、默认值、页面路由表
 * ============================================================ */
window.APP_CONFIG = {
  /* 账号服务端基准地址（F-019 可在登录页改写并保存到本机）
     默认值用于 file:// 直接打开等无主机名场景；
     正常通过 http 访问时按「当前主机名 + apiPort」推导，手机也能连上。 */
  defaultApiBase: 'http://localhost:5173',
  apiPort: 5173,

  /* 本地存储命名空间 */
  storageKeys: {
    records: 'psc.records.v1',
    settings: 'psc.settings.v1',
    auth: 'psc.auth.v1',
    server: 'psc.server.v1',
    avatar: 'psc.avatar.v1'
  },

  /* 业务默认值 */
  defaults: {
    unitPrice: 1.5,
    reminderEnabled: false,
    reminderTime: '21:00',
    reminderText: '今天还没记录打包数量，别忘了哦～'
  },

  /* 记录约束 */
  maxCount: 999999,
  maxNoteLength: 100,

  /* 路由表：侧边栏导航由 ui.js 依据此表渲染（href 相对 pages/ 目录） */
  routes: [
    { id: 'workbench', href: 'workbench.html', label: '今日录入', icon: 'inventory_2', desc: '包装工作台' },
    { id: 'history',   href: 'history.html',   label: '历史明细', icon: 'history',       desc: '补录与修改' },
    { id: 'dashboard', href: 'dashboard.html', label: '统计看板', icon: 'analytics',     desc: '效能与对账' },
    { id: 'settings',  href: 'settings.html',  label: '系统设置', icon: 'settings',      desc: '单价 / 提醒 / 数据' }
  ]
};
