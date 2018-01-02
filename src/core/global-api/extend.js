/* @flow */

/*
	ASSET_TYPES = [
	  'component',
	  'directive',
	  'filter'
	]
*/
import { ASSET_TYPES } from 'shared/constants'
// mergeOptions (parent, child, vm) �ϲ����� options ����
import { warn, extend, mergeOptions } from '../util/index'
// defineComputed (target, key, userDef) �Դ���ʽ�� target ������� key ����
// proxy (target, sourceKey, key) �� target ���������� key���� target[sourceKey][key] ���� target[key] 
import { defineComputed, proxy } from '../instance/state'

// ���� Vue.extend ����
export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  // ÿ�����캯����Ψһ�� cid
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  // ���캯���̳�
  Vue.extend = function (extendOptions: Object): Function {
	// ��� extendOptions Ϊ�٣���ʼ��Ϊ {}
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
	// ����Ĺ��캯��
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
	
	// ȡ���棬Ҳ����˵ͬ���ĸ��ࡢͬ�������ã��ͻ��߻���������ͬ�����ࡣ
    if (cachedCtors[SuperId]) {
	  // ���ػ��������
      return cachedCtors[SuperId]
    }

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

	// ���๹�캯��
    const Sub = function VueComponent (options) {
      this._init(options)
    }
	// �����ԭ��ָ�����ԭ��
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
	
	// ����Ҳ���Լ��� cid
    Sub.cid = cid++
	// �ϲ�����ѡ��� extendOptions
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
	// ��Ǹ���
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
	  // ���� Sub.prototype[key] ���ԣ����� key Ϊ Sub.options.props ����������
      initProps(Sub)
    }
    if (Sub.options.computed) {
	  // ���� Sub.prototype[key] ���ԣ����� key Ϊ Sub.options.computed ����������
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
	// �����ø���� extend��mixin��use ����
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
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
	// ����
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

// ���� Comp.prototype[key]
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

// ���� Comp.prototype[key]
function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
	// ������ Comp.prototype ��� key ���ԣ������������
    defineComputed(Comp.prototype, key, computed[key])
  }
}
