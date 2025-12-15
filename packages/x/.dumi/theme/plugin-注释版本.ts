/**
 * ============================================================================
 * Dumi 主题插件 - Ant Design X 定制
 * ============================================================================
 *
 * 📍 插件加载机制：
 * 这个插件文件是 Dumi 框架**约定式自动加载**的插件
 *
 * 加载规则：
 * - Dumi 会自动扫描 `.dumi/theme/plugin.ts` 文件
 * - 如果存在，会自动注册为 Dumi 插件
 * - 不需要在配置文件中显式声明
 *
 * 约定大于配置：
 * - `.dumi/theme/plugin.ts` 是 Dumi 的特殊约定路径
 * - 类似的约定路径还有：
 *   - `.dumi/theme/layouts/` - 自定义布局组件
 *   - `.dumi/theme/builtins/` - 自定义内置组件
 *   - `.dumi/theme/slots/` - 插槽组件
 *
 * 📖 参考文档：
 * - Dumi 插件开发: https://d.umijs.org/plugin/dev
 * - Dumi API: https://d.umijs.org/plugin/api
 *
 * ============================================================================
 * 本插件主要功能：
 * ============================================================================
 *
 * 1️⃣ 扩展 React Tech Stack（技术栈）
 *    - 为代码预览器（Previewer）注入额外的 props
 *    - 自动提取组件依赖信息（dependencies/devDependencies）
 *    - 将 TypeScript 代码转换为 JavaScript 用于在线预览
 *    - 解析 Demo 的 Markdown 描述和样式
 *
 * 2️⃣ 修改路由配置
 *    - 添加额外的文档路由（如 Changelog）
 *    - 解析 monorepo 根目录的 CHANGELOG 文件
 *
 * 3️⃣ SSR（服务端渲染）样式优化
 *    - 提取 Emotion CSS-in-JS 的关键样式
 *    - 将样式提取为独立的 CSS 文件
 *    - 在 HTML <head> 中注入样式链接
 *    - 解决 SSR 首屏样式闪烁（FOUC）问题
 *
 * Q: 为什么需要 Emotion SSR 样式提取工具？
 * 首先这是一个Emotion 是一个 css in js 的包，意味着加载样式前需要先执行js，这导致 html 加载完成后，执行js才会有样式，这也导致了首屏样式闪烁
 * 加载 html，一开始没有样式，然后加载js，然后执行js，然后通过const styles = useStyles(); // Emotion 生成样式
 * 所以单独抽成了 css 文件注入到 html 中
 * Emotion 默认是将生成的样式存储到【内存缓存】：global.__ANTD_STYLE_CACHE_MANAGER_FOR_SSR__中
 *
 * Q: 提取样式的流程
 * 1. Dumi 渲染 React 组件 (Node.js)
 * 2. Emotion 样式存入内存缓存
 * 3. extractEmotionStyle() 提取样式
 * 4. 写入独立的 CSS 文件 (style-xxx.css)
 * 5. 在 HTML <head> 中注入 <link>
 * 6. 输出静态 HTML + CSS 文件
 * 7. 最终浏览器加载 HTML，<link> 标签立即加载 CSS，首屏渲染**完全有样式**（无闪烁）
 *
 * Q: 单独抽离 css 文件之后，会不会js执行重复生成样式
 * 不会，有跳过机制，如果发现文件名已经存在，就会跳过写入文件
 *
 * ============================================================================
 */

// ============================================================================
// 依赖导入
// ============================================================================

// Emotion SSR 样式提取工具
// 用于从服务端渲染的 HTML 中提取 CSS-in-JS 样式，避免首屏样式闪烁（FOUC）
import createEmotionServer from '@emotion/server/create-instance';

// Node.js 内置加密模块
// 用于生成 MD5 哈希值，为 CSS 文件生成唯一文件名（缓存破坏策略）
import { createHash } from 'crypto';

// Dumi 插件开发核心类型
// - IApi: Dumi 插件 API 实例，提供钩子和工具方法
// - IRoute: 路由配置对象类型
import type { IApi, IRoute } from 'dumi';

// Dumi 内置的 React 技术栈
// 用于处理 React 代码示例（预览器、代码转换等）
// 通过继承扩展，可以自定义代码预览器的行为
import ReactTechStack from 'dumi/dist/techStacks/react';

// Node.js 文件系统模块
// 用于读写文件（读取 Demo Markdown、写入 CSS 文件等）
import fs from 'fs';

