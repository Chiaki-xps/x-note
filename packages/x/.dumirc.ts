/**
 * Dumi 配置文件
 *
 * Dumi 是一个基于 Umi 的文档生成工具，专为 React 组件库开发设计。
 * 这个配置文件控制了整个文档站点的构建、路由、国际化、主题等各个方面。
 *
 * 配置项文档: https://d.umijs.org/config
 *
 * 主要功能：
 * - 文档和组件的自动扫描与路由生成
 * - 国际化支持（中英文）
 * - SSR（服务端渲染）
 * - Markdown 增强（支持 rehype/remark 插件）
 * - 性能优化（字体预加载、代码分割等）
 */

import os from 'node:os';
import { defineConfig } from 'dumi';
import path from 'path';

// 自定义 Markdown 处理插件
import rehypeAntd from './.dumi/rehypeAntd'; // HTML AST 处理插件
import remarkAntd from './.dumi/remarkAntd'; // Markdown AST 处理插件
import { version } from './package.json';

export default defineConfig({
  // ============================================================================
  // 插件配置
  // dumi-plugin-color-chunk: 按颜色主题分割代码块，优化构建产物
  plugins: ['dumi-plugin-color-chunk'],

  // ============================================================================
  // 路由配置
  /**
   * 路由预取配置
   * 启用 <Link prefetch /> 功能，提前加载链接页面资源，提升用户体验
   * 传入空对象 {} 表示使用默认配置。默认值值是false，所以要开启需要传参，传入空的表示使用默认的
   */
  routePrefetch: {},

  /**
   * PWA manifest 配置
   * 生成 manifest.json 文件，支持 PWA 应用
   */
  manifest: {},

  /**
   * 约定式路由配置
   * exclude: 排除不需要生成路由的目录
   * 这里排除 .dumi/pages/index/components/ 下的组件文件，避免生成不必要的路由
   */
  conventionRoutes: {
    // to avoid generate routes for .dumi/pages/index/components/xx
    exclude: [/index\/components\//],
  },

  // ============================================================================
  // 构建配置
  /**
   * SSR（服务端渲染）配置
   * - 生产环境启用 SSR，使用 Mako 构建器（更快的构建速度）
   * - 开发环境关闭 SSR，提升开发体验
   *
   * Mako 是阿里开发的 Rust 构建工具，比 Webpack 快 10 倍以上
   */
  ssr:
    process.env.NODE_ENV === 'production'
      ? {
          builder: 'mako',
        }
      : false,

  /**
   * 文件名 hash
   * 开启后构建产物会带上 hash，如 main.a1b2c3.js
   * 用于浏览器缓存策略，文件内容变化时 hash 会变化，强制浏览器更新
   */
  hash: true,

  /**
   * MFSU（Module Federation Speed Up）
   * Umi 的依赖预编译方案，这里关闭
   * false: 不启用 MFSU，使用传统构建方式
   */
  mfsu: false,

  /**
   * Mako 构建器配置
   * 只在 macOS (Darwin) 和 Linux 系统上启用
   * Windows 系统不支持 Mako，自动降级为 Webpack
   */
  mako: ['Darwin', 'Linux'].includes(os.type()) ? {} : false,

  /**
   * 跨域资源共享配置
   * 为 <script> 和 <link> 标签添加 crossorigin 属性
   */
  crossorigin: {},

  /**
   * 运行时 publicPath
   * 支持运行时动态修改 publicPath（资源路径前缀）
   */
  runtimePublicPath: {},

  /**
   * 构建输出目录
   * 执行 dumi build 后，生成的静态文件会输出到 _site 目录
   */
  outputPath: '_site',

  /**
   * 网站图标（favicon）
   * 可配置多个不同尺寸的图标，浏览器会自动选择合适的尺寸
   */
  favicons: [
    'https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*eco6RrQhxbMAAAAAAAAAAAAADgCCAQ/original',
  ],

  // ============================================================================
  // 文档和组件解析配置
  // ============================================================================

  resolve: {
    /**
     * 文档目录配置
     * Dumi 会扫描这些目录，自动生成文档路由
     *
     * - type: 文档类型标识，用于分类
     * - dir: 目录路径（相对于当前配置文件）
     */
    // Q: docs 下不就有 x-sdk 和 x-markdown 吗？为什么还要在这里配置？
    /**
     * A: docDirs 扫面会确实会把对应目录扫描一遍，最终docs下的每个目录会变成
     *  /docs/spec (设计)
     *  /docs/react (研发)
     *  但是后面的 type 会覆盖前面的配置，所以 /docs/x-sdk 和 /docs/x-markdown 会被覆盖为
     *  /x-sdk
     *  /x-markdown
     */
    docDirs: [
      { type: 'doc', dir: 'docs' }, // 主文档目录
      { type: 'x-sdk', dir: 'docs/x-sdk' }, // SDK 文档
      { type: 'x-markdown', dir: 'docs/x-markdown' }, // Markdown 组件文档
    ],

    /**
     * 组件目录配置
     * atomDirs: 原子组件目录，Dumi 会自动扫描这些目录下的组件
     *
     * type: 'component' 表示这是组件目录
     * dir: 'components' 指向组件源码目录
     *
     * 扫描规则：
     * - 会查找每个组件的 index.md 或 README.md 作为组件文档
     * - 会自动生成组件 API 文档（基于 TypeScript 类型）
     *
     * 最终生成的路由是 /components/xxx
     */
    atomDirs: [{ type: 'component', dir: 'components' }],

    /**
     * 代码块模式
     * passive: 被动模式，只有明确标记的代码块才会被处理为可交互的 Demo
     * active: 主动模式，默认所有代码块都是可交互的
     */
    codeBlockMode: 'passive',
  },

  // ============================================================================
  // 国际化配置
  // ============================================================================

  /**
   * 多语言配置
   *
   * 路径约定：
   * - 英文版: /components/button (无后缀)
   * - 中文版: /components/button-cn (添加 -cn 后缀)
   *
   * 文件约定：
   * - 英文: button.md 或 button.en-US.md
   * - 中文: button.zh-CN.md
   */
  locales: [
    { id: 'en-US', name: 'English', suffix: '' }, // 英文，无后缀
    { id: 'zh-CN', name: '中文', suffix: '-cn' }, // 中文，-cn 后缀
  ],

  // ============================================================================
  // 全局变量定义
  // ============================================================================

  /**
   * 定义全局变量
   * 这些变量可以在代码中直接使用，构建时会被替换为实际值
   *
   * antdReproduceVersion: 用于问题复现，指定组件库版本
   */
  define: {
    antdReproduceVersion: version, // 当前版本号（从 package.json 读取）
  },

  /**
   * 外部依赖配置
   * 这些包不会被打包，而是从全局变量中获取
   *
   * 优化 GPT-Vis 构建：
   * - mapbox-gl 和 maplibre-gl 是地图库，体积较大
   * - 配置为 externals 后，不会被打包进 bundle
   * - 需要在 HTML 中通过 <script> 标签引入
   */
  externals: {
    // optimize build of GPT-Vis
    'mapbox-gl': 'mapboxgl',
    'maplibre-gl': 'maplibregl',
  },

  // ============================================================================
  // 路径别名配置
  // ============================================================================

  /**
   * 模块路径别名
   * 将模块导入路径映射到实际的文件路径
   *
   * 作用：
   * 1. 开发时可以使用发布后的包名来导入组件
   * 2. 确保文档示例代码与实际使用方式一致
   *
   * 示例：
   * import { Bubble } from '@ant-design/x';  // 会解析到 ./components
   */
  alias: {
    '@ant-design/x/lib': path.join(__dirname, 'components'), // CommonJS 产物
    '@ant-design/x/es': path.join(__dirname, 'components'), // ES Module 产物
    '@ant-design/x': path.join(__dirname, 'components'), // 默认入口
    '@ant-design/x-markdown': '../x-markdown/src', // Markdown 组件
    '@ant-design/x-sdk': '../x-sdk/src', // SDK 包
    // 修复 Icon 组件导入问题，强制使用 lib 目录（避免重复打包）
    // Issue: https://github.com/ant-design/ant-design/issues/46628
    '@ant-design/icons$': '@ant-design/icons/lib',
  },

  // ============================================================================
  // Markdown 处理插件
  // ============================================================================

  /**
   * Rehype 插件
   * rehype 用于处理 HTML AST（抽象语法树）
   * rehypeAntd: 自定义插件，用于处理 Ant Design 特定的 HTML 结构
   */
  extraRehypePlugins: [rehypeAntd],

  /**
   * Remark 插件
   * remark 用于处理 Markdown AST
   * remarkAntd: 自定义插件，用于处理 Ant Design 特定的 Markdown 语法
   */
  extraRemarkPlugins: [remarkAntd],

  // ============================================================================
  // HTML Meta 配置
  // ============================================================================

  /**
   * HTML <meta> 标签配置
   * 这些 meta 标签会被注入到每个页面的 <head> 中
   */
  metas: [
    // 主题色（用于浏览器 UI，如地址栏颜色）
    { name: 'theme-color', content: '#1677ff' },

    // 构建时间戳（用于缓存策略）
    { name: 'build-time', content: Date.now().toString() },

    // 构建 hash（来自 GitHub Actions 的 commit SHA）
    // 用于追踪部署版本
    { name: 'build-hash', content: process.env.GITHUB_SHA ?? 'unknown' },
  ],

  // ============================================================================
  // 统计分析配置
  // ============================================================================

  /**
   * Google Analytics 配置
   * ga_v2: Google Analytics 4 (GA4) 的 Measurement ID
   * 用于网站访问统计分析
   */
  analytics: {
    ga_v2: 'G-5CDH4LN3Z8',
  },

  // ============================================================================
  // Runtime 配置
  // ============================================================================

  /**
   * transformRuntime 配置
   * absoluteRuntime: 使用绝对路径引入 runtime helpers
   * 避免构建产物中出现相对路径问题
   */
  transformRuntime: {
    // process.cwd() 执行命令的目录（当前工作目录）
    // __dirname 当前文件所在的目录（文件绝对路径）
    absoluteRuntime: process.cwd(),
  },

  /**
   * Webpack Bundle Analyzer 配置
   * 用于分析构建产物体积
   *
   * - 生产环境: 关闭（避免影响构建速度）
   * - 开发环境: 开启，自动分配端口
   *
   * 运行 dumi build 后会打开一个页面，可视化展示各模块大小
   */
  analyze:
    process.env.NODE_ENV === 'production'
      ? false
      : {
          analyzerPort: 'auto', // 自动分配可用端口
        },

  // ============================================================================
  // 资源预加载配置
  // ============================================================================

  /**
   * <link> 标签配置
   * 用于预加载字体等资源，提升页面加载性能
   *
   * 预加载策略：
   * - prefetch: 低优先级，浏览器空闲时加载（用于下个页面可能用到的资源）
   * - preload: 高优先级，立即加载（用于当前页面必需的资源）
   *
   * 字体加载优化：
   * 1. prefetch 多种字体格式（woff2, woff, ttf），浏览器会选择支持的格式
   * 2. preload 关键字体（主要字体优先加载）
   * 3. crossorigin='anonymous' 允许跨域加载
   */
  links: [
    // ======== Prefetch 字体（预取，低优先级）========
    {
      rel: 'prefetch',
      as: 'font',
      href: '//at.alicdn.com/t/webfont_6e11e43nfj.woff2',
      type: 'font/woff2',
      crossorigin: 'anonymous',
    },
    {
      rel: 'prefetch',
      as: 'font',
      href: '//at.alicdn.com/t/webfont_6e11e43nfj.woff',
      type: 'font/woff',
      crossorigin: 'anonymous',
    },
    {
      rel: 'prefetch',
      as: 'font',
      href: '//at.alicdn.com/t/webfont_6e11e43nfj.ttf',
      type: 'font/ttf',
      crossorigin: 'anonymous',
    },
    {
      rel: 'prefetch',
      as: 'font',
      href: '//at.alicdn.com/t/webfont_exesdog9toj.woff2',
      type: 'font/woff2',
      crossorigin: 'anonymous',
    },
    {
      rel: 'prefetch',
      as: 'font',
      href: '//at.alicdn.com/t/webfont_exesdog9toj.woff',
      type: 'font/woff',
      crossorigin: 'anonymous',
    },
    {
      rel: 'prefetch',
      as: 'font',
      href: '//at.alicdn.com/t/webfont_exesdog9toj.ttf',
      type: 'font/ttf',
      crossorigin: 'anonymous',
    },

    // ======== Preload 字体（预加载，高优先级）========
    // 关键字体，页面首次渲染需要
    {
      rel: 'preload',
      as: 'font',
      href: '//at.alicdn.com/wf/webfont/exMpJIukiCms/Gsw2PSKrftc1yNWMNlXgw.woff2',
      type: 'font/woff2',
      crossorigin: 'anonymous',
    },
    {
      rel: 'preload',
      as: 'font',
      href: '//at.alicdn.com/wf/webfont/exMpJIukiCms/vtu73by4O2gEBcvBuLgeu.woff',
      type: 'font/woff2',
      crossorigin: 'anonymous',
    },
  ],

  // ============================================================================
  // Head 脚本配置（国际化逻辑）
  // ============================================================================

  /**
   * 内联脚本，会被注入到每个页面的 <head> 中
   *
   * 功能：国际化路由自动切换
   *
   * 执行时机：在所有静态资源加载前执行（避免加载错误语言的资源）
   *
   * 逻辑流程：
   * 1. 检测当前路径的语言（是否包含 -cn 后缀）
   * 2. 检测 URL 参数中的语言设置 (?locale=zh-CN)
   * 3. 检测浏览器语言或 localStorage 中保存的语言偏好
   * 4. 如果检测到的语言与当前路径不匹配，自动跳转到对应语言版本
   * 5. 为 <html> 标签添加对应的语言 class（zh-cn 或 en-us）
   *
   * 示例：
   * - 访问 /components/button，浏览器语言是中文 → 跳转到 /components/button-cn
   * - 访问 /components/button-cn，URL 参数 ?locale=en-US → 跳转到 /components/button
   */
  headScripts: [
    `
    (function () {
      /**
       * 检测 localStorage 是否可用
       * 某些浏览器的隐私模式会禁用 localStorage
       */
      function isLocalStorageNameSupported() {
        const testKey = 'test';
        const storage = window.localStorage;
        try {
          storage.setItem(testKey, '1');
          storage.removeItem(testKey);
          return true;
        } catch (error) {
          return false;
        }
      }
      
      // 获取当前路径
      // 优先级提高到所有静态资源的前面，语言不对，加载其他静态资源没意义
      const pathname = location.pathname;

      /**
       * 判断路径是否为中文版本
       * @param {string} pathname - 路径
       * @returns {boolean} - 是否为中文版本
       * 
       * 规则：路径以 -cn 或 -cn/ 结尾
       * 示例：/components/button-cn ✓  /components/button ✗
       */
      function isZhCN(pathname) {
        return /-cn\\/?$/.test(pathname);
      }
      
      /**
       * 获取本地化路径
       * @param {string} path - 原始路径
       * @param {boolean} zhCN - 是否需要中文版本
       * @returns {string} - 本地化后的路径
       * 
       * 转换规则：
       * - 英文 → 中文：添加 -cn 后缀
       *   /components/button → /components/button-cn
       *   /components/button/ → /components/button-cn/
       *   / → /index-cn
       * 
       * - 中文 → 英文：移除 -cn 后缀
       *   /components/button-cn → /components/button
       *   /index-cn → /
       */
      function getLocalizedPathname(path, zhCN) {
        const pathname = path.indexOf('/') === 0 ? path : '/' + path;
        if (!zhCN) {
          // 转换为英文版本
          return /\\/?index(-cn)?/.test(pathname) ? '/' : pathname.replace('-cn', '');
        } else if (pathname === '/') {
          // 首页转换为中文版本
          return '/index-cn';
        } else if (pathname.indexOf('/') === pathname.length - 1) {
          // 以 / 结尾的路径
          return pathname.replace(/\\/$/, '-cn/');
        }
        // 普通路径添加 -cn 后缀
        return pathname + '-cn';
      }

      /**
       * 兼容旧的 URL 参数方式
       * 旧版本使用 ?locale=zh-CN 来指定语言
       * 新版本使用路径后缀 -cn
       * 
       * 如果检测到 URL 参数，自动跳转到新的路径格式
       * 示例：/components/button?locale=zh-CN → /components/button-cn
       */
      const queryString = location.search;
      if (queryString) {
        const isZhCNConfig = queryString.indexOf('zh-CN') > -1;
        if (isZhCNConfig && !isZhCN(pathname)) {
          location.pathname = getLocalizedPathname(pathname, isZhCNConfig);
        }
      }

      /**
       * 首页语言自动切换
       * 
       * 优先级：
       * 1. localStorage 中保存的语言偏好
       * 2. 浏览器语言设置
       * 
       * 仅在首页（/ 或 /index-cn）生效
       * 原因：避免用户手动访问特定语言的页面时被强制跳转
       * 参考：https://github.com/ant-design/ant-design/issues/4552
       */
      if (isLocalStorageNameSupported() && (pathname === '/' || pathname === '/index-cn')) {
        const lang =
          (window.localStorage && localStorage.getItem('locale')) ||
          ((navigator.language || navigator.browserLanguage).toLowerCase() === 'zh-cn'
            ? 'zh-CN'
            : 'en-US');
        // safari 浏览器返回 'zh-cn'，其他浏览器返回 'zh-CN'
        if ((lang === 'zh-CN') !== isZhCN(pathname)) {
          location.pathname = getLocalizedPathname(pathname, lang === 'zh-CN');
        }
      }
      
      /**
       * 为 <html> 标签添加语言 class
       * 用于 CSS 样式差异化处理
       * 
       * 示例：
       * <html class="zh-cn"> 或 <html class="en-us">
       */
      document.documentElement.className += isZhCN(pathname) ? 'zh-cn' : 'en-us';
    })();
    `,
  ],
});
