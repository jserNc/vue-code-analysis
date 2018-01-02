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

// ע����Դ
export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  // type Ϊ 'component'��'directive'��'filter'
  ASSET_TYPES.forEach(type => {
	// �� definition ������������󷵻� definition
    Vue[type] = function (id: string, definition: Function | Object): Function | Object | void {
      // ֻ��һ��ʵ�ξ��ǻ�ȡע������������ Vue.component('my-component') -> Vue.options['components']['my-component']
	  if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production') {
		  // ��� type �� 'component'���� id �����Ǳ�����ǩ��
          if (type === 'component' && config.isReservedTag(id)) {
            warn(
              'Do not use built-in or reserved HTML elements as component ' +
              'id: ' + id
            )
          }
        }
		// Vue['component'](id, definition) ���� definition Ϊ��ͨ�������� definition
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
		  // �����µ������
          definition = this.options._base.extend(definition)
        }
		// Vue['directive'](id, definition) ���� definition Ϊ���������� definition Ϊ����
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
		// eg: this.options['components'][id] = definition ע���������ָ���������
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
