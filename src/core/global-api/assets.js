/* @flow */

import config from '../config'
import { ASSET_TYPES } from 'shared/constants'
import { warn, isPlainObject } from '../util/index'

// ���徲̬���� Vue.component��Vue.directive��Vue.filter ��ע�������ָ�������
export function initAssetRegisters (Vue: GlobalAPI) {
  /*
    ��Դ���ͣ�
    ASSET_TYPES = [
      'component',
      'directive',
      'filter'
    ]
    
    �÷�������2 ��ʵ����ע�ᣬ1 ��ʵ���ǻ�ȡ����

    // ע��ָ�� my-directive
    Vue.directive('my-directive', {
      bind: function () {},
      inserted: function () {},
      update: function () {},
      componentUpdated: function () {},
      unbind: function () {}
    })

    // ע��ָ�� my-directive
    Vue.directive('my-directive', function () {
      // ���ｫ�ᱻ `bind` �� `update` ����
    })

    // ��ȡ��ע���ָ�� my-directive
    var myDirective = Vue.directive('my-directive')
   */
  ASSET_TYPES.forEach(type => {
    // �� definition ������������󷵻� definition
    Vue[type] = function (id: string, definition: Function | Object): Function | Object | void {
      // �� ֻ��һ��ʵ�ξ��ǡ���ȡ����ע������������ Vue.component('my-component') -> Vue.options['components']['my-component']
      if (!definition) {
          return this.options[type + 's'][id]
      // �� ����������ע�������
      } else {
        if (process.env.NODE_ENV !== 'production') {
		      // ���⴦��һ���� Vue.component �Ĳ��� id �����Ǳ�����ǩ��
          if (type === 'component' && config.isReservedTag(id)) {
            warn(
              'Do not use built-in or reserved HTML elements as component ' +
              'id: ' + id
            )
          }
        }

		    // ���⴦������� Vue.component �Ĳ��� definition Ϊ��ͨ����
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
		      /*
            ���� Vue.options._base = Vue������ definition = Vue.extend(definition)��Ҳ����˵��
            ��� definition ����ͨ�����Զ����� Vue.extend ��������Ϊһ�����
            
            ���ԣ�Vue.component('my-com', {...})
            ʵ���ǣ�Vue.component('my-com', Vue.extend({...}))
          */
          definition = this.options._base.extend(definition)
        }

		    // ���⴦�������� Vue.directive �Ĳ��� definition
        if (type === 'directive' && typeof definition === 'function') {
          /*
            ��� definition �Ǻ������Ǿͽ�������Ϊ����
            { bind: definition, update: definition }

            Ҳ����˵��������д���ȼۣ�
            Vue.directive('my-directive', myFunc)
            Vue.directive('my-directive', {
              bind: myFunc,
              update: myFunc
            })
          */
          definition = { bind: definition, update: definition }
        }
        // ע�������Ȼ�󷵻ء�ע�� type ��� 's'
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