// Node.js 路径处理模块
// 用于拼接和解析文件路径
import path from 'path';

// 项目依赖信息
// 用于注入到代码预览器，供在线编辑器（CodeSandbox、StackBlitz）自动安装依赖
import { dependencies, devDependencies, peerDependencies } from '../../package.json';

// TypeScript 转 JavaScript 工具函数
// 用于将 TS 代码转换为 JS，方便用户直接复制使用（无需配置 TS 环境）
import tsToJs from './utils/tsToJs';

/**
 * ============================================================================
 * Emotion 样式提取（用于 SSR）
 * ============================================================================
 *
 * 功能：从服务端渲染的 HTML 中提取 Emotion CSS-in-JS 样式
 *
 * 背景：
 * - Ant Design X 使用 antd-style（基于 Emotion）编写样式
 * - SSR 时，样式存储在内存缓存中（global.__ANTD_STYLE_CACHE_MANAGER_FOR_SSR__）
 * - 需要将这些样式提取出来，注入到 HTML 中
 *
 * 流程：
 * 1. 从全局缓存管理器中获取所有样式缓存
 * 2. 对每个缓存使用 Emotion Server API 提取关键样式
 * 3. 生成包含样式内容、ID 和标签的对象
 * 4. 过滤掉空样式
 *
 * @param html - 服务端渲染的 HTML 字符串
 * @returns 样式对象数组，每个对象包含：
 *          - key: 缓存键（如 'antd', 'css'）
 *          - css: 样式内容字符串
 *          - ids: 样式 ID 列表
 *          - tag: 完整的 <style> 标签字符串
 *
 * 参考：
 * - Emotion SSR: https://emotion.sh/docs/ssr
 * - Next.js with Emotion: https://github.com/vercel/next.js/blob/deprecated-main/examples/with-emotion-vanilla/pages/_document.js
 */
function extractEmotionStyle(html: string) {
  // 从全局样式缓存管理器中获取所有缓存列表。__ANTD_STYLE_CACHE_MANAGER_FOR_SSR__ 是固定变量名
  const styles = global.__ANTD_STYLE_CACHE_MANAGER_FOR_SSR__.getCacheList().map((cache) => {
    // 使用 Emotion Server API 提取关键样式
    // extractCritical 会分析 HTML，只提取实际使用的样式（Critical CSS）
    const result = createEmotionServer(cache).extractCritical(html);

    // 如果没有样式内容，返回 null（稍后会被过滤）
    if (!result.css) {
      return null;
    }

    const { css, ids } = result;

    return {
      key: cache.key, // 缓存键，如 'antd'、'css'
      css, // 样式内容
      ids, // 样式 ID 列表，用于去重和追踪
      // 生成 <style> 标签，data-emotion 属性用于 Emotion 识别和避免重复注入
      tag: `<style data-emotion="${cache.key} ${result.ids.join(' ')}">${result.css}</style>`,
    };
  });

  // 过滤掉空样式（filter(Boolean) 会移除 null 和 undefined）
  return styles.filter(Boolean);
}

/**
 * ============================================================================
 * MD5 Hash 工具函数
 * ============================================================================
 *
 * 功能：生成字符串的 MD5 哈希值（用于文件名、缓存键等）
 *
 * @param str - 要哈希的字符串
 * @param length - 哈希值长度（默认 8 位）
 * @returns MD5 哈希值的十六进制字符串
 *
 * 使用场景：
 * - 为 CSS 文件生成唯一的文件名（基于样式内容）
 * - 确保样式内容变化时，文件名也变化（缓存破坏）
 */
export const getHash = (str: string, length = 8) =>
  createHash('md5').update(str).digest('hex').slice(0, length);

/**
 * ============================================================================
 * 扩展 Dumi React Tech Stack（技术栈）
 * ============================================================================
 *
 * 背景：
 * - Dumi 使用 Tech Stack 来处理不同类型的代码示例（React、Vue 等）
 * - ReactTechStack 是 Dumi 内置的 React 技术栈
 * - 通过继承扩展，可以自定义代码预览器（Previewer）的行为
 *
 * 扩展目的：
 * 1. 注入包依赖信息（用于在线编辑器如 CodeSandbox）
 * 2. 转换 TypeScript 代码为 JavaScript（方便用户复制使用）
 * 3. 解析 Demo 的 Markdown 文档（描述、样式）
 * 4. 支持多语言文档
 *
 * 工作流程：
 * - Dumi 扫描 Markdown 中的代码块和外部 Demo 文件
 * - 调用 generatePreviewerProps 生成预览器的 props
 * - 预览器根据 props 渲染代码示例、描述、操作按钮等
 */
