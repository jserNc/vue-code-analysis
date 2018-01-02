/* @flow */

import {
  no,
  noop,
  identity
} from 'shared/util'

import { LIFECYCLE_HOOKS } from 'shared/constants'

// 定义 config 数据类型
export type Config = {
  // user 用户可配置属性
  optionMergeStrategies: { [key: string]: Function };
  silent: boolean;
  productionTip: boolean;
  performance: boolean;
  devtools: boolean;
  errorHandler: ?(err: Error, vm: Component, info: string) => void;
  warnHandler: ?(msg: string, vm: Component, trace: string) => void;
  ignoredElements: Array<string>;
  keyCodes: { [key: string]: number | Array<number> };

  // platform 平台相关属性
  isReservedTag: (x?: string) => boolean;
  isReservedAttr: (x?: string) => boolean;
  parsePlatformTagName: (x: string) => string;
  isUnknownElement: (x?: string) => boolean;
  getTagNamespace: (x?: string) => string | void;
  mustUseProp: (tag: string, type: ?string, name: string) => boolean;

  // legacy
  _lifecycleHooks: Array<string>;
};

// 导出 config 类型的一个数据对象（全局配置）
export default ({
  /**
   * Option merge strategies (used in core/util/options)
   * 自定义合并策略
   */
  optionMergeStrategies: Object.create(null),

  /**
   * Whether to suppress warnings.
   * 是否打印警告日志
   */
  silent: false,

  /**
   * Show production mode tip message on boot?
   * 是否在生成环境显示提示
   */
  productionTip: process.env.NODE_ENV !== 'production',

  /**
   * Whether to enable devtools
   * 是否可用调试工具
   */
  devtools: process.env.NODE_ENV !== 'production',

  /**
   * Whether to record perf
   * 是否记录性能数据
   */
  performance: false,

  /**
   * Error handler for watcher errors
   * 错误处理函数
   */
  errorHandler: null,

  /**
   * Warn handler for watcher warns
   * 警告处理函数
   */
  warnHandler: null,

  /**
   * Ignore certain custom elements
   * 忽略某些自定义元素
   */
  ignoredElements: [],

  /**
   * Custom user key aliases for v-on
   * 给 v-on 自定义键位别名
   */
  keyCodes: Object.create(null),

  /**
   * Check if a tag is reserved so that it cannot be registered as a
   * component. This is platform-dependent and may be overwritten.
   * 检查标签是否为保留标签，和当前平台有关系
   */
  isReservedTag: no,

  /**
   * Check if an attribute is reserved so that it cannot be used as a component
   * prop. This is platform-dependent and may be overwritten.
   * 检查属性是否为保留属性，和当前平台有关系
   */
  isReservedAttr: no,

  /**
   * Check if a tag is an unknown element.
   * Platform-dependent.
   * 检查元素是否为未知元素，和当前平台有关系
   */
  isUnknownElement: no,

  /**
   * Get the namespace of an element
   * 获取标签的命名空间，也可以理解为获取标签的类型，html、svg 之类的
   */
  getTagNamespace: noop,

  /**
   * Parse the real tag name for the specific platform.
   * 在特定平台下解析标签名
   */
  parsePlatformTagName: identity,

  /**
   * Check if an attribute must be bound using property, e.g. value
   * Platform-dependent.
   */
  mustUseProp: no,

  /**
   * Exposed for legacy reasons
   * 生命周期
   */
  _lifecycleHooks: LIFECYCLE_HOOKS
}: Config)
