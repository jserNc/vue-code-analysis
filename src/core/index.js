import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'

// ��ʼ��ȫ�� api��Ҳ���ǽ�һЩȫ�ַ������ص� Vue$3 ��
initGlobalAPI(Vue)

// ��ȡ vm.$isServer ʱ��ִ�� isServerRendering ��������־��ǰ Vue ʵ���Ƿ������ڷ�����
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
