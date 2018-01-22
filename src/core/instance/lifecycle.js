/* @flow */

// ȫ�����ö���
import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { observerState } from '../observer/index'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { warn, noop, remove, handleError, emptyObject, validateProp } from '../util/index'

// ��ǰ�ʵ��
export let activeInstance: any = null
// �Ƿ����ڸ��������
export let isUpdatingChildComponent: boolean = false

// �������ڳ�ʼ��
export function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  let parent = options.parent

  /*
    vm �Ƿǳ�������Ž���ô���飬���� parent

    Ҳ����˵���� vm �ǳ��������û��Ҫ�ҵ��ǳ��������������ǾͲ����� parent
   */  
  if (parent && !options.abstract) {
    // ������ݱ�������������ҵ���һ���ǳ���������������� keep-alive �� transition�����ǳ��������
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    // ��һ���ǳ���������������������� vm
    parent.$children.push(vm)
  }

  // ���ø����
  vm.$parent = parent
  // ���������������и����ȡ���������������� vm �Լ����Ǹ����
  vm.$root = parent ? parent.$root : vm

  // ���������
  vm.$children = []
  // ��������
  vm.$refs = {}

  // ״̬��Ϣ��ʼ��
  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

// ���� Vue.prototype._update��Vue.prototype.$forceUpdate��Vue.prototype.$destroy �� 3 ������
export function lifecycleMixin (Vue: Class<Component>) {
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this

    // �����ǰ����Ѿ����뵽�ĵ��У���ô����֮ǰ���� beforeUpdate ���Ӻ���
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }

    // �������֮ǰ�Ľڵ���Ϣ
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance

    // ��ǵ�ǰ��ڵ�
    activeInstance = vm
    vm._vnode = vnode

    // Vue.prototype.__patch__ is injected in entry points based on the rendering backend used.
    // �� ������Ⱦ�����
    if (!prevVnode) {
      // initial render��û�� prevVnode ���ǵ�һ����Ⱦ
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      // ��ʼ���󣬾Ͳ���Ҫ���������ˡ��ͷ�֮���Է�ֹ������ dom ���������ڴ��С�
      vm.$options._parentElm = vm.$options._refElm = null
    // �� �Ը�������д򲹶�����
    } else {
      vm.$el = vm.__patch__(prevVnode, vnode)
    }

    // ������ϣ��ѻ�ڵ��ǻ�ԭ
    activeInstance = prevActiveInstance

    // update __vue__ reference
    // �ɵ� vm.$el �ͷŶ� __vue__ ��������
    if (prevEl) {
      prevEl.__vue__ = null
    }
    // �µ� vm.$el ��� __vue__ ��������
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }

	
    // if parent is an HOC, update its $el as well
    // ��� parent �Ǹ��߽������˳��������� $el ����
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  // ǿ��������Ⱦ
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    /*
      vm._watcher = new Watcher(vm, updateComponent, noop);
      
      �� vm._watcher.update() ���� vm._watcher.run()
      �� vm._watcher.run() ִ�� value = this.get()������ vm._watcher.get()
      �� ִ�� updateComponent()����ᵼ����ͼ�ٴθ���
     */
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  // ����
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    // ����Ѿ������ٹ����У�ֱ�ӷ���
    if (vm._isBeingDestroyed) {
      return
    }
    // ��������ǰ���Ӻ���
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    const parent = vm.$parent

    // ����������������ٹ����У����� vm ���ǳ���������Ǿͽ� vm �Ӹ������������������Ƴ�
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // �������� vm._watcher ������ dep �Ķ����б����Ƴ�
    if (vm._watcher) {
      vm._watcher.teardown()
    }
	
    // ע�⣬������ vm._watcher�������� vm._watchers�����еĶ����߶�ȡ����ע��
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // frozen object may not have observer.
    // �������� 1
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }

    // call the last hook... �������
    vm._isDestroyed = true

    // invoke destroy hooks on current rendered tree
    // ���� dom ����ɾ���ڵ�
    vm.__patch__(vm._vnode, null)

    // fire destroyed hook
    // �������ٹ��Ӻ���
    callHook(vm, 'destroyed')

    // turn off all instance listeners. 
    // ע�������¼�
    vm.$off()

    // remove __vue__ reference ɾ�� __vue__ ����
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
  }
}

