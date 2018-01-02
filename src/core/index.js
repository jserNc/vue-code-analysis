import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'

initGlobalAPI(Vue)

// ��ȡ vm.$isServer ʱ��ִ�� isServerRendering ��������־�Ƿ��ڷ�������Ⱦ
Object.defineProperty(Vue.prototype, '$isServer', {
  // isServerRendering ��һ������
  get: isServerRendering
})

// ��ȡ vm.$ssrContext ʱ������ vm.$vnode.ssrContext
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    return this.$vnode && this.$vnode.ssrContext
  }
})

// ������ʱ����� build/config.js���Ὣ __VERSION__ �滻Ϊʵ�ʵİ汾�� version = process.env.VERSION || require('../package.json').version
Vue.version = '__VERSION__'

// �������캯�� Vue
export default Vue