class AntdReactTechStack extends ReactTechStack {
  /**
   * 生成预览器 Props
   *
   * @param props - 预览器的基础 props（由 Dumi 传入）
   * @param opts - 选项对象，包含：
   *               - type: 代码块类型（'code-block' | 'external'）
   *               - entryPointCode: 内联代码内容
   *               - fileAbsPath: Demo 文件的绝对路径
   *               - mdAbsPath: Markdown 文件的绝对路径
   * @returns 增强后的 props
   */
  generatePreviewerProps(...[props, opts]: any) {
    // ========================================================================
    // 1. 注入包依赖信息
    // ========================================================================
    // 这些信息会被传递给在线编辑器（CodeSandbox、StackBlitz）
    // 用于自动安装依赖，使示例代码可以直接运行
    props.pkgDependencyList = { ...devDependencies, ...dependencies };
    props.pkgPeerDependencies = peerDependencies;

    // 初始化 jsx 属性（用于存储转换后的 JavaScript 代码）
    props.jsx ??= '';

    // ========================================================================
    // 2. 处理内联代码块（Markdown 中的 ```tsx 代码块）
    // ========================================================================
    if (opts.type === 'code-block') {
      // 将 TypeScript 代码转换为 JavaScript
      // 用户可以直接复制 JS 代码使用，无需配置 TypeScript 环境
      props.jsx = opts?.entryPointCode ? tsToJs(opts.entryPointCode) : '';
    }

    // ========================================================================
    // 3. 处理外部 Demo 文件（独立的 .tsx 文件）
    // ========================================================================
    if (opts.type === 'external') {
      // 解析当前文档的语言环境
      // 例如：/components/bubble.zh-CN.md → locale = 'zh-CN'
      const arr = opts.mdAbsPath.split('.');
      const locale = arr[arr.length - 2];

      // 查找与 Demo 同名的 Markdown 文件
      // 例如：basic.tsx → basic.md
      const mdPath = opts.fileAbsPath!.replace(/\.\w+$/, '.md');
      const md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : '';

      // 读取 Demo 的 TypeScript 源代码
      const codePath = opts.fileAbsPath!.replace(/\.\w+$/, '.tsx');
      const code = fs.existsSync(codePath) ? fs.readFileSync(codePath, 'utf-8') : '';

      // 转换为 JavaScript
      props.jsx = tsToJs(code);

      // ======================================================================
      // 4. 解析 Demo 的 Markdown 文档
      // ======================================================================
      if (md) {
        // 存储不同语言的描述和样式
        // 例如：{ 'zh-CN': '这是一个基础示例', 'en-US': 'A basic example', 'style': 'button { color: red; }' }
        const blocks: Record<string, string> = {};

        const lines = md.split('\n');

        let blockName = ''; // 当前块的名称（语言标识或 'style'）
        let cacheList: string[] = []; // 当前块的内容缓存

        /**
         * 识别块的名称
         *
         * 规则：
         * - `## zh-CN` → 中文描述块
         * - `## en-US` → 英文描述块
         * - ` ```css` 或 `<style>` → 样式块
         *
         * @param text - 当前行文本
         * @returns 块名称或 null
         */
        const getBlockName = (text: string) => {
          if (text.startsWith('## ')) {
            return text.replace('## ', '').trim();
          }

          if (text.startsWith('```css') || text.startsWith('<style>')) {
            return 'style';
          }

          return null;
        };

        /**
         * 填充块内容到 blocks 对象
         *
         * @param name - 块名称
         * @param lineList - 行内容列表
         */
        const fillBlock = (name: string, lineList: string[]) => {
          if (lineList.length) {
            let fullText: string;

            if (name === 'style') {
              // 处理样式块：移除 <style> 标签和 ```css 标记
              fullText = lineList
                .join('\n')
                .replace(/<\/?style>/g, '')
                .replace(/```(\s*css)/g, '');
            } else {
              // 处理描述块：移除标题行（第一行 ## xxx），保留内容
              fullText = lineList.slice(1).join('\n');
            }

            blocks[name] = fullText;
          }
        };

        // 逐行解析，识别并提取不同的块
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // 检测是否是新块的开始
          const nextBlockName = getBlockName(line);
          if (nextBlockName) {
            // 保存上一个块的内容
            fillBlock(blockName, cacheList);

            // 切换到新块
            blockName = nextBlockName;
            cacheList = [line];
          } else {
            // 继续累积当前块的内容
            cacheList.push(line);
          }
        }

        // 处理最后一个块
        fillBlock(blockName, cacheList);

        // 根据当前语言环境，设置描述和样式
        // 预览器会根据这些信息渲染 Demo 的说明和自定义样式
        props.description = blocks[locale];
        props.style = blocks.style;
      }
    }

    return props;
  }
}

/**
 * ============================================================================
 * require.resolve 快捷方式
 * ============================================================================
 *
 * 用途：解析模块的绝对路径
 *
 * 为什么需要？
 * - 在添加路由时，需要指定文件的绝对路径
 * - require.resolve 可以解析 node_modules 中的模块或相对路径
 * - 这个函数简化了类型标注（TypeScript 友好）
 *
 * @param p - 模块路径或相对路径
 * @returns 模块的绝对路径
 */
const resolve = (p: string): string => require.resolve(p);

/**
 * ============================================================================
 * Dumi 插件主函数
 * ============================================================================
 *
 * 这是插件的入口函数，Dumi 会自动调用它并传入 IApi 实例
 *
 * IApi 提供了丰富的钩子和工具方法，用于：
 * - 注册技术栈
 * - 修改路由
 * - 修改构建配置
 * - 修改导出的 HTML 文件
 * - 日志输出
 * - 等等...
 *
 * @param api - Dumi 插件 API 实例
 *
 * 参考文档：
 * - Dumi Plugin API: https://d.umijs.org/plugin/api
 */
const RoutesPlugin = async (api: IApi) => {
  // 动态导入 chalk（用于彩色日志输出）
  const chalk = await import('chalk').then((m) => m.default);

  // ==========================================================================
  // 工具函数：写入 CSS 文件
  // ==========================================================================
  /**
   * 将样式内容写入独立的 CSS 文件
   *
   * 文件名策略：
   * - 格式：`style-{key}.{hash}.css`
   * - key: 样式来源（如 'antd', 'css'）
   * - hash: 基于样式 ID 生成的哈希值（用于缓存破坏）
   *
   * 优化：
   * - 只在文件不存在时写入（避免重复写入相同内容）
   * - 使用哈希确保样式变化时文件名变化
   *
   * @param key - 样式键（如 'antd'）
   * @param hashKey - 用于生成哈希的字符串（通常是样式 ID）
   * @param cssString - CSS 内容
   * @returns 生成的文件名（不包含路径）
   */
  const writeCSSFile = (key: string, hashKey: string, cssString: string) => {
    // 生成文件名：style-antd.a1b2c3d4.css
    const fileName = `style-${key}.${getHash(hashKey)}.css`;

    // 构建完整的输出路径
    const filePath = path.join(api.paths.absOutputPath, fileName);

    // 只在文件不存在时写入（避免重复写入）
    if (!fs.existsSync(filePath)) {
      api.logger.event(chalk.grey(`write to: ${filePath}`));
      fs.writeFileSync(filePath, cssString, 'utf8');
    }

    return fileName;
  };

  // ==========================================================================
  // 工具函数：在 HTML 中添加样式链接
  // ==========================================================================
  /**
   * 在 HTML <head> 中注入 <link> 标签引入 CSS 文件
   *
   * 注入位置：
   * - prepend=true: 插入到 <head> 开始处（高优先级）
   * - prepend=false: 插入到 </head> 前面（默认）
   *
   * @param html - 原始 HTML 字符串
   * @param cssFile - CSS 文件名
   * @param prepend - 是否插入到开头
   * @returns 修改后的 HTML
   */
  const addLinkStyle = (html: string, cssFile: string, prepend = false) => {
    // 获取 publicPath（资源路径前缀）
    // 例如：部署到 CDN 时，publicPath 可能是 'https://cdn.example.com/assets/'
    const prefix = api.userConfig.publicPath || api.config.publicPath;

    if (prepend) {
      // 插入到 <head> 开始处
      return html.replace('<head>', `<head><link rel="stylesheet" href="${prefix + cssFile}">`);
    }

    // 插入到 </head> 前面
    return html.replace('</head>', `<link rel="stylesheet" href="${prefix + cssFile}"></head>`);
  };

  // ==========================================================================
  // 1️⃣ 注册扩展的 React Tech Stack
  // ==========================================================================
  /**
   * 注册自定义的技术栈
   *
   * 作用：
   * - 替换 Dumi 默认的 ReactTechStack
   * - 使用我们扩展的 AntdReactTechStack
   * - 所有 React 代码示例都会使用这个技术栈处理
   */
  api.registerTechStack(() => new AntdReactTechStack());

  // ==========================================================================
  // 2️⃣ 修改路由配置
  // ==========================================================================
  /**
   * 添加额外的路由（Changelog 页面）
   *
   * 背景：
   * - Changelog 文件位于 monorepo 根目录（../../../../CHANGELOG.*.md）
   * - 不在 Dumi 默认扫描的文档目录中
   * - 需要手动添加路由
   *
   * 路由配置说明：
   * - id: 路由唯一标识
   * - path: URL 路径
   * - absPath: 绝对路径（用于生成导航）
   * - parentId: 父级布局 ID（'DocLayout' 表示使用文档布局）
   * - file: Markdown 文件的绝对路径
   */
  api.modifyRoutes((routes) => {
    const extraRoutesList: IRoute[] = [
      {
        id: 'changelog-cn',
        path: 'changelog-cn',
        absPath: '/changelog-cn',
        parentId: 'DocLayout',
        file: resolve('../../../../CHANGELOG.zh-CN.md'), // 解析为绝对路径
      },
      {
        id: 'changelog',
        path: 'changelog',
        absPath: '/changelog',
        parentId: 'DocLayout',
        file: resolve('../../../../CHANGELOG.en-US.md'),
      },
    ];

    // 将额外路由合并到现有路由中
    extraRoutesList.forEach((itemRoute) => {
      routes[itemRoute.path] = itemRoute;
    });

    return routes;
  });

  // ==========================================================================
  // 3️⃣ 修改导出的 HTML 文件（SSR 样式优化）
  // ==========================================================================
  /**
   * 处理构建后的 HTML 文件
   *
   * 流程：
   * 1. 过滤掉动态路由（包含 :id 的路径，避免部署失败）
   * 2. 从 HTML 中提取 Emotion 样式
   * 3. 将样式写入独立的 CSS 文件
   * 4. 在 HTML 中注入 <link> 标签引入 CSS
   *
   * 为什么要这样做？
   * - Emotion 默认在运行时注入样式（客户端渲染）
   * - SSR 时，样式在服务端生成，但不会自动提取
   * - 如果不提取，首屏会出现样式闪烁（FOUC - Flash of Unstyled Content）
   * - 提取后，样式在 HTML 加载时立即可用，避免闪烁
   *
   * 优势：
   * - 首屏渲染更快（无需等待 JS 执行）
   * - 更好的 SEO（搜索引擎可以看到完整样式）
   * - 更好的用户体验（无样式闪烁）
   */
  api.modifyExportHTMLFiles((files) =>
    files
      // 排除动态路由（如 /components/:id），避免生成 :id 目录导致部署失败
      .filter((f) => !f.path.includes(':'))
      .map((file) => {
        // ====================================================================
        // Step 1: 提取 Emotion 样式
        // ====================================================================
        const styles = extractEmotionStyle(file.content);

        // ====================================================================
        // Step 2: 为每个样式生成独立的 CSS 文件
        // ====================================================================
        styles.forEach((result) => {
          // 日志输出：哪个页面包含了哪些样式
          // 例如：/components/bubble 包含 [antd] 12 个样式
          api.logger.event(
            `${chalk.yellow(file.path)} include ${chalk.blue`[${result!.key}]`} ${chalk.yellow(
              result!.ids.length,
            )} styles`,
          );

          // 写入 CSS 文件
          // hashKey 使用 ids 连接，确保样式变化时哈希变化
          const cssFile = writeCSSFile(result!.key, result!.ids.join(''), result!.css);

          // ====================================================================
          // Step 3: 在 HTML 中添加 <link> 标签
          // ====================================================================
          file.content = addLinkStyle(file.content, cssFile);
        });

        return file;
      }),
  );

  // ==========================================================================
  // 4️⃣ 修改配置（预留）
  // ==========================================================================
  /**
   * 修改 Dumi 配置
   *
   * 这里预留了添加全局样式的逻辑
   * styles: 全局样式文件路径列表
   *
   * 注意：当前代码已注释，如需添加全局样式可以取消注释
   */
  api.modifyConfig((memo) => {
    memo.styles ??= [];
    // 示例：添加 SSR CSS 文件
    // memo.styles.push(`/${ssrCssFileName}`);

    return memo;
  });
};

export default RoutesPlugin;
