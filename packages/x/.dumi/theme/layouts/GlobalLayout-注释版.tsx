/**
 * GlobalLayout - dumi 全局布局组件
 *
 * @fileoverview
 * 这是整个文档站点的最外层布局组件，所有页面都会被它包裹。
 * 在 dumi 的主题系统中，GlobalLayout 是一个特殊的布局组件，
 * 它会自动被 dumi 识别并作为根布局使用。
 *
 * @description
 * 主要职责：
 * 1. 提供全局主题配置（暗色/亮色/紧凑模式）
 *    - 支持通过 URL 参数 ?theme=dark 切换主题
 *    - 首页强制使用暗色主题以配合首页设计
 *
 * 2. 提供站点上下文（方向、移动端检测等）
 *    - direction: 支持 LTR（从左到右）和 RTL（从右到左）布局
 *    - isMobile: 响应式检测，窗口宽度 < 870px 时为移动端
 *
 * 3. SSR 样式注入（antd cssinjs 样式提取）
 *    - 使用 @ant-design/cssinjs 的 extractStyle 提取样式
 *    - 通过 useServerInsertedHTML 在 SSR 时注入到 HTML
 *
 * 4. 响应式布局检测
 *    - 监听 window resize 事件
 *    - 自动切换移动端/桌面端模式
 *
 *
 * @see https://d.umijs.org/guide/theme 了解 dumi 主题系统
 */

// ============================================================================
// 第三方依赖
// ============================================================================

import {
  createCache, // 创建样式缓存实例，用于 SSR 样式提取
  extractStyle, // 从缓存中提取样式字符串
  legacyNotSelectorLinter, // CSS 检查器：检测不推荐的 :not() 选择器用法
  NaNLinter, // CSS 检查器：检测 NaN 值
  parentSelectorLinter, // CSS 检查器：检测父选择器问题
  StyleProvider, // 样式提供者组件，管理 cssinjs 上下文
} from '@ant-design/cssinjs';

import { getSandpackCssText } from '@codesandbox/sandpack-react'; // 获取 Sandpack 编辑器的 CSS

import type { MappingAlgorithm } from 'antd'; // antd 主题算法类型
import { App, theme as antdTheme } from 'antd'; // App 组件和主题工具

import type { DirectionType, ThemeConfig } from 'antd/es/config-provider'; // antd 配置类型

import {
  createSearchParams, // 创建 URL 查询参数
  useOutlet, // 获取路由出口（子页面组件）
  useSearchParams, // URL 查询参数 hook
  useServerInsertedHTML, // SSR 时向 HTML 注入内容的 hook
} from 'dumi';

import React, { useCallback, useEffect, useState } from 'react';

// ============================================================================
// 本地依赖
// ============================================================================

// ============================================================================
// 本地依赖
// ============================================================================

/**
 * DarkContext - 暗色模式上下文
 * 提供一个布尔值表示当前是否为暗色模式
 * 子组件可通过 useDark() hook 获取
 */
import { DarkContext } from '../../hooks/useDark';

/**
 * useLayoutState - 布局状态管理 hook
 * 类似 useState，但会在路由切换时保持状态
 * 避免页面切换时主题等设置被重置
 */
import useLayoutState from '../../hooks/useLayoutState';

/**
 * useLocation - 获取当前路由位置
 * 封装了 react-router 的 useLocation
 * 提供 pathname、search 等信息
 */
import useLocation from '../../hooks/useLocation';

/** ThemeName - 主题名称类型：'light' | 'dark' | 'compact' | 'motion-off' */
import type { ThemeName } from '../common/ThemeSwitch';

/**
 * SiteThemeProvider - 站点主题提供者
 * 封装了 antd 的 ConfigProvider
 * 应用主题算法和 token 配置
 */
import SiteThemeProvider from '../SiteThemeProvider';

/** Alert - 顶部公告栏组件，用于展示重要通知 */
import Alert from '../slots/Alert';

/**
 * SiteContext - 站点配置上下文
 * 提供全局站点配置，包括：
 * - theme: 当前主题
 * - direction: 文字方向
 * - isMobile: 是否移动端
 * - updateSiteConfig: 更新配置的方法
 */
