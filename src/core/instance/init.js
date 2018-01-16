/* @flow */

// ȫ�����ö���
import config from '../config'
// ��ʼ�� vm._renderProxy ����
import { initProxy } from './proxy'
// ��ʼ�� props��methods��data��computed��watch
import { initState } from './state'
// ��ʼ�� vm._vnode��vm._staticTrees��vm.$vnode��vm.$slots��vm.$scopedSlots��vm._c��vm.$createElement��vm.$attrs��vm.$listeners ������
import { initRender } from './render'
// ��ʼ�� vm._events��vm._hasHookEvent���������¼�����
import { initEvents } from './events'
// mark ���ǩ��measure ���ʱ
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
/*
  extend (to,_from) �� _from ��������Ը��� to ���������
  mergeOptions (parent,child,vm) �ϲ� options ����

  formatComponentName �����������Ǹ�ʽ���������
  a. �����'aaa-bbb' -> "<AaaBbb>"
  b. ���û�������������������"<Anonymous>"
  c. �����Ҫ�������Ը����ļ��� "<AaaBbb> at aaa-bbb.vue"
*/
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

// ��ʼ�����룬���� Vue.prototype._init ����
export function initMixin (Vue: Class<Component>) {
  // ���� Vue ���캯����Ψһ���õķ��������һϵ�г�ʼ������
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid��ÿ��ʵ�� vm �� _uid ��Ψһ��
    vm._uid = uid++

    let startTag, endTag
    // ��ǳ�ʼ����ʼ
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-init:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    // ��־��ǰ������ Vue ʵ�������������־�Ͳ��ᱻ observe ��
    vm._isVue = true

    // �� vm.$options ��ֵ
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // ֱ�Ӹ� vm.$options ������ԡ��Ż��ڲ����ʵ���������ڶ�̬ѡ��ϲ��൱��������û��һ���ڲ������ѡ����Ҫ���⴦��
      initInternalComponent(vm, options)
    } else {
      // �ϲ����캯���� options �Ͳ��� options
      vm.$options = mergeOptions(
        // �ϲ������캯���͵�ǰ���캯���� options
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }


    // ��ʼ�� vm._renderProxy
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }

    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`${vm._name} init`, startTag, endTag)
    }

    // �� vm ���ص���ʵ dom ��
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// �� vm.$options �������
function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  // vm.$options �̳й��캯���� options���� vm.constructor.options ����������
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  // vm.$options ���μ̳� options ���ڲ�����������
  opts.parent = options.parent
  opts.propsData = options.propsData
  opts._parentVnode = options._parentVnode
  opts._parentListeners = options._parentListeners
  opts._renderChildren = options._renderChildren
  opts._componentTag = options._componentTag
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

/*
    ��һ�� Vue.options��������������� 4 ��ѡ�
    {
        components: {KeepAlive: {��}, Transition: {��}, TransitionGroup: {��}},
        directives: {model: {��}, show: {��}},
        filters: {},
        _base: Vue
    }

    Vue.options = Object.create(null);

    �� Vue.options._base = Vue;

    �� ASSET_TYPES.forEach(function (type) {
        Vue.options[type + 's'] = Object.create(null);
    });
    -> �൱�ڣ�
    Vue.options.components = {};
    Vue.options.directives = {};
    Vue.options.filters = {};

    ���У�Vue.options.components �ᱻ��������޸ģ�

    // ƽ̨������
    var platformComponents = {
        Transition: Transition,
        TransitionGroup: TransitionGroup
    };
    // ͨ���������
    var builtInComponents = {
        KeepAlive: KeepAlive
    };

    extend(Vue$3.options.components, platformComponents);
    extend(Vue.options.components, builtInComponents);

    ���ǣ�
    Vue.options.components = {KeepAlive: {��}, Transition: {��}, TransitionGroup: {��}};

    ���У�Vue.options.directives �ᱻ��������޸ģ�
    var platformDirectives = {
        model: model$1,
        show: show
    };

    extend(Vue$3.options.directives, platformDirectives);

    ���ǣ�
    Vue.options.directives = {model: {��}, show: {��}}
*/

/*
	�� ���๹�캯�����ڣ����ظ����캯��ѡ�� + ��ǰ���캯��ѡ��ϲ���� Ctor.options
	�� ����ֱ�ӷ��ص�ǰ���캯���� options
*/
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  // �����ǰ���캯�� Ctor �и��࣬��ô�� Ctor.options ��������
  if (Ctor.super) {
    // ����� options���� Ctor.super.options
    const superOptions = resolveConstructorOptions(Ctor.super)
    // ����ĸ��� options
    const cachedSuperOptions = Ctor.superOptions
    
    // �������ĸ��� options �����µĲ�һ��������֮
  	if (superOptions !== cachedSuperOptions) {
        // ���»���
        Ctor.superOptions = superOptions
        
        // ����������µ� Ctor.options
        const modifiedOptions = resolveModifiedOptions(Ctor)
        
        // ����������չѡ��
        if (modifiedOptions) {
          // �����޸ĵ�����
          extend(Ctor.extendOptions, modifiedOptions)
        }
        // ����ѡ�� = ����ѡ�� + ������չ��ѡ��
        options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
        if (options.name) {
          // ���캯�����뵽���� options.components ��
          options.components[options.name] = Ctor
        }
    }
  }
  return options
}

// ����������µ� Ctor.options
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  
  // �� Ctor.options ��ÿһ����飩���й��ˣ������µ� Ctor.options
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      // �������� latest[key]��ѡ���������� extended[key] ���������� sealed[key] ��Ԫ��
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }

  return modified
}

/*
  �� latest �����飬�������� latest��ѡ������ extended ������ sealed ��Ԫ��
  �� ����ֱ�ӷ��� latest

  dedupe ����˼����ɾ���ظ�����
*/
function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated between merges
  // �Ƚ� latest �� sealed����ȷ���������ڹ����ںϲ���ʱ�򲻻��ظ�
  if (Array.isArray(latest)) {
    const res = []
    // sealed תΪ����
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    // extended תΪ����
    extended = Array.isArray(extended) ? extended : [extended]
	
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      // ����ԭʼѡ���û�б�������ѡ����ų��ظ�ѡ��
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
