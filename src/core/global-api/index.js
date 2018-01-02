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
// 执行该方法，就会定义 Vue.use 方法
import { initUse } from './use'
// 执行该方法，就会定义 Vue.mixin 方法
import { initMixin } from './mixin'
// 执行该方法，就会定义 Vue.extend 方法
import { initExtend } from './extend'
// 执行该方法，就会定义 Vue.component、Vue.directive、Vue.filter 等 3 个方法
import { initAssetRegisters } from './assets'
/*
	set (target, key, val) 方法：给 target 添加 key 属性（值为 val）。若该属性之前不存在，发出变化通知。
	del (target, key) 方法：删除 target 的 key 属性，必要的时候发出变化通知。
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

	其中 KeepAlive 为内置组件: {
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
  // configDef.get 为一个函数，函数返回值为 config 对象。config 对象包含 Vue 的全局配置。包括 silent、optionMergeStrategies、devtools ...
  configDef.get = () => config

  // 如果开发环境下，就会定义 configDef.set 函数
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
	  // 不准替换 Vue.config 对象
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // 这里相当于定义：Vue.config = config（获取 Vue.config 属性，就会返回全局的 config 对象）
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // 以下方法并不作为公共 api
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // Vue.set (target, key, val) 方法：给 target 添加 key 属性（值为 val）。若该属性之前不存在，发出变化通知。
  Vue.set = set
  // Vue.delete (target, key) 方法：删除 target 的 key 属性，必要的时候发出变化通知。
  Vue.delete = del
  Vue.nextTick = nextTick

  Vue.options = Object.create(null)
  /*
	以下相当于：
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

  // 将组件 KeepAlive 加入到 Vue.options.components 中
  extend(Vue.options.components, builtInComponents)

  // 定义 Vue.use 方法
  initUse(Vue)
  // 定义 Vue.mixin 方法
  initMixin(Vue)
  // 定义 Vue.extend 方法
  initExtend(Vue)
  // 定义 Vue.component、Vue.directive、Vue.filter 等 3 个方法
  initAssetRegisters(Vue)
}