export function mountComponent (vm: Component, el: ?Element, hydrating?: boolean): Component {
  vm.$el = el

  // ��û���Զ������Ⱦ�������Ǿ���Ⱦ������Ϊ createEmptyVNode
  if (!vm.$options.render) {
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      // �� ��ģ�壬û��Ⱦ����
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') || vm.$options.el || el) {
        /*
          �������棺��������ֻ��������ʱ�İ汾������汾��ģ��������ǲ����õġ��ɲ�ȡ�ķ�ʽ�����֣�
          �� ��ģ��Ԥ�������Ⱦ������
          �� �ð���ģ��������İ汾
        */
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      // �� ��û��ģ�壬��û����Ⱦ����
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }

  // �����װǰ���Ӻ���
  callHook(vm, 'beforeMount')

  let updateComponent
  
  /* 
    ��һ������� if-else ����飺
    vnode = vm._render();
    vm._update(vnode, hydrating);

    ���У�vm._render() �����þ�����������ڵ� vnode
   */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      // ������������ڵ��ʱ
      measure(`${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      // ���㽫����ڵ���µ� dom ��ʱ
      measure(`${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }

  vm._watcher = new Watcher(vm, updateComponent, noop)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
   /*
        ע������
        vm.$vnode  ������� vm ��Ӧ�� _parentVnode�������е�ռλ�ڵ�
        vm._vnode  ������� vm ��Ӧ�� vnode�������ĸ�

        ��û�и������������Ϳ�����Ϊ��ǰ vm ����Ѿ����µ� dom ����
    */
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

// ���������
export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: VNode,
  renderChildren: ?Array<VNode>
) {
  // ��־���ڸ��������
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  const hasChildren = !!(
    renderChildren ||               // has new static slots ���µľ�̬ slots
    vm.$options._renderChildren ||  // has old static slots �оɵľ�̬ slots
    parentVnode.data.scopedSlots || // has new scoped slots ���µ������� slots
    vm.$scopedSlots !== emptyObject // has old scoped slots �оɵ������� slots
  )

  // �� ���¸��ڵ�
  vm.$options._parentVnode = parentVnode
  // vm ��Ӧ��ռλ�ڵ�
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    // ���������� parent
    vm._vnode.parent = parentVnode
  }

  // �� �����ӽڵ�
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listensers hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data && parentVnode.data.attrs
  vm.$listeners = listeners

  // �� ���� props
  if (propsData && vm.$options.props) {
    observerState.shouldConvert = false
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      // validateProp() �������������Ч����ֵ
      props[key] = validateProp(key, vm.$options.props, propsData, vm)
    }
    observerState.shouldConvert = true
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // �� ���¼��� listeners
  if (listeners) {
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)
  }

  // resolve slots + force update if has children
  // �� ���²��
  /*
    ����в�� slots
    �� �������
    �� ǿ�Ƹ��� vm ���
   */
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  // ������ϣ���־��������ڸ���״̬
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

// �Ƿ��ڷǻ����
function isInInactiveTree (vm) {
  // �Ӹ�Ԫ�ؿ�ʼ���α�������ʵ����ֻҪ��һ������ʵ��ӵ�� _Inactive ���ԣ�ʧЧ״̬�����ͷ��� true
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

// ���������
export function activateChildComponent (vm: Component, direct?: boolean) {
  // �� vm._directInactive ��Ϊ false����־����
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }

  // �� vm._inactive ��Ϊ false����־����
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      // �ݹ�ʹ���������
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

// ʹ�����ʧЧ
export function deactivateChildComponent (vm: Component, direct?: boolean) {
  // �� vm._directInactive ��Ϊ true����־ʧЧ
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  // �� vm._inactive ��Ϊ true����־ʧЧ
  if (!vm._inactive) {
    vm._inactive = true
    // �ݹ�ʹ�����ʧЧ
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

/*
    ���磬�������Ĺ������� 'beforeUpdate'����֮ǰ���ǻ��������¼� 'hook:beforeUpdate'
    ��ô��callHook(vm,'evtA') �ᵼ�£�
    �� ִ�й��� 'beforeUpdate' �����лص�����
    �� ִ���¼� 'hook:beforeUpdate' �����лص�����
*/
export function callHook (vm: Component, hook: string) {
  const handlers = vm.$options[hook]
  // �� ִ�й��� hook ��Ӧ�����лص�����
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      try {
        handlers[i].call(vm)
      } catch (e) {
        handleError(e, vm, `${hook} hook`)
      }
    }
  }
  // �� ִ�й��Ӷ�Ӧ���¼� 'hook:' + hook �����лص�����
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
}
