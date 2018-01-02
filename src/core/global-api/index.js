/* @flow */
/*
config: {
  // user
  optionMergeStrategies: { [key: string]: Function };
  silent: boolean;
  productionTip: boolean;
  performance: boolean;
  devtools: boolean;
  errorHandler: ?(err: Error, vm: Component, info: string) => void;
  warnHandler: ?(msg: string, vm: Component, trace: string) => void;
  ignoredElements: Array<string>;
  keyCodes: { [key: string]: number | Array<number> };

  // platform
  isReservedTag: (x?: string) => boolean;
  isReservedAttr: (x?: string) => boolean;
  parsePlatformTagName: (x: string) => string;
  isUnknownElement: (x?: string) => boolean;
  getTagNamespace: (x?: string) => string | void;
  mustUseProp: (tag: string, type: ?string, name: string) => boolean;

  // legacy
  _lifecycleHooks: Array<string>;
}
*/
import config from '../config'
// ִ�и÷������ͻᶨ�� Vue.use ����
import { initUse } from './use'
// ִ�и÷������ͻᶨ�� Vue.mixin ����
import { initMixin } from './mixin'
// ִ�и÷������ͻᶨ�� Vue.extend ����
import { initExtend } from './extend'
// ִ�и÷������ͻᶨ�� Vue.component��Vue.directive��Vue.filter �� 3 ������
import { initAssetRegisters } from './assets'
/*
	set (target, key, val) �������� target ��� key ���ԣ�ֵΪ val������������֮ǰ�����ڣ������仯֪ͨ��
	del (target, key) ������ɾ�� target �� key ���ԣ���Ҫ��ʱ�򷢳��仯֪ͨ��
*/
import { set, del } from '../observer/index'
/*
	ASSET_TYPES = [
	  'component',
	  'directive',
	  'filter'
	]
*/
import { ASSET_TYPES } from 'shared/constants'
/*
	builtInComponents :{
	  KeepAlive
	}

	���� KeepAlive Ϊ�������: {
	  name: 'keep-alive',
	  abstract: true,

	  props: {...},
	  created () {...},
	  destroyed () {...},
	  watch: {...},
	  render () {...}
	}
*/
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  // configDef.get Ϊһ����������������ֵΪ config ����config ������� Vue ��ȫ�����á����� silent��optionMergeStrategies��devtools ...
  configDef.get = () => config

  // ������������£��ͻᶨ�� configDef.set ����
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
	  // ��׼�滻 Vue.config ����
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // �����൱�ڶ��壺Vue.config = config����ȡ Vue.config ���ԣ��ͻ᷵��ȫ�ֵ� config ����
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // ���·���������Ϊ���� api
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // Vue.set (target, key, val) �������� target ��� key ���ԣ�ֵΪ val������������֮ǰ�����ڣ������仯֪ͨ��
  Vue.set = set
  // Vue.delete (target, key) ������ɾ�� target �� key ���ԣ���Ҫ��ʱ�򷢳��仯֪ͨ��
  Vue.delete = del
  Vue.nextTick = nextTick

  Vue.options = Object.create(null)
  /*
	�����൱�ڣ�
	Vue.options['components'] = {};
	Vue.options['directive'] = {};
	Vue.options['filter'] = {};
  */
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  // ����� KeepAlive ���뵽 Vue.options.components ��
  extend(Vue.options.components, builtInComponents)

  // ���� Vue.use ����
  initUse(Vue)
  // ���� Vue.mixin ����
  initMixin(Vue)
  // ���� Vue.extend ����
  initExtend(Vue)
  // ���� Vue.component��Vue.directive��Vue.filter �� 3 ������
  initAssetRegisters(Vue)
}
