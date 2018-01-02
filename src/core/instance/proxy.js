/* not type checking this file because flow doesn't play well with Proxy */
// ���� flow ���� Proxy �ļ��֧���Բ��ã����Ա��ļ��Ͳ������

// ȫ�����ö���
import config from 'core/config'
import { warn, makeMap } from '../util/index'

let initProxy

// ����������ִ��
if (process.env.NODE_ENV !== 'production') {
  // �ؼ���
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
    'require' // for Webpack/Browserify
  )

  const warnNonPresent = (target, key) => {
	// ʵ��������/���� key δ���壬��������Ⱦ�����б������ˡ�ȷ���������Ե� data ���ԡ�
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
      `referenced during render. Make sure to declare reactive data ` +
      `properties in the data option.`,
      target
    )
  }

  // �Ƿ�ԭ��֧�� Proxy
  const hasProxy = typeof Proxy !== 'undefined' && Proxy.toString().match(/native code/)

  if (hasProxy) {
	// ���õ����η�
    const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta')
	// �� config.keyCodes ��������ֵ��ʱ���������
    config.keyCodes = new Proxy(config.keyCodes, {
      set (target, key, value) {
		// ���õ����η�����дʱ�������棬������д
        if (isBuiltInModifier(key)) {
          warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
          return false
		// �����Ķ��ܳɹ�����
        } else {
          target[key] = value
          return true
        }
      }
    })
  }

  // has(target, propKey)������ propKey in proxy �Ĳ���������һ������ֵ��
  const hasHandler = {
	// �ж� target �����Ƿ������� key
    has (target, key) {
	  // key �� target �Ŀ�ö������
      const has = key in target
	  // key Ϊȫ�ֹؼ��ʻ��� _ ��ͷ
      const isAllowed = allowedGlobals(key) || key.charAt(0) === '_'
	  // �����������������㣬��������
      if (!has && !isAllowed) {
        warnNonPresent(target, key)
      }
	  // key Ϊ target ������ʱ���� true
      return has || !isAllowed
    }
  }
  
  // get(target, propKey, receiver)�����ض������ԵĶ�ȡ������ proxy.foo �� proxy['foo']
  const getHandler = {
	// ���� target ����� key ����
    get (target, key) {
	  // key ���� target �Ŀ�ö������ʱ����������
      if (typeof key === 'string' && !(key in target)) {
        warnNonPresent(target, key)
      }
      return target[key]
    }
  }

  // ���� vm._renderProxy ����
  initProxy = function initProxy (vm) {
	// ԭ��֧�� Proxy
    if (hasProxy) {
      // determine which proxy handler to use
      const options = vm.$options
      const handlers = options.render && options.render._withStripped
		// �������� get ����
        ? getHandler
		// ���� propKey in proxy ����
        : hasHandler
	 
	  // ���� vm ��������Բ���
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
	  // �Լ������Լ���Ҳ���ǲ�����
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
