/* @flow */

import config from '../config'
import { ASSET_TYPES } from 'shared/constants'
import { warn, isPlainObject } from '../util/index'

// 定义静态方法 Vue.component、Vue.directive、Vue.filter 即注册组件、指令、过滤器
export function initAssetRegisters (Vue: GlobalAPI) {
  /*
    资源类型：
    ASSET_TYPES = [
      'component',
      'directive',
      'filter'
    ]
    
    用法举例（2 个实参是注册，1 个实参是获取）：

    // 注册指令 my-directive
    Vue.directive('my-directive', {
      bind: function () {},
      inserted: function () {},
      update: function () {},
      componentUpdated: function () {},
      unbind: function () {}
    })

    // 注册指令 my-directive
    Vue.directive('my-directive', function () {
      // 这里将会被 `bind` 和 `update` 调用
    })

    // 获取已注册的指令 my-directive
    var myDirective = Vue.directive('my-directive')
   */
  ASSET_TYPES.forEach(type => {
    // 对 definition 进行修正，最后返回 definition
    Vue[type] = function (id: string, definition: Function | Object): Function | Object | void {
      // ① 只有一个实参就是【获取】已注册的组件，例如 Vue.component('my-component') -> Vue.options['components']['my-component']
      if (!definition) {
          return this.options[type + 's'][id]
      // ② 两个参数，注册新组件
      } else {
        if (process.env.NODE_ENV !== 'production') {
		      // 特殊处理一：若 Vue.component 的参数 id 不能是保留标签名
          if (type === 'component' && config.isReservedTag(id)) {
            warn(
              'Do not use built-in or reserved HTML elements as component ' +
              'id: ' + id
            )
          }
        }

		    // 特殊处理二：若 Vue.component 的参数 definition 为普通对象
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
		      /*
            其中 Vue.options._base = Vue，所以 definition = Vue.extend(definition)，也就是说：
            如果 definition 是普通对象，自动调用 Vue.extend 将它修正为一个组件
            
            所以：Vue.component('my-com', {...})
            实质是：Vue.component('my-com', Vue.extend({...}))
          */
          definition = this.options._base.extend(definition)
        }

		    // 特殊处理三：若 Vue.directive 的参数 definition
        if (type === 'directive' && typeof definition === 'function') {
          /*
            如果 definition 是函数，那就将它修正为对象：
            { bind: definition, update: definition }

            也就是说以下两种写法等价：
            Vue.directive('my-directive', myFunc)
            Vue.directive('my-directive', {
              bind: myFunc,
              update: myFunc
            })
          */
          definition = { bind: definition, update: definition }
        }
        // 注册组件，然后返回。注意 type 后跟 's'
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
