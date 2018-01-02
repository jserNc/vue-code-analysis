/* @flow */

import {
  no,
  noop,
  identity
} from 'shared/util'

import { LIFECYCLE_HOOKS } from 'shared/constants'

// ���� config ��������
export type Config = {
  // user �û�����������
  optionMergeStrategies: { [key: string]: Function };
  silent: boolean;
  productionTip: boolean;
  performance: boolean;
  devtools: boolean;
  errorHandler: ?(err: Error, vm: Component, info: string) => void;
  warnHandler: ?(msg: string, vm: Component, trace: string) => void;
  ignoredElements: Array<string>;
  keyCodes: { [key: string]: number | Array<number> };

  // platform ƽ̨�������
  isReservedTag: (x?: string) => boolean;
  isReservedAttr: (x?: string) => boolean;
  parsePlatformTagName: (x: string) => string;
  isUnknownElement: (x?: string) => boolean;
  getTagNamespace: (x?: string) => string | void;
  mustUseProp: (tag: string, type: ?string, name: string) => boolean;

  // legacy
  _lifecycleHooks: Array<string>;
};

// ���� config ���͵�һ�����ݶ���ȫ�����ã�
export default ({
  /**
   * Option merge strategies (used in core/util/options)
   * �Զ���ϲ�����
   */
  optionMergeStrategies: Object.create(null),

  /**
   * Whether to suppress warnings.
   * �Ƿ��ӡ������־
   */
  silent: false,

  /**
   * Show production mode tip message on boot?
   * �Ƿ������ɻ�����ʾ��ʾ
   */
  productionTip: process.env.NODE_ENV !== 'production',

  /**
   * Whether to enable devtools
   * �Ƿ���õ��Թ���
   */
  devtools: process.env.NODE_ENV !== 'production',

  /**
   * Whether to record perf
   * �Ƿ��¼��������
   */
  performance: false,

  /**
   * Error handler for watcher errors
   * ��������
   */
  errorHandler: null,

  /**
   * Warn handler for watcher warns
   * ���洦����
   */
  warnHandler: null,

  /**
   * Ignore certain custom elements
   * ����ĳЩ�Զ���Ԫ��
   */
  ignoredElements: [],

  /**
   * Custom user key aliases for v-on
   * �� v-on �Զ����λ����
   */
  keyCodes: Object.create(null),

  /**
   * Check if a tag is reserved so that it cannot be registered as a
   * component. This is platform-dependent and may be overwritten.
   * ����ǩ�Ƿ�Ϊ������ǩ���͵�ǰƽ̨�й�ϵ
   */
  isReservedTag: no,

  /**
   * Check if an attribute is reserved so that it cannot be used as a component
   * prop. This is platform-dependent and may be overwritten.
   * ��������Ƿ�Ϊ�������ԣ��͵�ǰƽ̨�й�ϵ
   */
  isReservedAttr: no,

  /**
   * Check if a tag is an unknown element.
   * Platform-dependent.
   * ���Ԫ���Ƿ�Ϊδ֪Ԫ�أ��͵�ǰƽ̨�й�ϵ
   */
  isUnknownElement: no,

  /**
   * Get the namespace of an element
   * ��ȡ��ǩ�������ռ䣬Ҳ�������Ϊ��ȡ��ǩ�����ͣ�html��svg ֮���
   */
  getTagNamespace: noop,

  /**
   * Parse the real tag name for the specific platform.
   * ���ض�ƽ̨�½�����ǩ��
   */
  parsePlatformTagName: identity,

  /**
   * Check if an attribute must be bound using property, e.g. value
   * Platform-dependent.
   */
  mustUseProp: no,

  /**
   * Exposed for legacy reasons
   * ��������
   */
  _lifecycleHooks: LIFECYCLE_HOOKS
}: Config)
