/* @flow */

/*
	ASSET_TYPES = [
	  'component',
	  'directive',
	  'filter'
	]
*/
import { ASSET_TYPES } from 'shared/constants'
// mergeOptions (parent, child, vm) 合并两个 options 对象
import { warn, extend, mergeOptions } from '../util/index'
// defineComputed (target, key, userDef) 以代理方式给 target 对象添加 key 属性
// proxy (target, sourceKey, key) 给 target 对象定义属性 key，用 target[sourceKey][key] 代理 target[key] 
import { defineComputed, proxy } from '../instance/state'

// 挂载 Vue.extend 方法
export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  // 每个改造函数有唯一的 cid
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  // 构造函数继承
  Vue.extend = function (extendOptions: Object): Function {
	// 如果 extendOptions 为假，初始化为 {}
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
	// 缓存的构造函数
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
	
	// 取缓存，也就是说同样的父类、同样的配置，就会走缓存生成相同的子类。
    if (cachedCtors[SuperId]) {
	  // 返回缓存的子类
      return cachedCtors[SuperId]
    }

    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production') {
      if (!/^[a-zA-Z][\w-]*$/.test(name)) {
		// 有效的组件名之内包含字母数字和连字符，并且要以字母开头
        warn(
          'Invalid component name: "' + name + '". Component names ' +
          'can only contain alphanumeric characters and the hyphen, ' +
          'and must start with a letter.'
        )
      }
    }

	// 子类构造函数
    const Sub = function VueComponent (options) {
      this._init(options)
    }
	// 子类的原型指向父类的原型
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
	
	// 子类也有自己的 cid
    Sub.cid = cid++
	// 合并父类选项和 extendOptions
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
	// 标记父类
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
	  // 代理 Sub.prototype[key] 属性，其中 key 为 Sub.options.props 中所有属性
      initProps(Sub)
    }
    if (Sub.options.computed) {
	  // 代理 Sub.prototype[key] 属性，其中 key 为 Sub.options.computed 中所有属性
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
	// 子类获得父类的 extend、mixin、use 方法
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
	// 子类获取父类的 component、directive、filter 方法
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
	// 允许递归查找自己
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
	// 保存对 super 和当前的 options 的引用，实例化的时候用于检查 options 是否更新了
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
	// 缓存
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

// 代理 Comp.prototype[key]
function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
	/*
		① Comp.prototype[key] 实际执行函数 function() { return Comp.prototype._props[key] }
		② Comp.prototype[key] = val 实际执行函数 function() { Comp.prototype._props[key] = val }
    */
    proxy(Comp.prototype, `_props`, key)
  }
}

// 代理 Comp.prototype[key]
function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
	// 给对象 Comp.prototype 添加 key 属性，并代理该属性
    defineComputed(Comp.prototype, key, computed[key])
  }
}
