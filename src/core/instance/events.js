/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

// ��ʼ���¼�
export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  
  // �����־Ĭ��Ϊ false���������������¼�ʱ�Ὣ����Ϊ true
  vm._hasHookEvent = false

  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: Component

// ����¼���
function add (event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

// ����¼���
function remove (event, fn) {
  target.$off(event, fn)
}

// �����¼���
export function updateComponentListeners (vm: Component, listeners: Object, oldListeners: ?Object ) {
  // target ����Ϊ��ǰ vm
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
}

// ��� Vue.prototype.$on��Vue.prototype.$once��Vue.prototype.$off��Vue.prototype.$emit �ȷ���
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  // ���¼�
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
	  // ������ fn ��ӵ����� vm._events[event] ��
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
	  // event �� hook ��ͷ
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  // ���¼�������ִ��һ�κ󣬵��ý��
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
	  // ���
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
	// ��
    vm.$on(event, on)
    return vm
  }

  // ���
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all��û��ʵ�Σ���������¼�
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events��event ��һ�����飬�ݹ���ñ�������һ�������
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
	// ���ĳһ�����¼���Ӧ�����м�������
    if (arguments.length === 1) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
	  // cb === fn ��Ӧ $on �����󶨵ģ�cb.fn === fn ��Ӧ $once �����󶨵�
      if (cb === fn || cb.fn === fn) {
		// ɾ��ĳһ�����¼���ĳһ�����������
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  // �����¼�
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
	  // ����һ��ʵ�� event �ų�����ʣ�µĲ����������ص������õ�ʵ��
      const args = toArray(arguments, 1)
	  // ����ִ�� vm._events[event] �����еĻص�������Ҳ����˵ִ�� event ���͵����лص�����
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
	      // �ص�����ִ��ʱ��ʵ�� args �ǳ��˲��� event �������������
          cbs[i].apply(vm, args)
        } catch (e) {
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}
