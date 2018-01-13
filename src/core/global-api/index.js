/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'

/*
	内置组件:
  builtInComponents :{
	  KeepAlive
	}

	其中 KeepAlive : {
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
Vue 对象（构造函数）拥有以下属性/方法：
declare interface GlobalAPI {
  cid: number;
  options: Object;
  config: Config;
  util: Object;

  // 公共方法
  extend: (options: Object) => Function;
  set: <T>(target: Object | Array<T>, key: string | number, value: T) => T;
  delete: <T>(target: Object| Array<T>, key: string | number) => void;
  nextTick: (fn: Function, context?: Object) => void | Promise<*>;
  use: (plugin: Function | Object) => void;
  mixin: (mixin: Object) => void;
  compile: (template: string) => { render: Function, staticRenderFns: Array<Function> };

  // 注册/获取资源
  directive: (id: string, def?: Function | Object) => Function | Object | void;
  component: (id: string, def?: Class<Component> | Object) => Class<Component>;
  filter: (id: string, def?: Function) => Function | void;

  // 自定义方法
  [key: string]: any
};
*/
// 初始化全局 api，也就是将一些全局方法/属性挂载到 Vue 下
export function initGlobalAPI (Vue: GlobalAPI) {
  // Vue.config 的属性描述对象
  const configDef = {}

   /*
     Vue.config 是一个对象，包含 Vue 的全局配置

     之前定义了一个全局的 config 对象，包含 silent、optionMergeStrategies、devtools、mustUseProp、isReservedTag、isReservedAttr ... 等属性/方法

     不过，这个全局 config 的很多方法都是没有具体定义的，一般是空方法。
    
     这里相当于定义：Vue.config = config（获取 Vue.config 就会返回之前定义的那个全局的 config 对象）

     后面又定义了以下语句：

     Vue$3.config.mustUseProp = mustUseProp;
     Vue$3.config.isReservedTag = isReservedTag;
     Vue$3.config.isReservedAttr = isReservedAttr;
     Vue$3.config.getTagNamespace = getTagNamespace;
     Vue$3.config.isUnknownElement = isUnknownElement;

     也就是说，定义了一些真正有作用的函数，覆盖了之前 config 的默认值
   */
  configDef.get = () => config

  // 如果开发环境下，就会定义 configDef.set 函数
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      // 警告：不准替换 Vue.config 对象
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
  // 异步执行函数
  Vue.nextTick = nextTick

  Vue.options = Object.create(null)
  /*
  	以下相当于：
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