import type { SiteContextProps } from '../slots/SiteContext';
import SiteContext from '../slots/SiteContext';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Entries<T> - 将对象类型转换为 [key, value] 元组数组类型
 *
 * @description
 * TypeScript 的 Object.entries() 返回类型是 [string, any][]
 * 这个类型工具可以保留原始对象的键值类型信息
 *
 * @example
 * type Obj = { name: string; age: number };
 * type ObjEntries = Entries<Obj>;
 * // 结果: ['name', string] | ['age', number]
 *
 * @template T - 源对象类型
 */
type Entries<T> = { [K in keyof T]: [K, T[K]] }[keyof T][];

/**
 * SiteState - 站点状态类型
 *
 * @description
 * 从 SiteContextProps 中排除 updateSiteContext 方法
 * 因为状态只需要数据部分，不需要更新方法
 *
 * Partial<T> 使所有属性变为可选，方便部分更新
 */
type SiteState = Partial<Omit<SiteContextProps, 'updateSiteContext'>>;

// ============================================================================
// 常量定义
// ============================================================================

/**
 * RESPONSIVE_MOBILE - 响应式断点
 *
 * @description
 * 窗口宽度小于此值时，站点切换为移动端模式
 * 移动端模式下会：
 * - 隐藏侧边栏，改为抽屉式导航
 * - 调整布局为单列
 * - 优化触摸交互
 *
 * @constant {number} 870 - 像素值
 */
const RESPONSIVE_MOBILE = 870;

/**
 * ANT_DESIGN_NOT_SHOW_BANNER - localStorage 存储键
 *
 * @description
 * 用于记录用户是否关闭了顶部 Banner
 * 关闭后不再显示，直到下次清除 localStorage
 *
 * @constant {string}
 */
export const ANT_DESIGN_NOT_SHOW_BANNER = 'ANT_DESIGN_NOT_SHOW_BANNER';

// ============================================================================
// 工具函数
// ============================================================================

/**
 * getAlgorithm - 根据主题名称获取 antd 主题算法
 *
 * @description
 * antd 5.x 使用算法（Algorithm）来生成主题 token
 * 不同的算法会生成不同的颜色、间距等设计变量
 *
 * 支持的主题：
 * - 'dark': 暗色主题，使用 darkAlgorithm
 * - 'compact': 紧凑主题，使用 compactAlgorithm
 * - 'light': 亮色主题，不需要特殊算法（默认）
 * - 'motion-off': 关闭动画，不是算法，在 themeConfig 中处理
 *
 * 多个算法可以组合使用，例如 ['dark', 'compact'] 会同时应用暗色和紧凑
 *
 * @param {ThemeName[]} themes - 主题名称数组
 * @returns {MappingAlgorithm[]} antd 主题算法数组
 *
 * @example
 * // 单个主题
 * getAlgorithm(['dark'])
 * // 返回: [darkAlgorithm]
 *
 * @example
 * // 组合主题
 * getAlgorithm(['dark', 'compact'])
 * // 返回: [darkAlgorithm, compactAlgorithm]
 *
 * @example
 * // 默认主题（不需要算法）
 * getAlgorithm(['light'])
 * // 返回: []
 *
 * @see https://ant.design/docs/react/customize-theme-cn#theme-algorithm
 */
const getAlgorithm = (themes: ThemeName[] = []) =>
  themes
    .map((theme) => {
      if (theme === 'dark') {
        return antdTheme.darkAlgorithm;
      }
      if (theme === 'compact') {
        return antdTheme.compactAlgorithm;
      }
      // light 和 motion-off 不需要特殊算法
      return null as unknown as MappingAlgorithm;
    })
    .filter(Boolean); // 过滤掉 null 值

// ============================================================================
// 主组件
// ============================================================================

/**
 * GlobalLayout - 全局布局组件
 *
 * @description
 * dumi 主题系统的核心组件，作为所有页面的根布局。
 * 当 dumi 检测到 .dumi/theme/layouts/GlobalLayout.tsx 文件时，
 * 会自动将其作为全局布局使用。
 *
 * 组件层级结构（从外到内）：
 * ```
 * <DarkContext>                 - 暗色模式上下文，提供 isDark 布尔值
 *   <StyleProvider>             - antd cssinjs 样式提供者，管理样式缓存
 *     <SiteContext>             - 站点配置上下文，提供主题、方向等配置
 *       <SiteThemeProvider>     - antd ConfigProvider 封装，应用主题
 *         <Alert />             - 顶部公告栏（可关闭）
 *         <App>                 - antd App 组件，提供静态方法
 *           {outlet}            - 路由出口，渲染当前页面
 *         </App>
 *       </SiteThemeProvider>
 *     </SiteContext>
 *   </StyleProvider>
 * </DarkContext>
 * ```
 *
 * @returns {JSX.Element} 布局组件
 */
