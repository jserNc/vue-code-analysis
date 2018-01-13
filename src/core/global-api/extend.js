/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { warn, extend, mergeOptions } from '../util/index'
import { defineComputed, proxy } from '../instance/state'

// 定义静态方法 Vue.extend
export function initExtend (Vue: GlobalAPI) {

  // 每个实例构造函数（包括 Vue）都有一个唯一的 cid。
  Vue.cid = 0
  let cid = 1

  /*
    该方法的作用是使用基础 Vue 构造器，创建一个“子类”（组件的构造函数）。参数是一个包含组件选项的对象。
    其中，data 选项是特例，它必须是函数。

    eg：<div id="mount-point"></div>

    // 创建构造器
    var Profile = Vue.extend({
      template: '<p>{{firstName}} {{lastName}} aka {{alias}}</p>',
      data: function () {
        return {
          firstName: 'Walter',
          lastName: 'White',
          alias: 'Heisenberg'
        }
      }
    })
    // 创建 Profile 实例，并挂载到一个元素上。
    new Profile().$mount('#mount-point')
  */
  // 构造函数继承。返回一个新的构造函数 Sub。可以理解为返回一个组件的构造函数。
  Vue.extend = function (extendOptions: Object): Function {

    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
    /*
      对于同一个配置对象 extendOptions，每给一个父类 Super，就能生成对应的子类 Sub，把这种对应关系缓存下来
      cachedCtors 为缓存的 ”父类 cid - 子类“ 集合，结构为：
      {
        SuperId1 ： Sub1,
        SuperId2 ： Sub2,
        ...
      }
     */
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
	
    // 如果能从缓存取到子类，就省去了下面的所有步骤
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    // 检查组件名
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

    // 定义新的子类构造函数
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 子类继承父类原型，并修正 constructor 属性指向
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
	
    // 每个类都有唯一的 cid
    Sub.cid = cid++
    // 根据合并策略，合并 options
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )

    // super 属性指向父类
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    
    /* 直接在原型做处理，可以避免每次实例创建过程中调用 Object.defineProperty */
    
    if (Sub.options.props) {
      // Sub.prototype 原型上代理 prop
      initProps(Sub)
    }
    if (Sub.options.computed) {
      // Sub.prototype 原型上定义计算属性
      initComputed(Sub)
    }

    // 获取父类的 extend、mixin 和 use 方法
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes can have their private assets too.
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
    // 缓存父子关系
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

/*
  对于构造函数 Comp，新建实例：
  var vm = new Comp();
  
  那么用 vm[prop] 代理 vm['_props'][prop]
 */
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

// 劫持计算属性
function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
	  /*
      以 computed[key] 是函数为例：

      defineComputed(Comp.prototype, key, computed[key])
      相当于：Object.defineProperty(target, key, sharedPropertyDefinition);
      其中：sharedPropertyDefinition = {
        enumerable: true,
        configurable: true,
        get: noop,
        set: createComputedGetter(key)
      }
      也就是说 Comp.prototype[key] 属性被劫持了

      例如 var vm = new Vue({
        el: '#example',
        data: {
          message: 'Hello'
        },
        computed: {
          reversedMessage: function () {
            return this.message.split('').reverse().join('')
          }
        }
      })
      console.log(vm.reversedMessage) // => 'olleH'
      vm.message = 'Goodbye'
      console.log(vm.reversedMessage) // => 'eybdooG'

      vm.reversedMessage 执行的是 createComputedGetter('reversedMessage') 方法
      然后触发 vm._computedWatchers['reversedMessage'].evaluate()，也就是触发计算属性 reversedMessage 重新计算
   
      总结一下，defineComputed (vm, key, userDef) 的作用是：
      定义计算属性 key。将计算属性 key 直接挂在到 vm 对象上，vm[key] 会触发计算属性重算
   */
    defineComputed(Comp.prototype, key, computed[key])
  }
}
