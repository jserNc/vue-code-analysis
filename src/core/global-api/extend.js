/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { warn, extend, mergeOptions } from '../util/index'
import { defineComputed, proxy } from '../instance/state'

// ���徲̬���� Vue.extend
export function initExtend (Vue: GlobalAPI) {

  // ÿ��ʵ�����캯�������� Vue������һ��Ψһ�� cid��
  Vue.cid = 0
  let cid = 1

  /*
    �÷�����������ʹ�û��� Vue ������������һ�������ࡱ������Ĺ��캯������������һ���������ѡ��Ķ���
    ���У�data ѡ�����������������Ǻ�����

    eg��<div id="mount-point"></div>

    // ����������
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
    // ���� Profile ʵ���������ص�һ��Ԫ���ϡ�
    new Profile().$mount('#mount-point')
  */
  // ���캯���̳С�����һ���µĹ��캯�� Sub���������Ϊ����һ������Ĺ��캯����
  Vue.extend = function (extendOptions: Object): Function {

    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
    /*
      ����ͬһ�����ö��� extendOptions��ÿ��һ������ Super���������ɶ�Ӧ������ Sub�������ֶ�Ӧ��ϵ��������
      cachedCtors Ϊ����� ������ cid - ���ࡰ ���ϣ��ṹΪ��
      {
        SuperId1 �� Sub1,
        SuperId2 �� Sub2,
        ...
      }
     */
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
	
    // ����ܴӻ���ȡ�����࣬��ʡȥ����������в���
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    // ��������
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production') {
      if (!/^[a-zA-Z][\w-]*$/.test(name)) {
        // ��Ч�������֮�ڰ�����ĸ���ֺ����ַ�������Ҫ����ĸ��ͷ
        warn(
          'Invalid component name: "' + name + '". Component names ' +
          'can only contain alphanumeric characters and the hyphen, ' +
          'and must start with a letter.'
        )
      }
    }

    // �����µ����๹�캯��
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // ����̳и���ԭ�ͣ������� constructor ����ָ��
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
	
    // ÿ���඼��Ψһ�� cid
    Sub.cid = cid++
    // ���ݺϲ����ԣ��ϲ� options
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )

    // super ����ָ����
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    
    /* ֱ����ԭ�����������Ա���ÿ��ʵ�����������е��� Object.defineProperty */
    
    if (Sub.options.props) {
      // Sub.prototype ԭ���ϴ��� prop
      initProps(Sub)
    }
    if (Sub.options.computed) {
      // Sub.prototype ԭ���϶����������
      initComputed(Sub)
    }

    // ��ȡ����� extend��mixin �� use ����
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes can have their private assets too.
    // �����ȡ����� component��directive��filter ����
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })

    // enable recursive self-lookup
    // ����ݹ�����Լ�
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    // ����� super �͵�ǰ�� options �����ã�ʵ������ʱ�����ڼ�� options �Ƿ������
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    // ���游�ӹ�ϵ
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

/*
  ���ڹ��캯�� Comp���½�ʵ����
  var vm = new Comp();
  
  ��ô�� vm[prop] ���� vm['_props'][prop]
 */
function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
	/*
		�� Comp.prototype[key] ʵ��ִ�к��� function() { return Comp.prototype._props[key] }
		�� Comp.prototype[key] = val ʵ��ִ�к��� function() { Comp.prototype._props[key] = val }
    */
    proxy(Comp.prototype, `_props`, key)
  }
}

// �ٳּ�������
function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
	  /*
      �� computed[key] �Ǻ���Ϊ����

      defineComputed(Comp.prototype, key, computed[key])
      �൱�ڣ�Object.defineProperty(target, key, sharedPropertyDefinition);
      ���У�sharedPropertyDefinition = {
        enumerable: true,
        configurable: true,
        get: noop,
        set: createComputedGetter(key)
      }
      Ҳ����˵ Comp.prototype[key] ���Ա��ٳ���

      ���� var vm = new Vue({
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

      vm.reversedMessage ִ�е��� createComputedGetter('reversedMessage') ����
      Ȼ�󴥷� vm._computedWatchers['reversedMessage'].evaluate()��Ҳ���Ǵ����������� reversedMessage ���¼���
   
      �ܽ�һ�£�defineComputed (vm, key, userDef) �������ǣ�
      ����������� key������������ key ֱ�ӹ��ڵ� vm �����ϣ�vm[key] �ᴥ��������������
   */
    defineComputed(Comp.prototype, key, computed[key])
  }
}