const GlobalLayout: React.FC = () => {
  // ==========================================================================
  // Hooks - 获取外部状态和工具
  // ==========================================================================

  /**
   * outlet - 路由出口
   *
   * @description
   * useOutlet() 返回当前路由匹配的子组件
   * 类似于 React Router 的 <Outlet /> 组件
   * 这里获取到的就是当前页面的内容
   */
  const outlet = useOutlet();

  /**
   * pathname - 当前路径
   *
   * @description
   * 用于判断当前页面类型，例如：
   * - '/' 或 '/index' 或 '/index-cn' 表示首页
   * - '/components/button' 表示组件文档页
   * - '/~demos/xxx' 表示 Demo 预览页
   */
  const { pathname } = useLocation();

  /**
   * token - antd 主题 token
   *
   * @description
   * 包含当前主题的所有设计变量，如：
   * - colorBgContainer: 容器背景色
   * - colorPrimary: 主色
   * - borderRadius: 圆角大小
   * 等等...
   */
  const { token } = antdTheme.useToken();

  /**
   * searchParams - URL 查询参数
   *
   * @description
   * 用于持久化主题和方向设置到 URL
   * 例如：?theme=dark&direction=rtl
   * 这样用户刷新页面后设置不会丢失
   * 也方便分享特定主题的链接
   */
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * 站点状态 - 核心状态管理
   *
   * @description
   * 使用 useLayoutState 而不是 useState
   * 因为 useLayoutState 会在路由切换时保持状态
   *
   * 状态字段：
   * - theme: 主题数组，如 ['dark', 'compact']
   * - direction: 文字方向 'ltr'（默认）或 'rtl'（阿拉伯语等）
   * - isMobile: 是否为移动端视口
   * - bannerVisible: 顶部 Banner 是否显示
   */
  const [{ theme = [], direction, isMobile, bannerVisible = false }, setSiteState] =
    useLayoutState<SiteState>({
      isMobile: false,
      direction: 'ltr',
      theme: [],
      bannerVisible: false,
    });

  /**
   * isIndexPage - 是否为首页
   *
   * @description
   * 首页需要特殊处理：
   * 1. 强制使用暗色主题（配合首页的深色设计）
   * 2. 使用不同的 meta theme-color
   *
   * 判断逻辑：路径为空、'/' 或以 '/index' 开头
   */
  const isIndexPage = React.useMemo(
    () => pathname === '' || pathname.startsWith('/index'),
    [pathname],
  );

  // ==========================================================================
  // 回调函数 - 状态更新逻辑
  // ==========================================================================

  /**
   * updateSiteConfig - 更新站点配置
   *
   * @description
   * 这是一个核心函数，负责同步更新三个地方：
   * 1. 组件内部状态（React state）
   * 2. URL 查询参数（实现刷新后状态保持）
   * 3. HTML 根元素属性（供 CSS 选择器使用）
   *
   * 为什么要同步到 URL？
   * - 用户刷新页面后设置不会丢失
   * - 可以分享特定主题的链接给他人
   * - 便于调试和测试
   *
   * 为什么要同步到 HTML 属性？
   * - CSS 可以通过 html[data-prefers-color="dark"] 选择器应用样式
   * - 无需等待 JS 执行，避免闪烁
   *
   * @param {SiteState} props - 要更新的配置项（部分更新）
   *
   * @example
   * // 切换到暗色主题
   * updateSiteConfig({ theme: ['dark'] })
   *
   * @example
   * // 切换到 RTL 布局
   * updateSiteConfig({ direction: 'rtl' })
   */
  const updateSiteConfig = useCallback(
    (props: SiteState) => {
      // ========== 步骤 1：更新 React 状态 ==========
      setSiteState((prev) => ({ ...prev, ...props }));

      // ========== 步骤 2：同步到 URL 查询参数 ==========
      const oldSearchStr = searchParams.toString();

      let nextSearchParams: URLSearchParams = searchParams;
      (Object.entries(props) as Entries<SiteContextProps>).forEach(([key, value]) => {
        // 处理文字方向
        // 只有 RTL 需要存储，LTR 是默认值
        if (key === 'direction') {
          if (value === 'rtl') {
            nextSearchParams.set('direction', 'rtl');
          } else {
            nextSearchParams.delete('direction');
          }
        }

        // 处理主题设置
        if (key === 'theme') {
          // 过滤掉 'light'，因为 light 是默认值，不需要存储
          // 这样 URL 更简洁：?theme=dark 而不是 ?theme=dark&theme=light
          nextSearchParams = createSearchParams({
            ...nextSearchParams,
            theme: value.filter((t) => t !== 'light'),
          });

          // ========== 步骤 3：同步到 HTML 根元素 ==========
          // 设置 data-prefers-color 属性，供 CSS 使用
          // 例如：html[data-prefers-color="dark"] body { background: #000; }
          document
            .querySelector('html')
            ?.setAttribute('data-prefers-color', value.includes('dark') ? 'dark' : 'light');
        }
      });

      // 只有参数变化时才更新 URL，避免不必要的历史记录
      if (nextSearchParams.toString() !== oldSearchStr) {
        setSearchParams(nextSearchParams);
      }
    },
    [searchParams, setSearchParams],
  );

  /**
   * updateMobileMode - 检测并更新移动端模式
   *
   * @description
   * 根据当前窗口宽度判断是否为移动端
   * 阈值为 RESPONSIVE_MOBILE (870px)
   *
   * 这个函数会在：
   * 1. 组件初始化时调用
   * 2. 窗口 resize 时调用
   */
  const updateMobileMode = () => {
    updateSiteConfig({ isMobile: window.innerWidth < RESPONSIVE_MOBILE });
  };

  // ==========================================================================
  // 副作用 - 生命周期和事件监听
  // ==========================================================================

  /**
   * 副作用：更新浏览器主题色
   *
   * @description
   * 动态更新 <meta name="theme-color"> 的值
   * 这会影响：
   * - 移动端浏览器的地址栏/状态栏颜色
   * - PWA 应用的标题栏颜色
   * - 某些浏览器的标签页颜色
   *
   * 颜色策略：
   * - 首页：使用深色 #0c0e10cc（配合首页的深色设计）
   * - 其他页面：使用 antd 的 colorBgContainer（跟随主题）
   *
   * @dependencies [theme.length, isIndexPage]
   * - theme.length 变化表示主题切换
   * - isIndexPage 变化表示页面切换
   */
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (metaThemeColor) {
      // 首页使用深色背景色，其他页面使用 antd 的背景色
      metaThemeColor.setAttribute('content', isIndexPage ? '#0c0e10cc' : token.colorBgContainer);
    }
  }, [theme.length, isIndexPage]);

  /**
   * alertVisible - 顶部公告栏显示状态
   *
   * @description
   * 控制顶部 Alert 公告栏是否显示
   *
   * 默认逻辑：
   * - Demo 预览页（路径包含 '~demos'）不显示
   * - 其他页面默认显示
   *
   * 用户可以手动关闭，关闭后在当前会话中不再显示
   */
  const [alertVisible, setAlertVisible] = useState(!pathname?.includes?.('~demos'));

  /**
   * 副作用：初始化和事件监听
   *
   * @description
   * 组件挂载时执行，负责：
   *
   * 1. 从 URL 恢复设置
   *    - 读取 ?theme=dark&direction=rtl 等参数
   *    - 应用到组件状态
   *    - 这样用户刷新页面后设置不会丢失
   *
   * 2. 同步主题到 HTML
   *    - 设置 data-prefers-color 属性
   *    - 确保 CSS 选择器能正确匹配
   *
   * 3. 初始化移动端检测
   *    - 根据当前窗口宽度判断
   *
   * 4. 监听窗口 resize
   *    - 实时响应窗口大小变化
   *    - 组件卸载时移除监听器
   *
   * @dependencies [] - 空数组，只在挂载时执行一次
   */
  useEffect(() => {
    // ========== 步骤 1：从 URL 参数恢复设置 ==========
    // getAll 用于获取多值参数，如 ?theme=dark&theme=compact
    const _theme = searchParams.getAll('theme') as ThemeName[];
    const _direction = searchParams.get('direction') as DirectionType;

    setSiteState({
      theme: _theme,
      direction: _direction === 'rtl' ? 'rtl' : 'ltr',
    });

    // ========== 步骤 2：同步主题到 HTML 根元素 ==========
    document.documentElement.setAttribute(
      'data-prefers-color',
      _theme.includes('dark') ? 'dark' : 'light',
    );

    // ========== 步骤 3：初始化移动端检测 ==========
    updateMobileMode();

    // ========== 步骤 4：监听窗口大小变化 ==========
    window.addEventListener('resize', updateMobileMode);

    // 清理函数：组件卸载时移除事件监听
    return () => {
      window.removeEventListener('resize', updateMobileMode);
    };
  }, []);

  // ==========================================================================
  // Memo 值 - 性能优化
  // ==========================================================================

  /**
   * siteContextValue - 站点上下文值
   *
   * @description
   * 通过 SiteContext.Provider 向所有子组件提供站点配置
   * 子组件可以通过 useSiteContext() hook 获取这些值
   *
   * 使用 useMemo 优化：
   * - 只有依赖项变化时才重新创建对象
   * - 避免不必要的子组件重渲染
   *
   * 提供的值：
   * - direction: 文字方向
   * - updateSiteConfig: 更新配置的方法
   * - theme: 当前主题数组
   * - isMobile: 是否移动端
   * - bannerVisible: Banner 是否可见
   * - alertVisible: Alert 是否可见
   */
  const siteContextValue = React.useMemo<SiteContextProps>(
    () => ({
      direction,
      updateSiteConfig,
      theme: theme!,
      isMobile: isMobile!,
      bannerVisible,
      alertVisible,
    }),
    [isMobile, direction, updateSiteConfig, alertVisible, theme],
  );

  /**
   * themeConfig - antd 主题配置
   *
   * @description
   * 传递给 SiteThemeProvider（ConfigProvider）的主题配置
   *
   * 配置项：
   * - algorithm: 主题算法数组
   *   - 首页强制使用 ['dark']，配合首页的深色设计
   *   - 其他页面根据用户选择
   *
   * - token.motion: 是否启用动画
   *   - 当 theme 包含 'motion-off' 时禁用动画
   *   - 用于无障碍访问或性能优化
   *
   * @see https://ant.design/docs/react/customize-theme-cn
   */
  const themeConfig = React.useMemo<ThemeConfig>(
    () => ({
      algorithm: isIndexPage ? getAlgorithm(['dark']) : getAlgorithm(theme),
      token: { motion: !theme.includes('motion-off') },
    }),
    [theme, pathname, isIndexPage],
  );

  /**
   * styleCache - antd cssinjs 样式缓存
   *
   * @description
   * 使用 @ant-design/cssinjs 的 createCache 创建样式缓存
   *
   * 作用：
   * 1. 收集组件渲染时生成的样式
   * 2. SSR 时通过 extractStyle 提取样式字符串
   * 3. 注入到 HTML 的 <style> 标签中
   *
   * 为什么用 useState 而不是 useMemo？
   * - 确保整个组件生命周期内只创建一次
   * - useState 的初始化函数只执行一次
   */
  const [styleCache] = React.useState(() => createCache());

  // ==========================================================================
  // SSR 样式注入 - 服务端渲染优化
  // ==========================================================================

  /**
   * SSR 样式注入 1：antd 组件样式
   *
   * @description
   * useServerInsertedHTML 是 dumi 提供的 hook
   * 用于在 SSR 时向 HTML 的 <head> 中注入内容
   *
   * 这里注入 antd cssinjs 生成的组件样式
   *
   * extractStyle 参数：
   * - plain: true - 返回纯 CSS 字符串（不带 <style> 标签）
   * - types: 'style' - 只提取组件样式（不含 CSS 变量）
   *
   * data-type="antd-cssinjs" 用于标识这个 style 标签的来源
   *
   * 为什么需要 SSR 样式注入？
   * - 避免页面加载时的样式闪烁（FOUC）
   * - 提升首屏渲染速度
   * - 改善 SEO（搜索引擎能看到完整样式的页面）
   */
  useServerInsertedHTML(() => {
    const styleText = extractStyle(styleCache, {
      plain: true,
      types: 'style',
    });
    // biome-ignore lint/security/noDangerouslySetInnerHtml: only used in .dumi
    return <style data-type="antd-cssinjs" dangerouslySetInnerHTML={{ __html: styleText }} />;
  });

  /**
   * SSR 样式注入 2：antd CSS 变量和 token
   *
   * @description
   * 注入 antd 的 CSS 变量和 design token
   *
   * extractStyle 参数：
   * - types: ['cssVar', 'token'] - 提取 CSS 变量和 token 样式
   *
   * 特殊属性：
   * - data-rc-order="prepend" - 确保样式在最前面插入
   * - data-rc-priority="-9999" - 最高优先级，不会被其他样式覆盖
   *
   * 这些属性是 @ant-design/cssinjs 的约定
   * 用于控制样式的插入顺序和优先级
   */
  useServerInsertedHTML(() => {
    const styleText = extractStyle(styleCache, {
      plain: true,
      types: ['cssVar', 'token'],
    });
    return (
      <style
        data-type="antd-css-var"
        data-rc-order="prepend"
        data-rc-priority="-9999"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: only used in .dumi
        dangerouslySetInnerHTML={{ __html: styleText }}
      />
    );
  });

  /**
   * SSR 样式注入 3：Sandpack 代码编辑器样式
   *
   * @description
   * Sandpack 是 CodeSandbox 提供的在线代码编辑器组件
   * 用于文档中的交互式代码演示
   *
   * getSandpackCssText() 返回 Sandpack 所需的所有 CSS
   * 在 SSR 时注入，避免客户端加载时的样式闪烁
   */
  useServerInsertedHTML(() => (
    <style
      data-sandpack="true"
      id="sandpack"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: only used in .dumi
      dangerouslySetInnerHTML={{ __html: getSandpackCssText() }}
    />
  ));

  // ==========================================================================
  // 渲染 - 组件树结构
  // ==========================================================================

  /**
   * 返回组件树
   *
   * @description
   * 组件层级从外到内的作用：
   *
   * 1. DarkContext
   *    - 提供暗色模式状态（布尔值）
   *    - 子组件通过 useDark() 获取
   *    - 用于需要根据暗色模式调整的自定义组件
   *
   * 2. StyleProvider
   *    - antd cssinjs 的样式提供者
   *    - cache: 样式缓存实例，用于 SSR 提取
   *    - linters: 开发时的样式检查器
   *      - legacyNotSelectorLinter: 检测旧版 :not() 用法
   *      - parentSelectorLinter: 检测父选择器问题
   *      - NaNLinter: 检测 NaN 值
   *
   * 3. SiteContext
   *    - 站点配置上下文
   *    - 提供 theme、direction、isMobile 等
   *    - 提供 updateSiteConfig 方法
   *
   * 4. SiteThemeProvider
   *    - antd ConfigProvider 的封装
   *    - 应用 themeConfig（算法和 token）
   *    - 所有 antd 组件都会受此影响
   *
   * 5. Alert
   *    - 顶部公告栏
   *    - 条件渲染：alertVisible 为 true 时显示
   *    - 用户可以点击关闭
   *
   * 6. App
   *    - antd 5.x 的 App 组件
   *    - 提供 message、notification、modal 的静态方法
   *    - 确保这些方法能正确获取 ConfigProvider 的配置
   *
   * 7. outlet
   *    - 路由出口
   *    - 渲染当前 URL 对应的页面组件
   *    - 由 dumi 的路由系统控制
   */
  return (
    <DarkContext value={theme.includes('dark')}>
      <StyleProvider
        cache={styleCache}
        linters={[legacyNotSelectorLinter, parentSelectorLinter, NaNLinter]}
      >
        <SiteContext value={siteContextValue}>
          <SiteThemeProvider theme={themeConfig}>
            {/* 顶部公告栏 */}
            {/* 条件：alertVisible 为 true 时显示 */}
            {/* Demo 预览页（~demos）默认不显示 */}
            {alertVisible && (
              <Alert
                onClose={() => {
                  setAlertVisible(false);
                }}
              />
            )}
            {/* 页面主体内容 */}
            {/* outlet 是当前路由匹配的页面组件 */}
            <App>{outlet}</App>
          </SiteThemeProvider>
        </SiteContext>
      </StyleProvider>
    </DarkContext>
  );
};

export default GlobalLayout;
