/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'

/*
	�������:
  builtInComponents :{
	  KeepAlive
	}

	���� KeepAlive : {
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

/*
Vue ���󣨹��캯����ӵ����������/������
declare interface GlobalAPI {
  cid: number;
  options: Object;
  config: Config;
  util: Object;

  // ��������
  extend: (options: Object) => Function;
  set: <T>(target: Object | Array<T>, key: string | number, value: T) => T;
  delete: <T>(target: Object| Array<T>, key: string | number) => void;
  nextTick: (fn: Function, context?: Object) => void | Promise<*>;
  use: (plugin: Function | Object) => void;
  mixin: (mixin: Object) => void;
  compile: (template: string) => { render: Function, staticRenderFns: Array<Function> };

  // ע��/��ȡ��Դ
  directive: (id: string, def?: Function | Object) => Function | Object | void;
  component: (id: string, def?: Class<Component> | Object) => Class<Component>;
  filter: (id: string, def?: Function) => Function | void;

  // �Զ��巽��
  [key: string]: any
};
*/
// ��ʼ��ȫ�� api��Ҳ���ǽ�һЩȫ�ַ���/���Թ��ص� Vue ��
export function initGlobalAPI (Vue: GlobalAPI) {
  // Vue.config ��������������
  const configDef = {}

   /*
     Vue.config ��һ�����󣬰��� Vue ��ȫ������

     ֮ǰ������һ��ȫ�ֵ� config ���󣬰��� silent��optionMergeStrategies��devtools��mustUseProp��isReservedTag��isReservedAttr ... ������/����

     ���������ȫ�� config �ĺܶ෽������û�о��嶨��ģ�һ���ǿշ�����
    
     �����൱�ڶ��壺Vue.config = config����ȡ Vue.config �ͻ᷵��֮ǰ������Ǹ�ȫ�ֵ� config ����

     �����ֶ�����������䣺

     Vue$3.config.mustUseProp = mustUseProp;
     Vue$3.config.isReservedTag = isReservedTag;
     Vue$3.config.isReservedAttr = isReservedAttr;
     Vue$3.config.getTagNamespace = getTagNamespace;
     Vue$3.config.isUnknownElement = isUnknownElement;

     Ҳ����˵��������һЩ���������õĺ�����������֮ǰ config ��Ĭ��ֵ
   */
  configDef.get = () => config

  // ������������£��ͻᶨ�� configDef.set ����
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      // ���棺��׼�滻 Vue.config ����
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
  // �첽ִ�к���
  Vue.nextTick = nextTick

  Vue.options = Object.create(null)
  /*
  	�����൱�ڣ�
  	Vue.options['components'] = {};
  	Vue.options['directives'] = {};
  	Vue.options['filters'] = {};
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
