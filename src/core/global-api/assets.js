/* @flow */

import config from '../config'
/*
ASSET_TYPES = [
  'component',
  'directive',
  'filter'
]
*/
import { ASSET_TYPES } from 'shared/constants'
import { warn, isPlainObject } from '../util/index'

// 注册资源
export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  // type 为 'component'、'directive'、'filter'
  ASSET_TYPES.forEach(type => {
	// 对 definition 进行修正，最后返回 definition
    Vue[type] = function (id: string, definition: Function | Object): Function | Object | void {
      // 只有一个实参就是获取注册的组件，例如 Vue.component('my-component') -> Vue.options['components']['my-component']
	  if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production') {
		  // 如果 type 是 'component'，则 id 不能是保留标签名
          if (type === 'component' && config.isReservedTag(id)) {
            warn(
              'Do not use built-in or reserved HTML elements as component ' +
              'id: ' + id
            )
          }
        }
		// Vue['component'](id, definition) 其中 definition 为普通对象，修正 definition
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
		  // 生成新的子组件
          definition = this.options._base.extend(definition)
        }
		// Vue['directive'](id, definition) 其中 definition 为函数，修正 definition 为对象
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
		// eg: this.options['components'][id] = definition 注册子组件（指令，过滤器）
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
