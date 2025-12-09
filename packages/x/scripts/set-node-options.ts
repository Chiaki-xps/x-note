/**
 * Node.js 内存优化启动脚本
 * 该脚本用于在启动项目前，根据系统可用内存动态设置 Node.js 的内存限制，
 * 然后执行传入的命令。主要解决低内存机器上运行大型项目时的 OOM（内存溢出）问题。
 */

// 来自start脚本的启动：tsx ./scripts/set-node-options.ts cross-env PORT=8001 dumi dev
import os from 'os';

// 引入 child_process 模块，用于执行子进程命令
const childProcess = require('child_process');

/**
 * 获取系统总内存（单位：MB）
 *
 * os.totalmem() 返回系统总内存的字节数
 * 除以 1024 * 1024 转换为 MB
 * Math.floor() 向下取整
 */
const totalMemory = Math.floor(os.totalmem() / (1024 * 1024));

/**
 * 内存限制策略
 *
 * 当系统总内存 <= 8GB (8192MB) 时：
 * - 设置 NODE_OPTIONS 环境变量
 * - --max-old-space-size=4096 限制 V8 引擎的老生代堆内存最大为 4GB
 * - 这可以防止 Node.js 进程占用过多内存导致系统卡顿或崩溃
 *
 * 当系统内存 > 8GB 时：
 * - 不做限制，使用 Node.js 默认的内存管理策略
 */
if (totalMemory <= 8192) {
  // setting NODE_OPTIONS
  process.env.NODE_OPTIONS = '--max-old-space-size=4096';
}
// Execute project startup command
/**
 * Q: 为什么是 2 呢？
 *   当你执行 node script.js arg1 arg2 时，Node.js 会自动解析命令行，将参数填充到 process.argv 数组中
 *
 *  process.argv[0] = '/usr/local/bin/node'     // Node.js 可执行文件的绝对路径
 *  process.argv[1] = '/path/to/script.js'      // 当前执行脚本的绝对路径
 *  process.argv[2] = 'arg1'                    // 第一个用户参数
 *  process.argv[3] = 'arg2'
 *
 * 所以 0 1 是默认的，不需要，所以从 2 开始
 */
// 值：[ 'cross-env', 'PORT=8001', 'dumi', 'dev' ]
const args: string[] = process.argv.slice(2);

/**
 * 执行用户传入的命令
 *
 * execSync: 同步执行命令，阻塞当前进程直到子进程完成
 * args.join(' '): 将参数数组合并为命令字符串
 * stdio: 'inherit': 子进程继承父进程的标准输入/输5出/错误流
 *                   这样命令的输出会直接显示在终端中
 */
childProcess.execSync(` ${args.join(' ')}`, { stdio: 'inherit' });
// 最终 子进程中会执行  dumi dev  ← 真正启动开发服务器
