/*

熟悉项目方法：

开源代码，首先找到其主页，对 README.md 文件进行一番查阅，理解一下项目说明，比如：jQuery README，分几部分介绍了下项目:

Contribution Guides: 共享代码的一些规范
Environments in which to use jQuery: 运行环境
What you need to build your own jQuery: 构建环境
How to build your own jQuery: 构建方式
Running the Unit Tests: 运行测试
Building to a different directory: 改变构建目录
Essential Git: 一些git操作


看一个例子，了解双向绑定机制：
出处：https://github.com/bison1994

<div id="app">
  <input type="text" v-model="text">
  {{ text }}
</div>

<script>
  function observe (obj, vm) {
    Object.keys(obj).forEach(function (key) {
      defineReactive(vm, key, obj[key]);
    });
  }

  function defineReactive (obj, key, val) {
    // 一个属性 key 对应一个依赖对象
    var dep = new Dep();

    Object.defineProperty(obj, key, {
      // 获取 key 属性时收集关注它的 watcher
      get: function () {
        // 添加订阅者 watcher 到依赖对象 Dep
        if (Dep.target) dep.addSub(Dep.target);
        return val
      },
      // 更新 key 属性时通知关注它的 watcher
      set: function (newVal) {
        if (newVal === val) return
        val = newVal;
        // 作为发布者发出通知
        dep.notify();
      }
    });
  }

  function nodeToFragment (node, vm) {
    var flag = document.createDocumentFragment();
    var child;

    while (child = node.firstChild) {
      compile(child, vm);
      flag.appendChild(child); // 将子节点劫持到文档片段中
    }

    return flag;
  }

  function compile (node, vm) {
    var reg = /\{\{(.*)\}\}/;
    // 节点类型为元素
    if (node.nodeType === 1) {
      var attr = node.attributes;
      // 解析属性
      for (var i = 0; i < attr.length; i++) {
        if (attr[i].nodeName == 'v-model') {
          // 获取 v-model 绑定的属性名
          var name = attr[i].nodeValue;
          node.addEventListener('input', function (e) {
            // 给 vm[name] 属性赋值，进而触发该属性的 set 方法
            vm[name] = e.target.value;
          });
          // 获取 vm[name] 属性赋值，进而触发该属性的 get 方法
          node.value = vm[name]; 
          node.removeAttribute('v-model');
        }
      };

      new Watcher(vm, node, name, 'input');
    }

    // 节点类型为text
    if (node.nodeType === 3) {
      if (reg.test(node.nodeValue)) {
        var name = RegExp.$1; // 获取匹配到的字符串
        name = name.trim();

        new Watcher(vm, node, name, 'text');
      }
    }
  }

  function Watcher (vm, node, name, nodeType) {
    Dep.target = this;
    this.name = name;
    this.node = node;
    this.vm = vm;
    this.nodeType = nodeType;
    this.update();
    Dep.target = null;
  }

  Watcher.prototype = {
    // 更新 dom
    update: function () {
      this.get();
      if (this.nodeType == 'text') {
        this.node.nodeValue = this.value;
      }
      if (this.nodeType == 'input') {
        this.node.value = this.value;
      }
    },
    // 获取data中的属性值
    get: function () {
      // 触发相应属性的 get 方法
      this.value = this.vm[this.name]; 
    }
  }

  function Dep () {
    this.subs = []
  }

  Dep.prototype = {
    addSub: function(sub) {
      this.subs.push(sub);
    },

    notify: function() {
      this.subs.forEach(function(sub) {
        sub.update();
      });
    }
  };

  function Vue (options) {
    this.data = options.data;
    var data = this.data;

    observe(data, this);

    var id = options.el;
    var dom = nodeToFragment(document.getElementById(id), this);

    // 编译完成后，将 dom 返回到 app 中
    document.getElementById(id).appendChild(dom);
  }

  var vm = new Vue({
    el: 'app',
    data: {
      text: 'hello world'
    }
  });

</script>
 */

/*!
 * Vue.js v2.4.0
 * (c) 2014-2017 Evan You
 * Released under the MIT License.
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Vue = factory());
    /*
     在浏览器环境下：
     typeof exports
     // "undefined"

     typeof define
     // "undefined"

     所以会执行：
     global.Vue = factory()
     相当于：
     window.Vue = factory()
     这里的 factory 就是下面的 this 后面的这个很长很长的方法

     window.Vue 就是这个方法的返回值，拖到这个文件文件最后一行：

     return Vue$3;

     也就是说，Vue 就是这里的 Vue$3 方法！

     (function (global, factory) {
         global.Vue = factory();
     }(this, (function () {
         function Vue$3 (options) {
            // ...
         }
         // ...
         return Vue$3;
     })));

     看一下执行流程：

     (function (global, factory) {
         console.log('给 Vue 赋值');
         global.Vue = factory();
         console.log('Vue 的值: ', Vue);
     }(this, (function () {
         console.log('Vue 定义了吗: ',typeof Vue);
         return 'hello';
     })));

     console.log('最终的 Vue: ', Vue);

     打印结果如下：
     ① 给 Vue 赋值
     ② Vue 定义了吗:  undefined
     ③ Vue 的值:  hello
     ④ 最终的 Vue:  hello

     也就是说，在实参  (function () {
         console.log('Vue 定义了吗: ',typeof Vue);
         return 'hello';
     }) 里是取不到 Vue 的


     既然这样，那下面的出现的那么多 Vue 又是干嘛的呢？

     其实，下面的那么多 Vue，只不过内部函数的形参而已，例如：

     function eventsMixin (Vue) {
         ...
         Vue.prototype.$on = function (event, fn) {}
         ...
     }
    
     // 实参是真正的构造函数 Vue$3
     eventsMixin(Vue$3);
     */
}(this, (function () { 'use strict';

/*  */

// these helpers produces better vm code in JS engines due to their
// explicitness and function inlining
// 值为 undefined 或 null
function isUndef (v) {
  return v === undefined || v === null
}

// 值不为 undefined 且不为 null
function isDef (v) {
  return v !== undefined && v !== null
}

// true
function isTrue (v) {
  return v === true
}

// false
function isFalse (v) {
  return v === false
}

/**
 * Check if value is primitive
 */
 // value 为字符串或者数值
function isPrimitive (value) {
  return typeof value === 'string' || typeof value === 'number'
}

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 */
// obj 是否为除了 null 之外的对象
function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}

var _toString = Object.prototype.toString;

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */
// object 为普通对象（不包括 null）
function isPlainObject (obj) {
  return _toString.call(obj) === '[object Object]'
}

// object 为正则对象
function isRegExp (v) {
  return _toString.call(v) === '[object RegExp]'
}

/**
 * Check if val is a valid array index.
 */
// val 是否可以作为数组索引，'1',1 这种是合法的
function isValidArrayIndex (val) {
  var n = parseFloat(val);
  return n >= 0 && Math.floor(n) === n && isFinite(val)
}

/**
 * Convert a value to a string that is actually rendered.
 */
 /*
 对于 JSON.stringify(value [, replacer] [, space]) 函数：
 第 1 个参数为 value 将要序列化成一个 JSON 字符串的值
 第 2 个参数为 null 时表示对象的所有属性都会被序列化
 第 3 个参数 space 文本在每个级别缩进指定数目的空格
 */
function toString (val) {
  return val == null
    ? ''
    : typeof val === 'object'
      ? JSON.stringify(val, null, 2)
      : String(val)
}

/**
 * Convert a input value to a number for persistence.
 * If the conversion fails, return original string.
 */
// 将 val 转为数值，如果转换后是 NaN，则返回 val
function toNumber (val) {
  var n = parseFloat(val);
  return isNaN(n) ? val : n
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
 /*
 检验字符串是不是在 str 中，参数为 true 表示将参数转为小写后再比较，eg:
 makeMap('aaa,bbb,ccc',true)('aa')  -> undefined
 makeMap('aaa,bbb,ccc',true)('aaa') -> true
 makeMap('aaa,bbb,ccc',true)('AAA') -> true
 */
function makeMap (str,expectsLowerCase) {
  var map = Object.create(null);
  var list = str.split(',');
  for (var i = 0; i < list.length; i++) {
    map[list[i]] = true;
  }
  // expectsLowerCase 为假，需要严格相等；expectsLowerCase 为真会将 val 先转为小写再比较
  return expectsLowerCase
    ? function (val) { return map[val.toLowerCase()]; }
    : function (val) { return map[val]; }
}

/**
 * Check if a tag is a built-in tag.
 */
/*
判断参数是否匹配 slot 或 component（这两种是内置标签名），忽视大小写。
eg:
isBuiltInTag("SLOT")  -> true
isBuiltInTag("component")  -> true
*/
var isBuiltInTag = makeMap('slot,component', true);

/**
 * Check if a attribute is a reserved attribute.
 */
 /*
判断参数是否匹配 key、ref、slot、is 之一。
eg:
isReservedAttribute('key') -> true
isReservedAttribute('KEY') -> undefined
*/
var isReservedAttribute = makeMap('key,ref,slot,is');

/**
 * Remove an item from an array
 */
 // 从数组 arr 中删除元素 item
function remove (arr, item) {
  if (arr.length) {
    var index = arr.indexOf(item);
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

/**
 * Check whether the object has the property.
 */
 // 判断 key 是否为对象 obj 自己的属性
var hasOwnProperty = Object.prototype.hasOwnProperty;
function hasOwn (obj, key) {
  return hasOwnProperty.call(obj, key)
}

/**
 * Create a cached version of a pure function.
 */
// 对函数 fn 的执行结果进行缓存，每次执行 fn 时优先从缓存读取
function cached (fn) {
  var cache = Object.create(null);
  return (function cachedFn (str) {
    var hit = cache[str];
    return hit || (cache[str] = fn(str))
  })
}

/**
 * Camelize a hyphen-delimited string.
 */
// 将连字符分隔的字符串驼峰化，例如：camelize('a-b-c') -> aBC
var camelizeRE = /-(\w)/g;
var camelize = cached(function (str) {
  return str.replace(camelizeRE, function (_, c) { return c ? c.toUpperCase() : ''; })
});

/**
 * Capitalize a string.
 */
// 首字母大写
var capitalize = cached(function (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
});

/**
 * Hyphenate a camelCase string.
 */
// 将驼峰写法转为连字符写法，如 hyphenate('aaBbCc') -> "aa-bb-cc"
var hyphenateRE = /([^-])([A-Z])/g;
var hyphenate = cached(function (str) {
  return str
    .replace(hyphenateRE, '$1-$2')
    .replace(hyphenateRE, '$1-$2')
    .toLowerCase()
    /*
        为什么要调用 2 次 replace 呢？
        ①只调用 1 次 replace，hyphenate ('ABCD') -> "a-bc-d"
        ② 调用 2 次 replace，hyphenate ('ABCD') -> "a-b-c-d"
    */
});

/**
 * Simple bind, faster than native
 */
// 绑定函数 fn 内部的 this 到 ctx 
function bind (fn, ctx) {
  function boundFn (a) {
    var l = arguments.length;
    /*
    (1) l 不为 0 
        ① l 大于 1，fn.apply(ctx, arguments)
        ② l 为 1，fn.call(ctx, a)
    (2) l 为 0
        fn.call(ctx)
    */
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }
  // record original fn length
  // 函数的 length 属性返回形参个数
  boundFn._length = fn.length;
  return boundFn
}

/**
 * Convert an Array-like object to a real Array.
 */
 // 将类数组转成真正数组，并从指定索引截取该数组，例：toArray([0, 1, 2, 3, 4, 5, 6], 2) -> [2, 3, 4, 5, 6]
function toArray (list, start) {
  start = start || 0;
  var i = list.length - start;
  /*
  关于 Array:
  ① 无参数，返回空数组
     new Array() -> []
  ② 一个正整数参数，表示返回新数组的长度
     new Array(2) -> [ undefined x 2 ]
  ③ 一个非正整数参数，则该参数为新数组成员
     new Array('abc') -> ['abc']
  ④ 多个参数，所有参数都是新数组的成员
     new Array(1, 2) -> [1, 2]
  */
  var ret = new Array(i);
  while (i--) {
    ret[i] = list[i + start];
  }
  return ret
}

/**
 * Mix properties into target object.
 */
 // 将对象 _from 的属性依次赋给对象 to
function extend (to, _from) {
  // in 运算符获取一个对象的可枚举属性，包括自身的和继承的可枚举属性
  for (var key in _from) {
    to[key] = _from[key];
  }
  return to
}

/**
 * Merge an Array of Objects into a single Object.
 */
 /*
 将一组对象合并成一个对象，eg:
 arr = [
    { book : 'js' },
    { edition : 3 },
    { author : 'nanc' }
 ];
 toObject(arr) 
 -> { book: "js", edition: 3, author: "nanc" }
 */
function toObject (arr) {
  var res = {};
  for (var i = 0; i < arr.length; i++) {
    if (arr[i]) {
      extend(res, arr[i]);
    }
  }
  return res
}

/**
 * Perform no operation.
 * Stubbing args to make Flow happy without leaving useless transpiled code
 * with ...rest (https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/)
 */
function noop (a, b, c) {}

/**
 * Always return false.
 */
var no = function (a, b, c) { return false; };

/**
 * Return same value
 */
 // 返回参数自身
var identity = function (_) { return _; };

/**
 * Generate a static keys string from compiler modules.
 */
/*
将一组对象的 staticKeys 数组合并成一个字符串，举个例子：
modules = [
    { staticKeys : ['mod11','mod12'] },
    { staticKeys : ['mod21','mod22'] },
    { staticKeys : ['mod31','mod32'] }
];
genStaticKeys(modules)
-> "mod11,mod12,mod21,mod22,mod31,mod32"
*/
function genStaticKeys (modules) {
  /*
  对于 arr.reduce([callback, initialValue]) 函数：
  ① callback 函数的第一个参数为上次调用 callback 的返回值，或者初始值 initialValue
     callback 函数的第二个参数为当前被处理的元素
  ② initialValue 为第一次调用 callback 的第一个参数
  */
  return modules.reduce(function (keys, m) {
    return keys.concat(m.staticKeys || [])
  }, []).join(',')
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 */
 // a 和 b 形式上（都转为字符串后）是否相等
function looseEqual (a, b) {
  var isObjectA = isObject(a);
  var isObjectB = isObject(b);
  // a b 都是对象
  if (isObjectA && isObjectB) {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch (e) {
      // possible circular reference
      // 如果序列化出错，可能是循环引用，那就判断 a 和 b 是否严格相等
      return a === b
    }
  // a b 都不是对象
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

// 返回 val 元素（其实是和 val 形式上相等的元素） 在 arr 中的索引
function looseIndexOf (arr, val) {
  for (var i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) { return i }
  }
  return -1
}

/**
 * Ensure a function is called only once.
 */
// 确保函数 fn 只执行一次
function once (fn) {
  var called = false;
  return function () {
    if (!called) {
      called = true;
      fn.apply(this, arguments);
    }
  }
}

var SSR_ATTR = 'data-server-rendered';

// 配置类型
var ASSET_TYPES = [
  'component',
  'directive',
  'filter'
];

// 声明周期钩子
var LIFECYCLE_HOOKS = [
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeDestroy',
  'destroyed',
  'activated',
  'deactivated'
];

/*  */
// 一些全局配置
var config = ({
  /**
   * Option merge strategies (used in core/util/options)
   */
  // 可以为该对象添加方法属性，自定义合并策略的选项
  optionMergeStrategies: Object.create(null),

  /**
   * Whether to suppress warnings.
   */
  // 是否取消 Vue 所有的日志和警告
  silent: false,

  /**
   * Show production mode tip message on boot?
   */
  // 开发版本默认为 true。设为 false 以阻止 vue 在启动时生成生产提示。
  productionTip: "development" !== 'production',

  /**
   * Whether to enable devtools
   */
  // 开发版本默认为 true。设为 false 以阻止 vue-devtools 检查代码。
  devtools: "development" !== 'production',

  /**
   * Whether to record perf
   */
  // 默认为 false。设置为 true 以在浏览器开发工具中启用对组件初始化，渲染和打补丁的性能追踪。
  performance: false,

  /**
   * Error handler for watcher errors
   */
  // 指定组件的渲染和观察期间未捕获错误的处理函数。这个处理函数被调用时，可获取错误信息和 Vue 实例。
  errorHandler: null,

  /**
   * Warn handler for watcher warns
   */
  // Vue 运行时警告处理函数
  warnHandler: null,

  /**
   * Ignore certain custom elements
   */
  // 使 Vue 忽略在 Vue 之外的自定义元素。否则，它会假设你忘记注册全局组件或者拼错了组件名称，从而抛出一个关于 Unknown custom element 的警告。
  ignoredElements: [],

  /**
   * Custom user key aliases for v-on
   */
  // 给 v-on 自定义键位别名
  keyCodes: Object.create(null),

  /**
   * Check if a tag is reserved so that it cannot be registered as a
   * component. This is platform-dependent and may be overwritten.
   */
  // 如果一个 tag 标签是保留的，那就不能被注册为组件
  isReservedTag: no,

  /**
   * Check if an attribute is reserved so that it cannot be used as a component
   * prop. This is platform-dependent and may be overwritten.
   */
  // 如果一个属性（attribute）是保留的，那就不能被注册为组件特性（prop）
  isReservedAttr: no,

  /**
   * Check if a tag is an unknown element.
   * Platform-dependent.
   */
  // 检查一个 tag 是否是未知元素
  isUnknownElement: no,

  /**
   * Get the namespace of an element
   */
  // 获取命名空间
  getTagNamespace: noop,

  /**
   * Parse the real tag name for the specific platform.
   */
  parsePlatformTagName: identity,

  /**
   * Check if an attribute must be bound using property, e.g. value
   * Platform-dependent.
   */
  mustUseProp: no,

  /**
   * Exposed for legacy reasons
   */
  _lifecycleHooks: LIFECYCLE_HOOKS
});

/*  */
/*
关于方法 Object.freeze(obj) ：
① 冻结对象 obj，冻结指的是不能向这个对象添加新的属性，不能修改其已有属性的值，
不能删除已有属性，以及不能修改该对象已有属性的可枚举性、可配置性、可写性。也就是说，这个对象永远是不可变的。

② 但是，如果一个属性的值是个对象，则这个对象中的属性是可以修改的，除非它也是个冻结对象。

③ 返回值，被冻结的对象 obj
*/
var emptyObject = Object.freeze({});

/**
 * Check if a string starts with $ or _
 */
// 判断一个字符串是否以 $ 或 _ 开头
function isReserved (str) {
  var c = (str + '').charCodeAt(0);
  /*
    '$'.charCodeAt(0) -> 36 -> 0x24
    '_'.charCodeAt(0) -> 95 -> 0x5F
  */
  return c === 0x24 || c === 0x5F
}

/**
 * Define a property.
 */
/*
 Object.defineProperty(obj, prop, descriptor)
 直接在一个对象上定义一个新属性，或者修改一个对象的现有属性， 并返回这个对象。
*/
function def (obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    // 属性值
    value: val,
    // 可枚举性
    enumerable: !!enumerable,
    // 为 true 表示该属性能被赋值运算符改变
    writable: true,
    // 为 true 表示可以再次配置该属性的 descriptor，也能删除改属性
    configurable: true
  });
}

/**
 * Parse simple path.
 */
var bailRE = /[^\w.$]/;
/*
 [^\w.$] 匹配除 字母|数字|下划线|汉字|.|$ 以外的字符

 bailRE.test('.') -> false
 bailRE.test('$') -> false

 bailRE.test('<') -> true

 对于，bailRE.test(path)，只要 path 中有一个字符不是字母|数字|下划线|汉字|.|$，
 就返回 true，那就认为不是路径，直接返回

 parsePath (path)(obj) 在对象 obj 中找到路径 path 对应的值 

 例如：path = 'aaa.bbb.ccc'
 var f = parsePath(path);
 var o1 = {
    aaa : {
        bbb : {
            ccc : 1
        }
    }
 }

 f(o1) -> 1

 var o2 = {
    aaa : {
        bbb : 1
    }
 }

 f(o2) -> undefined

 var o3 = {
    aaa : 1
 }

 f(o3) -> undefined

 var o4 = {
    aaa : {
        bbb : {
            ccc : {
                ddd : 1
            }
        }
    }
 }

 f(o4) -> {ddd: 1}
*/
// parsePath (path)(obj) 在对象 obj 找到路径 path 对应的值 
function parsePath (path) {
  if (bailRE.test(path)) {
    return
  }
  // 如 ['aaa','bbb','ccc']
  var segments = path.split('.');
  return function (obj) {
    for (var i = 0; i < segments.length; i++) {
      if (!obj) { return }
      obj = obj[segments[i]];
    }
    return obj
  }
}

/*  */
// 空函数
var warn = noop;
var tip = noop;
var formatComponentName = (null); // work around flow check

{ 
  // 是否支持 console
  var hasConsole = typeof console !== 'undefined';
  var classifyRE = /(?:^|[-_])(\w)/g;
  /*
  classifyRE 匹配两类：
  ① 开头是字母|数字|下划线|汉字的第一个字符
  ② 紧跟在 - 或 _ 后的第一个字符

  于是，classify 函数的作用就是将首字母或-或_后的字母转为大写
  classify('aaa-bbb_ccc') -> "AaaBbbCcc"
  */
  var classify = function (str) { return str
    .replace(classifyRE, function (c) { return c.toUpperCase(); })
    .replace(/[-_]/g, ''); };

  // 警告
  warn = function (msg, vm) {
    var trace = vm ? generateComponentTrace(vm) : '';

    // 优先调用 config.warnHandler 函数发出警告，其次才在控制台报警
    if (config.warnHandler) {
      config.warnHandler.call(null, msg, vm, trace);
    } else if (hasConsole && (!config.silent)) {
      console.error(("[Vue warn]: " + msg + trace));
    }
  };

  // 提示
  tip = function (msg, vm) {
    if (hasConsole && (!config.silent)) {
      console.warn("[Vue tip]: " + msg + (
        vm ? generateComponentTrace(vm) : ''
      ));
    }
  };

  // 返回格式化的字符串形式组件名
  formatComponentName = function (vm, includeFile) {
    // 如果一个 vm 的根节点就是自身，那就返回 '<Root>'
    if (vm.$root === vm) {
      return '<Root>'
    }
    /*
      ① vm 是字符串类型，那么 name 就是 vm 自身
      ② vm 是函数，并且有 options 属性，那么 name 就是 vm.options.name
      ③ vm 是 Vue 实例，那么 name 就是 vm.$options.name || vm.$options._componentTag
      ④ 其他，name 就是 vm.name
    */
    var name = typeof vm === 'string'
      ? vm
      : typeof vm === 'function' && vm.options
        ? vm.options.name
        : vm._isVue
          ? vm.$options.name || vm.$options._componentTag
          : vm.name;

    var file = vm._isVue && vm.$options.__file;
    if (!name && file) {
      /*
      从文件名中获取组件名

      eg:
      'myComponet.vue'.match(/([^/\\]+)\.vue$/)
      -> ["myComponet.vue", "myComponet", index: 0, input: "myComponet.vue"]

      所以，match[1] 就是组件名
      */
      var match = file.match(/([^/\\]+)\.vue$/);
      name = match && match[1];
    }

    /*
      ① 组件名'aaa-bbb' -> "<AaaBbb>"
      ② 如果没有组件名，就用匿名，"<Anonymous>"
      ③ 如果需要，还可以跟上文件名 "<AaaBbb> at aaa-bbb.vue"
    */
    return (
      (name ? ("<" + (classify(name)) + ">") : "<Anonymous>") +
      (file && includeFile !== false ? (" at " + file) : '')
    )
  };

  /*
  字符串 str 重复 n 遍，我们很容易想到循环 n 次，拼接字符串，可这里没这么做

  右移 >> 运算可以模拟整除：
  21 >> 2 -> 21 / (2^2) -> 5
  21 >> 3 -> 21 / (2^3) -> 2

  1 >> 1 -> 1 / 2 -> 0
  2 >> 1 -> 2 / 2 -> 1
  3 >> 1 -> 3 / 2 -> 1
  4 >> 1 -> 4 / 2 -> 2
  5 >> 1 -> 5 / 2 -> 2

  所以，n >> 1 相当于 n / 2

  repeat('a',1) -> 'a'       因为 1 = 2^0
  repeat('a',2) -> 'aa'      因为 2 = 2^1
  repeat('a',3) -> 'aaa'     因为 3 = 2^0 + 2^1
  repeat('a',4) -> 'aaaa'    因为 4 = 2^2
  repeat('a',5) -> "aaaaa"   因为 5 = 2^0 + 2^2
  repeat('a',6) -> "aaaaaa"  因为 6 = 2^1 + 2^2
  repeat('a',7) -> "aaaaaaa" 因为 7 = 2^0 + 2^1 + 2^2

  这种写法只需要循环 Math.ceil(log(2)n) 次（以 2 为底 n 的对数），n 越大效果越明显
  */
  var repeat = function (str, n) {
    var res = '';
    while (n) {
      // n 为基数
      if (n % 2 === 1) { res += str; }
      if (n > 1) { str += str; }
      n >>= 1;
    }
    return res
  };

  // 返回组件栈相关信息的字符串
  var generateComponentTrace = function (vm) {
    if (vm._isVue && vm.$parent) {
      var tree = [];
      var currentRecursiveSequence = 0;
      // 依次获取组件 vm 父元素，形成组件树
      while (vm) {
        if (tree.length > 0) {
          var last = tree[tree.length - 1];
          // ① 当前组件和父组件的构造函数相同，则不会在将该构造函数 push 进 tree 数组了
          if (last.constructor === vm.constructor) {
            currentRecursiveSequence++;
            vm = vm.$parent;
            continue
          // ② 当前组件和父组件的构造函数不同
          } else if (currentRecursiveSequence > 0) {
            tree[tree.length - 1] = [last, currentRecursiveSequence];
            currentRecursiveSequence = 0;
          }
        }
        tree.push(vm);
        vm = vm.$parent;
      }
      /*
        最后得到的 tree 数组应该是这样的：
        [
          [vm1,num1],
          [vm2,num2],
          [vm3]
          ...
        ]
        
        map 函数的回调函数第一个参数为数组元素，第二个参数为元素索引
        ['a', 'b', 'c', 'd'].map(function(item,index) {
            console.log(item,index);
        });   
        打印结果如下：
        a 0
        b 1
        c 2
        d 3
       */
      // 返回警告/提示信息字符串
      return '\n\nfound in\n\n' + tree
        .map(function (vm, i) { return ("" + (i === 0 ? '---> ' : repeat(' ', 5 + i * 2)) + (Array.isArray(vm)
            ? ((formatComponentName(vm[0])) + "... (" + (vm[1]) + " recursive calls)")
            : formatComponentName(vm))); })
        .join('\n')
    } else {
      return ("\n\n(found in " + (formatComponentName(vm)) + ")")
    }
  };
}

/*  */

// 错误处理函数
function handleError (err, vm, info) {
  if (config.errorHandler) {
    config.errorHandler.call(null, err, vm, info);
  } else {
    {
      warn(("Error in " + info + ": \"" + (err.toString()) + "\""), vm);
    }
    /* istanbul ignore else */
    if (inBrowser && typeof console !== 'undefined') {
      console.error(err);
    } else {
      throw err
    }
  }
}

/*  */
/* globals MutationObserver */

// can we use __proto__?
var hasProto = '__proto__' in {};

// Browser environment sniffing
var inBrowser = typeof window !== 'undefined';
var UA = inBrowser && window.navigator.userAgent.toLowerCase();
var isIE = UA && /msie|trident/.test(UA);
var isIE9 = UA && UA.indexOf('msie 9.0') > 0;
var isEdge = UA && UA.indexOf('edge/') > 0;
var isAndroid = UA && UA.indexOf('android') > 0;
var isIOS = UA && /iphone|ipad|ipod|ios/.test(UA);
var isChrome = UA && /chrome\/\d+/.test(UA) && !isEdge;

// Firefix has a "watch" function on Object.prototype...
// 火狐浏览器有原生的 watch 方法
var nativeWatch = ({}).watch;

/*
参考：
https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener
http://www.cnblogs.com/ziyunfei/p/5545439.html

关于 addEventListener 函数：
addEventListener(type, listener, {
    capture: false,
    passive: true,
    once: false
})

如果 passive 设置为 true 表示 listener 永远不会调用 preventDefault()，也就是默认动作一定执行

很多时候我们并不想阻止默认行为，但浏览器无法预先知道一个 listener 会不会调用 preventDefault()
即便 listener 是个空函数，也会产生一定的卡顿，毕竟空函数的执行也会耗时。

所以，如果可以，将 passive 设置为 true 可以起到性能优化的作用。

不过，并不是所有浏览器都支持这个 passive 属性的，所以下面会对其进行检查。
*/
var supportsPassive = false;
if (inBrowser) {
  try {
    var opts = {};
    // 如果事件发生时，试图读取 opts.passive 属性，那说明当前浏览器支持 passive 属性，于是将 supportsPassive 置为 true
    Object.defineProperty(opts, 'passive', ({
      get: function get () {
        /* istanbul ignore next */
        supportsPassive = true;
      }
    })); // https://github.com/facebook/flow/issues/285
    window.addEventListener('test-passive', null, opts);
    /*
      target.addEventListener(type, listener, options);
      ① type：表示事件类型
      ② listener：回调函数/null
      ③ options：指定有关 listener 属性的可选参数对象
        {
          capture:  Boolean，表示 listener 会在该类型的事件捕获阶段传播到该 EventTarget 时触发。
          once:  Boolean，表示 listener 在添加之后最多只调用一次。如果是 true， listener 会在其被调用之后自动移除。
          passive: Boolean，表示 listener 永远不会调用 preventDefault()。如果 listener 仍然调用了这个函数，客户端将会忽略它并抛出一个控制台警告。
        } 

      以上的 options 对象的 passive 选项不是所有的环境都支持，所以这里做一个试探：
      添加一个 'test-passive' 类型事件，若系统试图去读取 opts 对象的 passive 属性，那就说明支持 passive 配置选项，于是标志 supportsPassive = true
     */
  } catch (e) {}
}

// this needs to be lazy-evaled because vue may be required before
// vue-server-renderer can set VUE_ENV
var _isServer;
// 判断是否是服务端环境
var isServerRendering = function () {
  if (_isServer === undefined) {
    /* istanbul ignore if */
    if (!inBrowser && typeof global !== 'undefined') {
      // detect presence of vue-server-renderer and avoid
      // Webpack shimming the process
      _isServer = global['process'].env.VUE_ENV === 'server';
    } else {
      _isServer = false;
    }
  }
  return _isServer
};

// detect devtools
var devtools = inBrowser && window.__VUE_DEVTOOLS_GLOBAL_HOOK__;

/* istanbul ignore next */
/*
判断是否是原生构造方法。以 parseInt 方法为例：
typeof parseInt      ->  "function"
parseInt.toString()  ->  "function parseInt() { [native code] }"
 */
function isNative (Ctor) {
  return typeof Ctor === 'function' && /native code/.test(Ctor.toString())
}

// es6 新加的特性
var hasSymbol =
  typeof Symbol !== 'undefined' && isNative(Symbol) &&
  typeof Reflect !== 'undefined' && isNative(Reflect.ownKeys);

/**
 * Defer a task to execute it asynchronously.
 */
// 异步执行任务
var nextTick = (function () {
  var callbacks = [];
  var pending = false;
  var timerFunc;

  function nextTickHandler () {
    pending = false;
    // 深拷贝
    var copies = callbacks.slice(0);
    // 将 callbacks 数组清空
    callbacks.length = 0;
    // 依次执行原 callbacks 数组里的方法
    for (var i = 0; i < copies.length; i++) {
      copies[i]();
    }
  }

  // 虽然 Promise 和 MutationObserver 都可以利用“事件循环”，但由于 MutationObserver 在 ios 系统有 bug，
  // 所以首选还是 Promise
  // the nextTick behavior leverages the microtask queue, which can be accessed
  // via either native Promise.then or MutationObserver.
  // MutationObserver has wider support, however it is seriously bugged in
  // UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
  // completely stops working after triggering a few times... so, if native
  // Promise is available, we will use it:
  /* istanbul ignore if */

  // Promise 是原生方法
  if (typeof Promise !== 'undefined' && isNative(Promise)) {
    var p = Promise.resolve();
    /*
    Promise.resolve 方法允许调用时不带参数，直接返回一个 resolved 状态的 Promise 对象。
    立即 resolve 的 Promise 对象，是在本轮“事件循环”（event loop）的结束时，而不是在下一轮“事件循环”的开始时。

    区别于：setTimeout(fn, 0) 在下一轮“事件循环”开始时执行
     */
    var logError = function (err) { console.error(err); };
    timerFunc = function () {
      // 本轮“事件循环”（event loop）的结束时执行 nextTickHandler
      p.then(nextTickHandler).catch(logError);
      // in problematic UIWebViews, Promise.then doesn't completely break, but
      // it can get stuck in a weird state where callbacks are pushed into the
      // microtask queue but the queue isn't being flushed, until the browser
      // needs to do some other work, e.g. handle a timer. Therefore we can
      // "force" the microtask queue to be flushed by adding an empty timer.
      // 加入一个空的定时器，强制结束本轮“事件循环”，并开启下一轮
      if (isIOS) { setTimeout(noop); }
    };
  /*
  参考：http://www.cnblogs.com/jscode/p/3600060.html
  再来看 MutationObserver：

  MutationObserver（变动观察器）是监视 DOM 变动的接口。当 DOM 对象树发生任何变动时，MutationObserver 会得到通知。

  在概念上，它很接近事件。可以理解为，当 DOM 发生变动会触发 MutationObserver 事件。但是，它与事件有一个本质不同：
  a) 事件是同步触发，也就是说 DOM 发生变动立刻会触发相应的事件；
  b) MutationObserver 则是异步触发，DOM 发生变动以后，并不会马上触发，而是要等到当前所有 DOM 操作都结束后才触发。

  这样设计是为了应付 DOM 变动频繁的情况。举例来说，如果在文档中连续插入 1000 个段落（p 元素），会连续触发 1000 个插入事件，
  执行每个事件的回调函数，这很可能造成浏览器的卡顿；而 MutationObserver 完全不同，只在 1000 个段落都插入结束后才会触发，而且只触发一次。

   */
  } else if (typeof MutationObserver !== 'undefined' && (
    isNative(MutationObserver) ||
    // PhantomJS and iOS 7.x
    MutationObserver.toString() === '[object MutationObserverConstructor]'
  )) {
    // use MutationObserver where native Promise is not available,
    // e.g. PhantomJS IE11, iOS7, Android 4.4
    var counter = 1;
    // 指定 observer 的回调方法是 nextTickHandler
    var observer = new MutationObserver(nextTickHandler);
    // observer 的作用是监视 dom 变化，所以这里创建一个 dom
    var textNode = document.createTextNode(String(counter));
    // 监视 textNode
    observer.observe(textNode, {
      // 节点内容或节点文本的变动
      characterData: true
    });
    timerFunc = function () {
      // 对 2 求模，结果为 0 或 1
      counter = (counter + 1) % 2;
      textNode.data = String(counter);
    };
  } else {
    // fallback to setTimeout
    /* istanbul ignore next */
    // Promise 和 MutationObserver 都不支持，那就用 setTimeout 在下一轮“事件循环”开始执行吧
    timerFunc = function () {
      setTimeout(nextTickHandler, 0);
    };
  }

  /*
    var nextTick = function queueNextTick (cb, ctx) {...}
    ① 若 cb 参数不存在或当前环境不支持 Promise，则没有指定返回值，也就是 undefined
    ② 否则，返回一个 promise 实例

    简单点说就是：
    ① nextTick 方法有实参时，将实参加入回调函数队列 callbacks，然后在本轮“事件循环”结束后，依次执行回调队列 callbacks 中的函数；
    ② nextTick 方法没有实参时，返回一个 Promise 实例，可以为该实例添加 then 回调，待队列 callbacks 中函数执行 _resolve(ctx) 时触发 then 的回调方法
   */
  return function queueNextTick (cb, ctx) {
    var _resolve;
    // 将 cb 分别用一个新的匿名函数包装，并 push 进 callbacks 数组
    callbacks.push(function () {
      if (cb) {
        try {
          cb.call(ctx);
        } catch (e) {
          handleError(e, ctx, 'nextTick');
        }
      } else if (_resolve) {
        _resolve(ctx);
      }
    });
    // pending 状态改为 true
    if (!pending) {
      pending = true;
      timerFunc();
    }

    if (!cb && typeof Promise !== 'undefined') {
      return new Promise(function (resolve, reject) {
        _resolve = resolve;
      })
    }
    /*
      var _resolve;
      var p = new Promise(function (resolve, reject) {
        _resolve = resolve;
      })
      p.then(function(data){
        console.log(data);
      })

      _resolve('这是数据')
      // 控制台打印'这是数据'

      resolve 函数的作用是，将 Promise 对象的状态从“未完成”变为“成功”（即从 pending 变为 resolved）
      而 then 方法可以接受两个回调函数作为参数。第一个回调函数是 Promise 对象的状态变为 resolved 时调用

      所以，执行 _resolve 函数后，就会执行 then 方法指定的第一个回调，并且 _resolve 的实参会传给 then 的第一个回调函数
    
      那么，若条件 !cb && typeof Promise !== 'undefined' 满足（即不指定实参并且支持 Promise）：
      var p = nextTick();
      p.then(function(data){
        console.log(data);
      })

      则本轮“事件循环”结束后会执行 nextTickHandler 函数，也就是说会依次触发数组 callbacks 中的函数，其中包括 _resolve(ctx)
      而一旦执行了 _resolve(ctx)，就会执行 then 的第一个回调函数，即打印出 ctx
     */
  }
})();


// 如果浏览器原生支持 es6 的 Set 方法，那就用原生的，否则退而求其次，这里自己封装一个
var _Set;
/* istanbul ignore if */
if (typeof Set !== 'undefined' && isNative(Set)) {
  // use native Set when available.
  _Set = Set;
} else {
  // a non-standard Set polyfill that only works with primitive keys.
  /*
  这里自己封装一个简单的 Set 方法

  var set = new _Set();
  set.add(1);

  set.has(1) -> true
  set.has(2) -> false

  set.clear();
  set.has(1) -> false
   */ 
  _Set = (function () {
    function Set () {
      this.set = Object.create(null);
    }
    Set.prototype.has = function has (key) {
      return this.set[key] === true
    };
    Set.prototype.add = function add (key) {
      this.set[key] = true;
    };
    Set.prototype.clear = function clear () {
      this.set = Object.create(null);
    };

    return Set;
  }());
}

/*  */


var uid = 0;

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
// 依赖构造函数，Dep 是 dependency 的简写
var Dep = function Dep () {
  this.id = uid++;
  this.subs = [];
};

// 添加订阅者
Dep.prototype.addSub = function addSub (sub) {
  this.subs.push(sub);
};

// 删除订阅者
Dep.prototype.removeSub = function removeSub (sub) {
  // 先找到 sub 在 this.subs 中的索引，然后调用 splice 函数删除它
  remove(this.subs, sub);
};

// 添加依赖
Dep.prototype.depend = function depend () {
  if (Dep.target) {
    Dep.target.addDep(this);
  }
};

// 触发更新
Dep.prototype.notify = function notify () {
  // stabilize the subscriber list first
  var subs = this.subs.slice();
  for (var i = 0, l = subs.length; i < l; i++) {
    subs[i].update();
  }
};

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null;
var targetStack = [];

// 旧的 Dep.target 压栈，_target 作为新的 Dep.target
function pushTarget (_target) {
  if (Dep.target) { targetStack.push(Dep.target); }
  Dep.target = _target;
}

// 旧的 Dep.target 出栈，即恢复旧的 Dep.target
function popTarget () {
  Dep.target = targetStack.pop();
}

/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

var arrayProto = Array.prototype;
var arrayMethods = Object.create(arrayProto);

[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
.forEach(function (method) {
  // cache original method
  var original = arrayProto[method];
  /*
    以上方法的共同点是：都会改变原数组
    于是，拦截这些方法，重新定义 arrayMethods['push' | 'pop' | 'shift' | 'unshift' | 'splice' | 'sort' | 'reverse']
   */
  def(arrayMethods, method, function mutator () {
    var args = [], len = arguments.length;
    // 以 len = 3 为例，arguments[3] 就是 undefined，但由于先执行 len--，所以根本不会取 arguments[3] 的值
    while ( len-- ) args[ len ] = arguments[ len ];

    var result = original.apply(this, args);
    var ob = this.__ob__;
    var inserted;
    // 只有 3 种方法会插入新元素
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args;
        break
      /*
          arrayObject.splice(index,howmany,item1,.....,itemX)
          index 整数，规定添加/删除项目的位置，使用负数可从数组结尾处规定位置.
          howmany 要删除的项目数量。如果设置为 0，则不会删除项目。
          item1, ..., itemX 向数组添加的新项目。

          这里把 [item1, ..., itemX] 赋给 inserted
       */
      case 'splice':
        inserted = args.slice(2);
        break
    }
    // 依次观察新增元素组 inserted 的每一项
    if (inserted) { ob.observeArray(inserted); }
    // notify change
    ob.dep.notify();
    // 最后返回的还是原始方法的值
    return result
  });
});



/*
  ./array.js 中：
  const arrayProto = Array.prototype
  export const arrayMethods = Object.create(arrayProto)

  ① 到这里 arrayMethods 是个空对象 {}，只不过原型指向 Array.prototype
  ② 然后，指向 foreach 循环，通过 def() 方法为 arrayMethods 添加 ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"] 等不可枚举属性
  ③ 虽然这些属性不可枚举，但是 Object.getOwnPropertyNames 方法可以返回属性的不可枚举属性
  ④ 所以，arrayKeys = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"]
 */
var arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/**
 * By default, when a reactive property is set, the new value is
 * also converted to become reactive. However when passing down props,
 * we don't want to force conversion because the value may be a nested value
 * under a frozen data structure. Converting it would defeat the optimization.
 */
var observerState = {
  shouldConvert: true
};

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 */
// 本质是调用 defineReactive$$1 对 value 对象的每一个属性的 getter/setters 进行劫持
/*
  对 value 对象/数组的每个属性的 getter/setters 进行劫持，收集依赖（主题）和分发更新通知

  注意对象和数组的处理方式不一样。
  ① value 是对象，对应一个 dep，对 value 的每一个属性的 getter/setters 进行劫持
  ② value 是数组，对应一个 dep，值得注意的是我们期待的数组每一项都是对象，所以 value 应该是这样子：
     value: [
          { message: 'Foo' },
          { message: 'Bar' }
     ]
     于是，遍历 value 数组，对每一个 obj 子项执行 observe(obj)，实质就是 new Observer(obj)

     也就是说:
     若 value 是对象，它对应一个 dep
     若 value 是数组，它自己对应一个 dep，每个子元素对象也各自对应一个 dep
 */
var Observer = function Observer (value) {
  this.value = value;
  // 管理对 value 值关注的订阅者，例如 value 数组 push/unshift/splice 操作时，会通知所有的订阅者
  this.dep = new Dep();
  /*
      vmCount 默认值为 0
      
      ① Observer 构造函数只会在 observe(value, asRootData) 方法中调用：
         ob = value.__ob__（或：ob = new Observer(value)）
      ② 如果 asRootData 为 true，表示 value 是根 $data，那就
         ob.vmCount++;

      也就是说，同一个 value 对象可以作为多个组件的根 $data，vmCount 用来标记共有多少个组件将对象 value 作为根 $data
   */
  this.vmCount = 0;

  // 通过 Object.defineProperty 定义 __ob__ 属性指向当前 Observer 实例
  def(value, '__ob__', this);

  // 监听数组变化
  if (Array.isArray(value)) {
    /*
      ① hasProto = '__proto__' in {};
      ② protoAugment (target, src, keys) 作用是给 target 指定原型 target.__proto__ = src;
      ③ copyAugment (target, src, keys) 作用是遍历 keys，依次将 src[key] 赋值给 target[key]
     */
    var augment = hasProto
      ? protoAugment
      : copyAugment;

    /*
      ① arrayMethods = Object.create(Array.prototype);
         之后用 foreach 循环对 arrayMethods 的 ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"] 方法重写
         arrayKeys = Object.getOwnPropertyNames(arrayMethods)
         即 arrayKeys = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"]
      ② 如果支持 __proto__ 写法
         那么 value.__proto__ = arrayMethods;
      ③ 如果不支持 __proto__ 写法
         那么依次将 arrayMethods[key] 赋给 value[key]，其中 key 为 "push", "pop", "shift", "unshift", "splice", "sort", "reverse" 等 7 个方法名之一
       
       所以，以下这句的作用就是将数组 value 的 push/unshift/splice/... 等方法进行劫持
       劫持之后，value 数组的这些方法执行时，除了对数组操作，还会发出通知，触发 dom 更新
     */
    augment(value, arrayMethods, arrayKeys);
    // observeArray 方法还是会调用 Observer 方法，即走到下面的 walk 方法
    this.observeArray(value);
  // 监听对象变化
  } else {
    this.walk(value);
  }
};

/**
 * Walk through each property and convert them into
 * getter/setters. This method should only be called when
 * value type is Object.
 */
// 作用为遍历对象 value 的属性，将每一个属性都转化为 getter/setters。监听对象变化。 
Observer.prototype.walk = function walk (obj) {
  // Object.keys 用来遍历对象的属性，返回一个数组，该数组的成员都是对象自身的（而不是继承的）所有属性名。注意，Object.keys 方法只返回可枚举的属性。
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    // 在 obj 对象上拦截 keys[i] 属性的 getter/setters 操作
    defineReactive$$1(obj, keys[i], obj[keys[i]]);
  }
};

/**
 * Observe a list of Array items.
 */
// 依次观察数组 items 的每一项。监听数组变化。
Observer.prototype.observeArray = function observeArray (items) {
  for (var i = 0, l = items.length; i < l; i++) {
    /*
      依次观察每一个 item 对象，如：
      data: {
        items: [
          { message: 'Foo' },
          { message: 'Bar' }
        ]
      }

      可见，数组 items 的每一项 items[i] 还需是对象，不然 observe(items[i]) 方法会直接返回
     */
    observe(items[i]);
  }
};

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
// 将 target 的原型对象指定为 src
function protoAugment (target, src, keys) {
  /* eslint-disable no-proto */
  target.__proto__ = src;
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target, src, keys) {
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    // 依次将 src[key] 赋值给 target[key]
    def(target, key, src[key]);
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
/*
  返回一个与 value 对象/数组关联的 Observer 实例
  ① 若之前创建过关联的 Observer 实例，那就用之，不需重新创建。
  ② 若没有关联的 Observer 实例，那就用 new Observer(value) 新创建一个
 */
// 本质就是调用 new Observer(value)。为 value 创建一个 Observer 实例。asRootData 为 true 表示当前 value 为根数据。
function observe (value, asRootData) {
  // 如果 vulue 不是对象就不处理了
  if (!isObject(value)) {
    return
  }
  var ob;
  // 1. 若有与 value 相关联的 Observer 实例，那就用这个实例
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  // 如果没有对应的观察者对象，就新创建一个
  } else if (
    /*
      需同时满足以下条件：
      ① observerState.shouldConvert 为 true
      ② 非服务器环境
      ③ value 是数组或者对象
      ④ value 对象可扩展
      ⑤ value 不是 Vue 实例
     */
    observerState.shouldConvert &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  // 2. 新建一个与 value 相关联的 Observer 实例
  ) {
    ob = new Observer(value);
  }
  // 如果作为根数据，那么 vmCount 属性加 1
  if (asRootData && ob) {
    ob.vmCount++;
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */

/*
    在 obj 对象上拦截 key 属性的 get/set 操作，通俗地说有两点：

    ① 若在新建 watcher = new Watcher() 实例时，获取 obj[key] 属性，说明这个 watcher 对 obj[key] 属性感兴趣，那么就收集这个 watcher；
    ② 在设置 obj[key] = val 时，执行 customSetter()，并通知 watcher，然后 watcher 会执行相应的动作
*/
function defineReactive$$1 (obj, key, val, customSetter, shallow) {

  // 新建一个依赖管理器
  var dep = new Dep();
  
  /*
      获取 key 属性的属性描述对象，例如：

      var o = {a:1}
      var props = Object.getOwnPropertyDescriptor(o,'a')
      -> {value: 1, writable: true, enumerable: true, configurable: true}
  */
  var property = Object.getOwnPropertyDescriptor(obj, key);

  // 如果 obj 的 key 属性不可配置，直接返回
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters，之前定义的 getter/setters
  var getter = property && property.get;
  var setter = property && property.set;

  /*
    ① shallow 的意思是"浅的"，也就是说没有指定"浅观察"，就是深度观察（子属性也要劫持）

    举例来说：
    obj = {
     a : {
        aa : 1
     }
    }

    这里的 val 是 {aa : 1} 这样的对象，那么就递归遍历 {aa : 1} 对象的属性，劫持其属性的 getter/setter

    ② 反过来说，若 shallow 为 true，就不用管 val 的子属性了

    总结一下：
    递归：observe(val) -> new Observer(val) -> defineReactive$$1()
    【重要】以下这句作用就是：递归遍历劫持 val 的所有子属性（这里的 val 必须为对象或者数组 childOb 才有值）
  */
  var childOb = !shallow && observe(val);


  Object.defineProperty(obj, key, {
    // 可枚举
    enumerable: true,
    // 可配置
    configurable: true,
    // 获取 obj 的 key 属性时触发该方法
    get: function reactiveGetter () {
      var value = getter ? getter.call(obj) : val;
      /*
          看看这句代码的执行流程：
          dep.depend()
          -> Dep.target.addDep(dep)
          -> Dep.target.newDepIds.add(dep.id)
             Dep.target.newDeps.push(dep)
             dep.addSub(Dep.target)

          也就是说：
          ① Dep.target 这个 watcher 收录 dep/dep.id（主题/主题id）
          ② dep 主题的订阅列表也收录 Dep.target 这个 watcher

          所以，这个操作可以理解为 Dep.target 和 dep ”互相关注“

          再深挖一下：
          ① Dep.targe 表示正在计算属性值的 watcher，这是全局唯一的。任意时刻只允许有一个 watcher 正在计算。
          ② 代码流程能走到这个 reactiveGetter 方法里，说明此时要获取 obj[key] 这个值
          ③ 这就说明正在计算属性值的 watcher 对 obj[key] 这个值感兴趣，obj[key] 会影响计算结果
          ④ 所以 obj[key] 改变时需要通知 watcher。也就是说 watcher 需关注主题 dep，由 dep 来给 watcher 发通知。
      */
      if (Dep.target) {
        // 相当于 Dep.target.addDep(dep)，即把 Dep.target 这个 Watcher 实例添加到 dep.subs 数组里
        dep.depend();
        if (childOb) {
            // 若 childOb 为真，说明 val 为数组和对象，所有对 val 感兴趣的订阅者都会加到 childOb.dep 这个主题对象里
            childOb.dep.depend();
          /*
            注意：childOb = observe(value) -> childOb = new Observer(value)
            也就是说 childOb 是 Observer 实例，而 childOb.dep 表示对 value 感兴趣的所有订阅者 watcher

            另外，要想 childOb 不是 undefined，那么 isObject (value) 为 true ,
            即 value !== null && typeof value === 'object' 为 true，那么 value 必须为数组或对象

            (1) 例如 obj.value 是数组
                obj: {
                    value : [
                       { message: 'Foo' },
                       { message: 'Bar' }
                    ]
                }

            当对 value 数组进行 push/unshift/splice 等操作时：
            ① ob = value.__ob__ （也就是 childOb）
            ② ob.dep.notify() （也就是 childOb.dep.notify()）

            还是那句话，既然在执行 watcher = new Watcher() 时会获取 obj.value
            说明 watcher 对 obj 的 value 属性感兴趣，那么 value 属性变化时就应该通知 watcher

            (2) 例如 obj.value 是对象
               obj: {
                   value : {
                        a : 1
                   }
               }

            当对 value 对象进行 set 新属性操作时：（全局 set (value, key, val) 函数）
            ① ob = (value).__ob__ （也就是 childOb）
            ② defineReactive$$1(value, key, val);
            ③ ob.dep.notify(); （也就是 childOb.dep.notify()）

            当给 value 对象添加新属性 key 时，先把 key 属性劫持了，然后通知所有关注 value 对象的订阅者
           */
        }
        if (Array.isArray(value)) {
          // 对数组 value 的每一项 e 调用 Dep.target.addDep(e.__ob__.dep)
          dependArray(value);
        }
      }
      return value
    },
    // 设置 obj 的 key 属性时触发该函数
    set: function reactiveSetter (newVal) {

      // 获取旧值
      var value = getter ? getter.call(obj) : val;

      // 如果旧值和新值相等或者旧值和新值都是 NaN，则不进行设置操作。（NaN 应该是唯一不等于自身的值）
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      // 执行自定义 setter
      if ("development" !== 'production' && customSetter) {
        customSetter();
      }
    
      // 设置新值
      if (setter) {
        setter.call(obj, newVal);
      } else {
        /*
          注意：set/set 函数在这里是闭包，所以能共用 val 的值，简化一下 defineReactive$$1 函数看得更清楚：

          function defineReactive$$1 (obj, key, val) {
            Object.defineProperty(obj, key, {
              get: function () {
                return val
              },
              set: function (newVal) {
                val = newVal;
              }
            });
          }

          ① 当我们给 key 赋值时，如 obj[key] = 100 -> val = 100
          ② 当我们获取 key 的值时，即 obj[key] -> val (100)
          
          也就是说 100 是存在 val 这个中间变量里，这个 val 变量不属于 get 函数，也不属于 set 函数
          但它们可以共用
         */
        val = newVal;
      }
      
      // 因为 newVal 已经赋值给 val 了，所以劫持 newVal 就是劫持 val
      childOb = !shallow && observe(newVal);

      // 发出通知，执行订阅者
      dep.notify();
    }
  });
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
 // 给 target 添加 key 属性（值为 val）。若该属性之前不存在，发出变化通知。
function set (target, key, val) {
  // target 是数组，并且 key 是合法的数组索引
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 数组长度变为 target.length, key 中的较大者
    target.length = Math.max(target.length, key);
    // 在 key 位置删除 1 个元素，并新增 1 个元素 val，其实就是替换（设置）
    target.splice(key, 1, val);
    // 数组设置完值，就在这里返回
    return val
  }
  // ① 如果 key 已经存在于 target 对象中，直接赋值，返回
  if (hasOwn(target, key)) {
    target[key] = val;
    return val
  }

  // ② key 是新增的属性才会执行以下部分
  var ob = (target).__ob__;
  // target 对象是 Vue 实例，或者 Vue 实例的根数据对象
  if (target._isVue || (ob && ob.vmCount)) {
    // 开发环境发出警告：不能给 Vue 实例或根 $data 添加 reactive 属性
    "development" !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    );
    return val
  }
  if (!ob) {
    target[key] = val;
    return val
  }
  /*
    走到这，得同时满足几个条件：
    1. target 是对象
    2. target 不是 Vue 实例或其根 $data
    3. target 之前不存在 key 属性
    4. target 是”活性“的，也就是说执行过 observe(target)，target 有对应的 Observer 实例
   
    于是，将这个新增的属性也定义为”活性“属性
   */
  defineReactive$$1(ob.value, key, val);
  // 通知所有关注 target 的订阅者
  ob.dep.notify();
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
 // 删除 target 的 key 属性，必要的时候发出变化通知
function del (target, key) {
  // 数组直接删除索引为 key 的元素
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1);
    return
  }
  var ob = (target).__ob__;
  // target 对象是 Vue 实例，或者 Vue 实例的根数据对象
  if (target._isVue || (ob && ob.vmCount)) {
    "development" !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    );
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  // 删除自身属性
  delete target[key];
  if (!ob) {
    return
  }
  // 发出通知
  ob.dep.notify();
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value) {
  for (var e = (void 0), i = 0, l = value.length; i < l; i++) {
    e = value[i];
    // 依次调用 depend 方法，相当于：Dep.target.addDep(e.__ob__.dep)
    e && e.__ob__ && e.__ob__.dep.depend();
    // 递归调用
    if (Array.isArray(e)) {
      dependArray(e);
    }
  }
}

/*  */

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
/*
  可以为该对象添加方法属性，自定义合并策略的选项
  optionMergeStrategies: Object.create(null)

  后面会给 strats 添加若干属性，每一个属性 key 有对应的方法 f(parentVal, childVal)。这些方法的作用都是定义如何合并 key 属性的。
  如果没有属性 key 指定对应的方法，那就取默认的合并策略方法 defaultStrat(parentVal, childVal)，只要 childVal 不是 undefined，那就返回 childVal，childVal 全等于 undefined，才返回 parentVal。
 
  例如：
  strats.el = strats.propsData = function (parent, child, vm, key) {
    ...
    // 只要 child 不是 undefined，就返回 child，否则返回 parent
    return defaultStrat(parent, child)
  };

  strats.data = function (parentVal,childVal,vm) {...}

  LIFECYCLE_HOOKS.forEach(function (hook) {
      strats[hook] = mergeHook;
  });

  function mergeHook (parentVal,childVal) {...}

  可以看到，这些都是逐步给 strats 添加合并方法的（不同的属性，对应的合并策略不太一样），这些方法的形式都很统一：f(parentVal, childVal, vm ,key) ，最多四个参数，一般两个参数就行。
 */
var strats = config.optionMergeStrategies;

/**
 * Options with restrictions
 */
{
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        "option \"" + key + "\" can only be used during instance " +
        'creation with the `new` keyword.'
      );
    }
    // 只要 child 不是 undefined，就返回 child，否则返回 parent
    return defaultStrat(parent, child)
  };
}

/**
 * Helper that recursively merges two data objects together.
 */
// 递归地合并两个 data 对象，把 from 的属性（to 中不存在）合并到 to 中，所以这个函数只会添加新的属性给 to，而不会覆盖属性
function mergeData (to, from) {
  // 没有指定 from，直接返回 to
  if (!from) { return to }

  var key, toVal, fromVal;

  var keys = Object.keys(from);
  for (var i = 0; i < keys.length; i++) {
    key = keys[i];
    toVal = to[key];
    fromVal = from[key];
    // 如果对象 to 中不存在 key 属性，那就新创建 key 属性
    if (!hasOwn(to, key)) {
      set(to, key, fromVal);
    // 属性值是对象，递归调用
    } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      mergeData(toVal, fromVal);
    }
  }
  // 合并完毕，返回 to 对象
  return to
}

/**
 * Data
 */
 // 合并 data 或 function
function mergeDataOrFn (parentVal, childVal, vm) {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    // 合并函数数据
    return function mergedDataFn () {
      // mergeData (to, from) 递归地合并两个 data 对象，把 from 的属性（to 中不存在）合并到 to 中，所以这个函数只会添加新的属性给 to，而不会覆盖属性
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this) : childVal,
        // 这里虽然没有检查 parentVal 是否是函数，但是它必须是函数
        parentVal.call(this)
      )
    }
  } else if (parentVal || childVal) {
    // 合并实例函数数据
    return function mergedInstanceDataFn () {

      // instance merge
      var instanceData = typeof childVal === 'function' ? childVal.call(vm) : childVal;
      var defaultData = typeof parentVal === 'function' ? parentVal.call(vm) : undefined;

      // 存在实例数据，才执行合并操作，否则直接返回默认数据
      if (instanceData) {
        // mergeData (to, from) 递归地合并两个 data 对象，把 from 的属性（to 中不存在）合并到 to 中，所以这个函数只会添加新的属性给 to，而不会覆盖属性
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

// 调用 mergeDataOrFn 函数
strats.data = function (parentVal, childVal, vm) {
  if (!vm) {
    // childVal 不是函数，返回 parentVal
    if (childVal && typeof childVal !== 'function') {
      // 开发环境下发出警告：data 选项应该是函数
      "development" !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      );

      return parentVal
    }
    return mergeDataOrFn.call(this, parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
};

/**
 * Hooks and props are merged as arrays.
 */
// hooks 合并成数组
/*
举例：
mergeHook([1,2,3]) -> [1, 2, 3]
mergeHook([1,2,3],false) -> [1, 2, 3]
mergeHook([1,2,3],[4,5,6]) -> [1, 2, 3, 4, 5, 6]
mergeHook(false,[4,5,6]) -> [4, 5, 6]
mergeHook(false,4,5,6) -> [4]
 */
function mergeHook (
  parentVal,
  childVal
) {
  /*
    (1) childVal 为真值
        ① parentVal 为真值，返回 parentVal.concat(childVal)
        ② parentVal 为假值
           a) childVal 是数组，直接返回 childVal
           b) childVal 不是数组，返回 [childVal]

    (2) childVal 为假值，返回 parentVal
   */
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}

/*
var LIFECYCLE_HOOKS = [
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeDestroy',
  'destroyed',
  'activated',
  'deactivated'
];
 */
LIFECYCLE_HOOKS.forEach(function (hook) {
  strats[hook] = mergeHook;
});

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets (parentVal, childVal) {
  /*
    ① 以 parentVal 为原型创建对象 res
    ② 如果 childVal 为真值，那就将 childVal 的属性都赋给 res，否则直接返回 res
   */
  var res = Object.create(parentVal || null);
  return childVal
    ? extend(res, childVal)
    : res
}

/*
     // 配置类型
     var ASSET_TYPES = [
       'component',
       'directive',
       'filter'
     ];

     于是：
     strats.components = mergeAssets;
     strats.directives = mergeAssets;
     strats.filters = mergeAssets;
*/
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets;
});

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (parentVal, childVal) {
  // work around Firefox's Object.prototype.watch...
  if (parentVal === nativeWatch) { parentVal = undefined; }
  if (childVal === nativeWatch) { childVal = undefined; }
  /* istanbul ignore if */
  if (!childVal) { return Object.create(parentVal || null) }
  if (!parentVal) { return childVal }
  var ret = {};
  extend(ret, parentVal);
  for (var key in childVal) {
    var parent = ret[key];
    var child = childVal[key];
    if (parent && !Array.isArray(parent)) {
      parent = [parent];
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child];
  }
  return ret
};

/**
 * Other object hashes.
 */
// props、methods、inject、computed 等合并策略
strats.props =
strats.methods =
strats.inject =
strats.computed = function (parentVal, childVal) {
  if (!childVal) { return Object.create(parentVal || null) }
  if (!parentVal) { return childVal }
  // 同名覆盖，所以 childVal 中的属性优先级更高
  var ret = Object.create(null);
  extend(ret, parentVal);
  extend(ret, childVal);
  return ret
};
strats.provide = mergeDataOrFn;

/**
 * Default strategy.
 */
// 只要 childVal 不是 undefined，那就返回 childVal
var defaultStrat = function (parentVal, childVal) {
  return childVal === undefined
    ? parentVal
    : childVal
};

/**
 * Validate component names
 */
function checkComponents (options) {
  // 依次打印出不合法的组件名
  for (var key in options.components) {
    var lower = key.toLowerCase();
    /*
    不用内置的或者保留的 html 标签名作为组件名
    ① isBuiltInTag(lower) 当 lower 是 slot 或 component 这两种内置组件名时，返回 true
    ② config.isReservedTag(lower) 判断 lower 是否是 html/svg 保留标签
    */
    if (isBuiltInTag(lower) || config.isReservedTag(lower)) {
      warn(
        'Do not use built-in or reserved HTML elements as component ' +
        'id: ' + key
      );
    }
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
// 将 options.props 的每一项都统一成对象格式
/*
    将 options.props 转为以下形式：
    {
      propA: Number,
      propB: [String, Number],
      propC: {
        type: String,
        required: true
      },
      propD: {
        type: Number,
        default: 100
      },
      propE: {
        type: Object,
        default: function () {
          return { message: 'hello' }
        }
      },
      propF: {
        validator: function (value) {
          return value > 10
        }
      }
    }
*/
function normalizeProps (options) {
  var props = options.props;
  if (!props) { return }
  var res = {};
  var i, val, name;
  // props 是数组
  if (Array.isArray(props)) {
    i = props.length;
    while (i--) {
      val = props[i];
      if (typeof val === 'string') {
        // 将连字符分隔的字符串驼峰化，例如：a-b-c -> aBC
        name = camelize(val);
        res[name] = { type: null };
      // 提示：使用数组语法时，属性必须是字符串
      } else {
        warn('props must be strings when using array syntax.');
      }
    }
  // props 是对象
  } else if (isPlainObject(props)) {
    for (var key in props) {
      val = props[key];
      name = camelize(key);
      // 如果 val 是对象，那就用这个对象，否则创建一个新的对象
      res[name] = isPlainObject(val)
        ? val
        : { type: val };
    }
  }
  // 覆盖原来的 options.props
  options.props = res;
}

/**
 * Normalize all injections into Object-based format
 */
// 将数组 options.inject 转化为对象格式
function normalizeInject (options) {
  var inject = options.inject;
  // options.inject 是数组
  if (Array.isArray(inject)) {
    var normalized = options.inject = {};
    for (var i = 0; i < inject.length; i++) {
      // normalized 和 options.inject 指向同一个对象，修改 normalized 就是修改 options.inject
      normalized[inject[i]] = inject[i];
    }
  }
}

/**
 * Normalize raw function directives into object format.
 */
/*
    例如：
    options.directives : {
        dir1 : fun1,
        dir2 : fun2,
        ...
    }
    -> options.directives : {
         dir1 : { bind: fun1, update: fun1 },
         dir2 : { bind: fun2, update: fun2 },
         ...
     }
 */
// 将 child.directives 的每一项都统一成对象格式
function normalizeDirectives (options) {
  var dirs = options.directives;
  if (dirs) {
    for (var key in dirs) {
      var def = dirs[key];
      if (typeof def === 'function') {
        // eg : dirs[d1] = { bind: function(){...}, update: function(){...}};
        dirs[key] = { bind: def, update: def };
      }
    }
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
// 合并两个 options 对象
function mergeOptions (parent, child, vm) {
  { 
    // 打印出 child.components 中不符合要求的组件名
    checkComponents(child);
  }

  // 如果 child 类型是 function，那么取 child.options
  if (typeof child === 'function') {
    child = child.options;
  }

  // 将 child.props 的每一项都统一成对象格式
  normalizeProps(child);
  // 将数组 options.inject 转化为对象格式
  normalizeInject(child);
  // 将 child.directives 的每一项都统一成对象格式
  normalizeDirectives(child);

  // 用 child.extends 修正 parent
  var extendsFrom = child.extends;
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm);
  }

  // 用 child.mixins 修正 parent
  if (child.mixins) {
    for (var i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm);
    }
  }


  var options = {};
  var key;

  // 遍历 parent 的所有属性
  for (key in parent) {
    mergeField(key);
  }
  // 遍历 child 中所有属性（排除 parent 中已有属性）
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key);
    }
  }
  // 合并 key 属性
  function mergeField (key) {
    /*
    ① strats = config.optionMergeStrategies 是一个对象，可以为该对象添加方法属性，自定义合并策略的选项
       strats[key] 是一个 function，不同的 key 对应不同的 function，也就是不同的合并策略
    ② defaultStrat 是一个函数，defaultStrat(parentVal, childVal)，只要 childVal 不是 undefined，那就返回 childVal，childVal 全等于 undefined，才返回 parentVal

    也就是说，如果没有对某个 key 属性指定合并策略，就用默认的策略 defaultStrat
    */
    var strat = strats[key] || defaultStrat;
    options[key] = strat(parent[key], child[key], vm, key);
  }
  // 返回合并后的选项对象
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
// 根据 id 返回某个指定的资源
function resolveAsset (options, type, id, warnMissing) {
  /* istanbul ignore if */
  // id 必须为字符串，否则不处理
  if (typeof id !== 'string') {
    return
  }
  var assets = options[type];

  // check local registration variations first
  // ① 首先检查 id
  if (hasOwn(assets, id)) { return assets[id] }

  // 将连字符分隔的 id 驼峰化，例如：a-b-c -> aBC
  var camelizedId = camelize(id);
  // ② 检查驼峰化的 id
  if (hasOwn(assets, camelizedId)) { return assets[camelizedId] }

  // 首字母大写，例如：aBC -> ABC
  var PascalCaseId = capitalize(camelizedId);
  // ③ 检查首字母大写的 id
  if (hasOwn(assets, PascalCaseId)) { return assets[PascalCaseId] }


  // fallback to prototype chain
  // 既然走到这，说明 assets 本身不含 id/camelizedId/PascalCaseId 属性，那就去 assets 的原型链去找
  var res = assets[id] || assets[camelizedId] || assets[PascalCaseId];

  // 原型链中都找不到，开发环境下发出警告
  if ("development" !== 'production' && warnMissing && !res) {
    // 如 resolveAsset(this.$options, 'filters', id, true) ，其中 'filters'.slice(0, -1) -> 'filter'
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    );
  }
  return res
}


// 返回合法的属性值，也就是使得属性合法化
function validateProp (key, propOptions, propsData, vm) {
  // ① prop 是属性值的各种约束条件
  var prop = propOptions[key];
  // key 不是 propsData 自身属性
  var absent = !hasOwn(propsData, key);
  // ② value 才是真正的属性值
  var value = propsData[key];

  // handle boolean props
  // prop.type 这个函数是 Boolean，修正 value 为 true 或 false
  if (isType(Boolean, prop.type)) {
    if (absent && !hasOwn(prop, 'default')) {
      value = false;
    // hyphenate 用于将驼峰写法转为连字符写法，如 hyphenate('aaBbCc') -> "aa-bb-cc"
    } else if (!isType(String, prop.type) && (value === '' || value === hyphenate(key))) {
      value = true;
    }
  }

  // 如果 value 为 undefined，那就获取默认值
  if (value === undefined) {
    // 获取默认值
    value = getPropDefaultValue(vm, prop, key);
    // since the default value is a fresh copy,
    // make sure to observe it.
    /*
    前面定义过：
    observerState = {
      shouldConvert: true
    };
    不过，有多个地方可能对 observerState.shouldConvert 进行重置
    */
    // 先保存之前的 observerState.shouldConvert
    var prevShouldConvert = observerState.shouldConvert;
    observerState.shouldConvert = true;
    // 为 value 创建一个观察者实例
    observe(value);
    // 还原 observerState.shouldConvert
    observerState.shouldConvert = prevShouldConvert;
  }
  {
    // 对代码流程没影响，只是验证属性的有效性，对不符合要求的值发出 3 种警告
    assertProp(prop, key, value, vm, absent);
  }
  return value
}

/**
 * Get the default value of a prop.
 */
// 获取一个属性的默认值
function getPropDefaultValue (vm, prop, key) {
  // no default, return undefined
  /*
    Vue.component('props-demo-advanced', {
      props: {
        // 检测类型
        height: Number,
        // 检测类型 + 其他验证
        age: {
          type: Number,
          default: 0,
          required: true,
          validator: function (value) {
            return value >= 0
          }
        }
      }
    })

    // 若属性 prop 没有默认值，就返回 undefined
   */
  if (!hasOwn(prop, 'default')) {
    return undefined
  }

  var def = prop.default;
  // warn against non-factory defaults for Object & Array
  // 默认值不能是对象或者数组，必须用工厂函数返回默认值
  if ("development" !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    );
  }

  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    // 返回先前的默认值 vm._props[key]
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  /*
  getType(Function) -> "Function"
  ① def 是 function 类型，并且 prop.type 的函数名不是 Function，def 的 this 绑定 vm 执行，返回执行结果；
  ② 否则，直接返回 def
  */
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
/*
 Vue.component('props-demo-advanced', {
     props: {
         // 检测类型
         height: Number,
         // 检测类型 + 其他验证
         age: {
             type: Number,
             default: 0,
             required: true,
             validator: function (value) {
                return value >= 0
             }
         }
     }
 })

 prop 对应为：
 {
     type: Number,
     default: 0,
     required: true,
     validator: function (value) {
        return value >= 0
     }
 }
 name 对应为 age
 */
// 对代码流程没影响，只是验证属性的有效性，对不符合要求的发出 3 种警告
function assertProp (prop, name, value, vm, absent) {
  // ① prop 必需，并且 key 不是 propsData 自身属性。发出警告，然后返回
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    );
    return
  }

  // 若为非必需项，直接返回就好
  if (value == null && !prop.required) {
    return
  }

  var type = propassertTypeassertType.type;
  // 没有指定 type 或 type 为 true 时，valid 暂定为 true
  var valid = !type || type === true;

  // name 属性可接受的值类型
  var expectedTypes = [];

  // 对 valid 和 expectedTypes 进行修正
  if (type) {
    // 如果 type 不是数组，手动转为数组。注意，type 变为数组并不影响 prop.type
    if (!Array.isArray(type)) {
      type = [type];
    }
    // 只要 valid 变为 true，就终止该循环。也就是说，只要 value 匹配到 type 数组中任一类型即可
    for (var i = 0; i < type.length && !valid; i++) {
      /*
      assertedType 的格式为：
      {
        valid: valid,
        expectedType: expectedType
      }
      */
      var assertedType = assertType(value, type[i]);
      // 这里的 assertedType.expectedType 是 type[i] 转为为字符串形式的函数名，例如：type[i] 为 Boolean，那么 assertedType.expectedType 就是 "Boolean"
      expectedTypes.push(assertedType.expectedType || '');
      valid = assertedType.valid;
    }
  }

  // ② 若 valid 为假，那就发出警告：该属性无效
  if (!valid) {
    warn(
      'Invalid prop: type check failed for prop "' + name + '".' +
      // 将 expectedTypes 数组元素首字母大写，然后拼成字符串
      ' Expected ' + expectedTypes.map(capitalize).join(', ') +
      /*
      Object.prototype.toString.call(1) -> "[object Number]"
      "[object Number]".slice(8, -1) -> "Number"
      */
      ', got ' + Object.prototype.toString.call(value).slice(8, -1) + '.',
      vm
    );
    // 属性无效，在此返回
    return
  }

  /*
   比如：
   validator: function (value) {
        return value >= 0
   }
   */
  var validator = prop.validator;
  // ③ 如果属性有验证器，就要验证器检验之，没通过验证器检验，则发出警告
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      );
    }
  }
}

var simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/;

// 判断 value 是否是 type 类型的实例。返回一个 json 对象
function assertType (value, type) {
  var valid;
  // getType 方法用于获取函数名，如果没有就返回空字符串，例如：getType(Boolean) -> "Boolean"
  var expectedType = getType(type);
  // simpleCheckRE 为 String|Number|Boolean|Function|Symbol 其中一种
  if (simpleCheckRE.test(expectedType)) {
    /*
    这里有赋值（=）、typeof、全等（===）、成员访问（.）等 4 种运算符，优先级从高到低分别是：
    ① . 
    ② typeof 
    ③ ===
    ④ =
    
    typeof 1 -> "number"
    typeof 'abc' -> "string"
    */
    valid = typeof value === expectedType.toLowerCase();
  // value 为对象
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value);
  // value 为数组
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value);
  // value 是 type 的实例
  } else {
    valid = value instanceof type;
  }
  return {
    valid: valid,
    expectedType: expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
/*
获取函数名的字符串形式，如果没有就返回空字符串
eg:
① fn = Boolean
   match = Boolean.toString().match(/^\s*function (\w+)/)
   -> ["function Boolean", "Boolean", index: 0, input: "function Boolean() { [native code] }"]

   match[1] -> "Boolean"

② fn = function myFn(){}
   match = (function myFn(){}).toString().match(/^\s*function (\w+)/)
   -> ["function myFn", "myFn", index: 0, input: "function myFn(){}"]

   match[1] -> "myFn"
*/
function getType (fn) {
  var match = fn && fn.toString().match(/^\s*function (\w+)/);
  return match ? match[1] : ''
}

// 判断是否是同名函数
function isType (type, fn) {
  // fn 不是数组，只有 fn 和 type 这俩函数同名才返回 true
  if (!Array.isArray(fn)) {
    return getType(fn) === getType(type)
  }
  // fn 是数组，那么只要 fn 中有一个函数和函数 type 同名就返回 true
  for (var i = 0, len = fn.length; i < len; i++) {
    if (getType(fn[i]) === getType(type)) {
      return true
    }
  }
  /* istanbul ignore next */
  return false
}

/*  */

var mark;
var measure;

{
  /*
    window.performance 对象是 W3C 性能小组引入的新的 API，目前 IE9 以上的浏览器都支持。
    它的作用是允许网页访问某些函数来测量网页和Web应用程序的性能。

    window.performance.timing 有以下子属性：

    navigationStart：浏览器处理当前网页的启动时间
    fetchStart：浏览器发起http请求读取文档的毫秒时间戳。
    domainLookupStart：域名查询开始时的时间戳。
    domainLookupEnd：域名查询结束时的时间戳。
    connectStart：http请求开始向服务器发送的时间戳。
    connectEnd：浏览器与服务器连接建立（握手和认证过程结束）的毫秒时间戳。
    requestStart：浏览器向服务器发出http请求时的时间戳。或者开始读取本地缓存时。
    responseStart：浏览器从服务器（或读取本地缓存）收到第一个字节时的时间戳。
    responseEnd：浏览器从服务器收到最后一个字节时的毫秒时间戳。
    domLoading：浏览器开始解析网页DOM结构的时间。
    domInteractive：网页dom树创建完成，开始加载内嵌资源的时间。
    domContentLoadedEventStart：网页DOMContentLoaded事件发生时的时间戳。
    domContentLoadedEventEnd：网页所有需要执行的脚本执行完成时的时间，domReady的时间。
    domComplete：网页dom结构生成时的时间戳。
    loadEventStart：当前网页load事件的回调函数开始执行的时间戳。
    loadEventEnd：当前网页load事件的回调函数结束运行时的时间戳。

    window.performance 对象有以下方法：

    performance.getEntries()：浏览器获取网页时，会对网页中每一个对象（脚本文件、样式表、图片文件等等）发出一个 http 请求。performance.getEntries 方法以数组形式，返回这些请求的时间统计信息，有多少个请求，返回数组就会有多少个成员。
    performance.now() 方法返回当前网页自从 performance.timing.navigationStart 到当前时间之间的微秒数（毫秒的千分之一）
    performance.mark() 给相应的视点做标记。结合 performance.measure() 使用也可以算出各个时间段的耗时
    performance.clearMarks() 方法用于清除标记，如果不加参数，就表示清除所有标记。
  */
  var perf = inBrowser && window.performance;
  /* istanbul ignore if */
  if (
    perf &&
    perf.mark &&
    perf.measure &&
    perf.clearMarks &&
    perf.clearMeasures
  ) {
    // 标识视点
    mark = function (tag) { return perf.mark(tag); };
    // 计算两个视点之间的时间差
    measure = function (name, startTag, endTag) {
      perf.measure(name, startTag, endTag);
      perf.clearMarks(startTag);
      perf.clearMarks(endTag);
      perf.clearMeasures(name);
    };
  }
}

/* not type checking this file because flow doesn't play well with Proxy */

var initProxy;

{
  // allowedGlobals('parseFloat') -> true，也就是说，只要参数是以下任何一个全局变量，就返回 true
  var allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
    'require' // for Webpack/Browserify
  );

  // 发出警告：实例的属性/方法未定义
  var warnNonPresent = function (target, key) {
    warn(
      "Property or method \"" + key + "\" is not defined on the instance but " +
      "referenced during render. Make sure to declare reactive data " +
      "properties in the data option.",
      target
    );
  };

  // 是否原生支持 Proxy
  var hasProxy =
    typeof Proxy !== 'undefined' &&
    Proxy.toString().match(/native code/);

  // 原生支持 Proxy 构造函数
  if (hasProxy) {
    // 是否是内置的修饰词
    var isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta');
    // 这里的 config.keyCodes 是一个对象，这里对这个对象的属性设置进行拦截
    config.keyCodes = new Proxy(config.keyCodes, {
      set: function set (target, key, value) {
        // 如果是内置的修饰符，发出警告，不能设置
        if (isBuiltInModifier(key)) {
          warn(("Avoid overwriting built-in modifier in config.keyCodes: ." + key));
          return false
        // 其他可以成功设置
        } else {
          target[key] = value;
          return true
        }
      }
    });
  }

  var hasHandler = {
    // has(target, propKey)：拦截 propKey in proxy 的操作，返回一个布尔值。
    has: function has (target, key) {
      // key 是否在 target 对象中
      var has = key in target;
      // key 值为全局变量或下划线开头
      var isAllowed = allowedGlobals(key) || key.charAt(0) === '_';
      // key 不在 target 中并且 key 是普通标识符，发出警告
      if (!has && !isAllowed) {
        warnNonPresent(target, key);
      }
      // key 在 target 中或 key 是普通标识符，返回 true
      return has || !isAllowed
    }
  };

  var getHandler = {
    // get(target, propKey, receiver)：拦截对象属性的读取，比如 proxy.foo 和 proxy['foo']
    get: function get (target, key) {
      // key 不在 target 中，发出警告，属性不存在
      if (typeof key === 'string' && !(key in target)) {
        warnNonPresent(target, key);
      }
      // 返回 key 对应的属性值
      return target[key]
    }
  };

  initProxy = function initProxy (vm) {
    // 原生支持 Proxy
    if (hasProxy) {
      // determine which proxy handler to use
      var options = vm.$options;
      
      var handlers = options.render && options.render._withStripped
        // 拦截 vm 对象属性的读取
        ? getHandler
        // 拦截 prop in vm 的操作，返回一个布尔值
        : hasHandler;
      vm._renderProxy = new Proxy(vm, handlers);
    } else {
      vm._renderProxy = vm;
    }
  };
}

/*  */
// VNode 构造函数
var VNode = function VNode (
  tag,
  data,
  children,
  text,
  elm,
  context,
  componentOptions,
  asyncFactory
) {
  this.tag = tag;
  this.data = data;
  this.children = children;
  this.text = text;
  this.elm = elm;
  this.ns = undefined;
  // 所在的组件实例，也就是说当前 vnode 在组件 vnode.context 中渲染
  this.context = context;
  this.functionalContext = undefined;
  this.key = data && data.key;
  this.componentOptions = componentOptions;
  // 当前 vnode 节点对应的组件实例
  this.componentInstance = undefined;
  this.parent = undefined;
  this.raw = false;
  this.isStatic = false;
  this.isRootInsert = true;
  // 是否为空的注释占位符
  this.isComment = false;
  // 是否为克隆节点
  this.isCloned = false;
  // 是否为 v-once 节点
  this.isOnce = false;
  // 异步组件工厂方法
  this.asyncFactory = asyncFactory;
  // 异步组件相关元数据，例如 node.asyncMeta = { data: data, context: context, children: children, tag: tag }
  this.asyncMeta = undefined;
  this.isAsyncPlaceholder = false;
};

var prototypeAccessors = { child: {} };

// DEPRECATED: alias for componentInstance for backwards compat.
/* istanbul ignore next */
prototypeAccessors.child.get = function () {
  return this.componentInstance
};

/*
  Object.defineProperties() 方法直接在一个对象上定义新的属性或修改现有属性，并返回该对象。

  例如：
  var obj = {};
  Object.defineProperties(obj, {
    'property1': {
      value: true,
      writable: true
    },
    'property2': {
      value: 'Hello',
      writable: false
    }
    // etc. etc.
  });

  这里相当于：
  Object.defineProperties( VNode.prototype, {
    child: {
      get:function () {
        return this.componentInstance
      };
    }
  });

  也就是说，VNode 的实例访问 child 属性，会返回其 componentInstance 属性
  var vnode = new VNode();
  vnode.child -> vn.componentInstance
*/
Object.defineProperties( VNode.prototype, prototypeAccessors );

// 创建一个空的 vNode（注释）
var createEmptyVNode = function (text) {
  // void 0 === undefined -> true
  if ( text === void 0 ) text = '';

  var node = new VNode();
  node.text = text;
  node.isComment = true;
  return node
};

// 创建文本 VNode
function createTextVNode (val) {
  // 将 val 强制转为字符串
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
/*
  试想：如果是浅拷贝方式来克隆一个节点，那么多个节点之间共用一个 vnode 实例
  <div id="parent">
      <user-profile ref="profile1"></user-profile>
      <user-profile ref="profile2"></user-profile>
  </div>
  如果这里的 2 个 <user-profile> 共用一个 vnode

  那么 vnode.componentInstance 到底是 profile1 还是 profile2 呢？
  
  所以，为了避免这种问题，克隆的节点的时候新建一个完全独立的 vnode 实例，只是沿用属性
 */
function cloneVNode (vnode) {
  /*
  看一下 VNode 构造函数：
  var VNode = function VNode (tag,data,children,text,elm,context,componentOptions,asyncFactory) {}
  
  克隆节点的所有属性都取自原节点，不过，克隆节点是一个独立的新的对象
  */
  var cloned = new VNode(
    vnode.tag,
    vnode.data,
    vnode.children,
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  );
  cloned.ns = vnode.ns;
  cloned.isStatic = vnode.isStatic;
  cloned.key = vnode.key;
  cloned.isComment = vnode.isComment;
  cloned.isCloned = true;
  return cloned
}

// 克隆一组节点
function cloneVNodes (vnodes) {
  var len = vnodes.length;
  var res = new Array(len);
  for (var i = 0; i < len; i++) {
    res[i] = cloneVNode(vnodes[i]);
  }
  return res
}

// 格式化事件名（解析其中的 & ~ !）
var normalizeEvent = cached(function (name) {
  // 如果 name 的第一个字符是 &，那么 passive 为 true
  var passive = name.charAt(0) === '&';
  // 如果 name 的第一个字符是 &，那么丢掉这个字符
  name = passive ? name.slice(1) : name;

  // 如果 name 的第一个字符是 ~，那么 once$$1 为 true
  var once$$1 = name.charAt(0) === '~'; // Prefixed last, checked first
  // 如果 name 的第一个字符是 ~，那么丢掉这个字符
  name = once$$1 ? name.slice(1) : name;

  // 如果 name 的第一个字符是 !，那么 capture 为 true
  var capture = name.charAt(0) === '!';
  // 如果 name 的第一个字符是 !，那么丢掉这个字符
  name = capture ? name.slice(1) : name;

  // 返回格式化 json
  return {
    name: name,
    once: once$$1,
    capture: capture,
    passive: passive
  }
});

/*
  创建函数调度器，执行 invoker() 函数时：
  ① 若 fns 是一组函数，依次执行 fns 里的每一个函数
  ② 若 fns 只是一个函数，执行该函数，并将该函数的返回值作为 invoker 函数的返回值
 
  简单的理解就是，将一组函数 fns 合并成一个函数 invoker
 */
function createFnInvoker (fns) {
  function invoker () {
    var arguments$1 = arguments;

    var fns = invoker.fns;
    // fns 是函数数组
    if (Array.isArray(fns)) {
      // 深拷贝 fns 数组
      var cloned = fns.slice();
      for (var i = 0; i < cloned.length; i++) {
        // 为什么要多定义一个 arguments$1 变量，直接用 arguments 不行吗？
        // 工程化代码中确实是直接用 arguments，这里的 arguments$1 是工具自动生成的
        cloned[i].apply(null, arguments$1);
      }
    // fns 是单个函数，this 绑定全局对象执行
    } else {
      // return handler return value for single handlers
      return fns.apply(null, arguments)
    }
  }
  invoker.fns = fns;
  // 返回闭包
  return invoker
}

// 更新监听
function updateListeners (on, oldOn, add, remove$$1, vm) {
  var name, cur, old, event;

  for (name in on) {
    cur = on[name];
    old = oldOn[name];
    /*
    格式化后的 event 是这样一个 json：
    {
        name: name,
        once: once$$1,
        capture: capture,
        passive: passive
    }
    */
    // 格式化事件名（解析其中的 & ~ !）
    event = normalizeEvent(name);
    // a. cur 为 undefined 或 null，这是不允许的
    if (isUndef(cur)) {
      // 开发环境下发出警告
      "development" !== 'production' && warn(
        "Invalid handler for event \"" + (event.name) + "\": got " + String(cur),
        vm
      );
    // b. cur 合法，但 old 为 undefined 或 null，那么就需要用 add 新建事件绑定了，并且初始化调用器。
    } else if (isUndef(old)) {
      // 如果 cur.fns 为 undefined 或 null，那么，cur 重置为 cur 函数调用器
      if (isUndef(cur.fns)) {
		    // 初始化。on[name] 保存的是调用器，由调用器触发函数 cur。
        cur = on[name] = createFnInvoker(cur);
      }
      // 事件绑定
      add(event.name, cur, event.once, event.capture, event.passive);
    // c. cur 和 old 都合法，但不相等，那么可以继续用 old 这个调用器（免得还要调用 createFnInvoker 方法重新生成调用器），把调用器触发的方法更新为新的 cur 就行了
    } else if (cur !== old) {
      old.fns = cur;
      // 更新 on[name]
      on[name] = old;
    }
  }

  // 遍历 oldOn，删除掉不必要的事件绑定
  for (name in oldOn) {
    // on[name] 为 undefined 或 null，则移除掉对应的事件绑定
    if (isUndef(on[name])) {
      // 格式化事件名（解析其中的 & ~ !）
      event = normalizeEvent(name);
      remove$$1(event.name, oldOn[name], event.capture);
    }
  }
}

// 作用是将钩子方法 hook 加入到 def[hookKey] 中，也就是添加一个钩子方法，以后执行 def[hookKey] 也就会执行 hook 方法了
function mergeVNodeHook (def, hookKey, hook) {
  var invoker;
  var oldHook = def[hookKey];

  function wrappedHook () {
    hook.apply(this, arguments);
    // important: remove merged hook to ensure it's called only once
    // and prevent memory leak
    // 从数组 invoker.fns 中删除 wrappedHook，确保钩子只被调用一次，还能防止内存泄漏
    remove(invoker.fns, wrappedHook);
  }

  // oldHook 为 undefined 或 null，也就是之前没有对应的钩子
  if (isUndef(oldHook)) {
    // no existing hook
    // 把函数 wrappedHook 加到调用器 invoker 里，invoker 函数执行，相当于执行 wrappedHook 函数
    invoker = createFnInvoker([wrappedHook]);
  } else {
    /* istanbul ignore if */
    /*
    isDef(oldHook.fns) -> oldHook.fns 不为 undefined 且不为 null ?
    isTrue(oldHook.merged) -> oldHook.merged === true

    同时满足这俩条件，用旧的钩子就好了
    */
    if (isDef(oldHook.fns) && isTrue(oldHook.merged)) {
      // already a merged invoker，已经存在一个合并过的钩子
      invoker = oldHook;
      invoker.fns.push(wrappedHook);
    } else {
      // existing plain hook，已经存在一个没合并过的空钩子，invoker 函数执行，相当于执行 oldHook 及 wrappedHook 俩函数
      invoker = createFnInvoker([oldHook, wrappedHook]);
    }
  }
  // 标识合并过
  invoker.merged = true;
  // 更新 def 的 hookKey 属性
  def[hookKey] = invoker;
}

// 从 VNodeData 中提取 props
function extractPropsFromVNodeData (data, Ctor, tag) {
  // we are only extracting raw values here.
  // validation and default values are handled in the child
  // component itself.
  // 这里只提取原始值，验证和默认值的处理由子组件自己完成
  var propOptions = Ctor.options.props;
  // propOptions 为 undefined 或 null，直接返回
  if (isUndef(propOptions)) {
    return
  }
  var res = {};
  var attrs = data.attrs;
  var props = data.props;
  // attrs 或 props 不为 null/undefined 
  if (isDef(attrs) || isDef(props)) {
    for (var key in propOptions) {
      // 将驼峰写法转为连字符写法，如 hyphenate('aaBbCc') -> "aa-bb-cc"
      var altKey = hyphenate(key);
      {
        var keyInLowerCase = key.toLowerCase();
        if (
          key !== keyInLowerCase &&
          attrs && hasOwn(attrs, keyInLowerCase)
        ) {
          /*
          ① tip 函数的作用是：调用 console.warn 函数发出警告，例如："[Vue tip]: some tip"

          ② formatComponentName 函数的作用是格式化组件名：
             a. 组件名'aaa-bbb' -> "<AaaBbb>"
             b. 如果没有组件名，就用匿名，"<Anonymous>"
             c. 如果需要，还可以跟上文件名 "<AaaBbb> at aaa-bbb.vue"

          ③ 翻译一下以下的提示信息：
             这里把全小写字母组成的属性名传给了某组件，但是声明的属性名并不全是小写字母。
             需要注意的是：html 属性对大小写是不敏感的（都解析为小写）。camelCased 驼峰化的属性名需要转换为相应的 kebab-case (短横线隔开式) 命名。
          */
          tip(
            "Prop \"" + keyInLowerCase + "\" is passed to component " +
            (formatComponentName(tag || Ctor)) + ", but the declared prop name is" +
            " \"" + key + "\". " +
            "Note that HTML attributes are case-insensitive and camelCased " +
            "props need to use their kebab-case equivalents when using in-DOM " +
            "templates. You should probably use \"" + altKey + "\" instead of \"" + key + "\"."
          );
        }
      }
      /*
        ① 优先从 props 中提取 props[key | altKey] 属性，复制给 res 对象
        ② 前者没找到，再从 attrs 中提取 props[key | altKey] 属性，复制给 res 对象，任何删除属性 props[key | altKey]
       */
      checkProp(res, props, key, altKey, true) ||
      checkProp(res, attrs, key, altKey, false);
    }
  }
  return res
}

// 如果 key/altKey 属性是 hash 自身属性，那就把它添加到 res 中。添加成功返回 true，添加失败返回 false
function checkProp (
  res,
  hash,
  key,
  altKey,
  // preserve 为 false 表示不保留，也就是匹配成功后会删除 hash[key]
  preserve
) {
  // hash 不能为 undefined 或 null，否则返回 false
  if (isDef(hash)) {
    // key 为 hash 的自身属性
    if (hasOwn(hash, key)) {
      // 修改 res
      res[key] = hash[key];
      if (!preserve) {
        delete hash[key];
      }
      return true
    // altKey（将 key 转为连字符写法）为 hash 的自身属性
    } else if (hasOwn(hash, altKey)) {
      res[key] = hash[altKey];
      if (!preserve) {
        delete hash[altKey];
      }
      return true
    }
  }
  //
  return false
}


// 模板编译器会在编译时静态分析模板，以最大限度减少对标准化处理的依赖
// The template compiler attempts to minimize the need for normalization by
// statically analyzing the template at compile time.

/*
   对于普通的 html 标记，标准化处理是完全不需要的，因为生成的渲染函数确保能返回 Array<VNode>。

   主要有两种情况需要进行额外的标准化处理：
   ① 当 children 包含组件时
      因为函数式组件可能会返回一个数组而不是一个单独的 root。

      这种情况下，仅需要一个简单的标准化处理。即：如果某个 child 是数组，那就通过 Array.prototype.concat 方法使之扁平化。
      这样就可以确保 children 数组总是一维的（函数式组件也会对它的子组件进行标准化处理）。

   ② 当 children 包含产生嵌套数组（多维数组）的结构时（e.g. <template>, <slot>, v-for）或 children 是用户手写的渲染函数/JSX 提供的。
      
      这种情况下，就需要一整套的标准化处理来应该各种类型的 children。
*/
// For plain HTML markup, normalization can be completely skipped because the
// generated render function is guaranteed to return Array<VNode>. There are
// two cases where extra normalization is needed:

// 1. When the children contains components - because a functional component
// may return an Array instead of a single root. In this case, just a simple
// normalization is needed - if any child is an Array, we flatten the whole
// thing with Array.prototype.concat. It is guaranteed to be only 1-level deep
// because functional components already normalize their own children.
// 简单的标准化处理：将数组扁平化，变成一维数组
function simpleNormalizeChildren (children) {
  // 只要有一个 child 是数组，那就将整个 children 扁平化
  for (var i = 0; i < children.length; i++) {
    /*
        ① 首先看看 concat 函数的用法：
        arrayObject.concat(arrayX,arrayX,......,arrayX)
        其中： arrayX 可以是数组，也可以是具体的值

        [1,2].concat([3,4,5],6,7,[8])
        -> [1, 2, 3, 4, 5, 6, 7, 8]

        ② 为什么不直接 [].concat(children)，对比一下就知道了：
        
        eg: var a = [1,[2,3,4],[5,6],7,8,9];
        Array.prototype.concat.apply([], a) -> [1, 2, 3, 4, 5, 6, 7, 8, 9]
        [].concat(a) -> [1,[2,3,4],[5,6],7,8,9]

        其实，Array.prototype.concat.apply([], a) 相当于：[].concat(a[0],a[1],...,a[a.length - 1])
        也就是 [].concat(1,[2,3,4],[5,6],7,8,9) -> [1, 2, 3, 4, 5, 6, 7, 8, 9]
     
        ③ 可以看出，这样做只能将数组降 1 个维度，例如：
        Array.prototype.concat.apply([], [1,[2,[3],4]])
        -> [1, 2, [3], 4]
      */
    if (Array.isArray(children[i])) {
      return Array.prototype.concat.apply([], children)
    }
  }
  return children
}

// 2. When the children contains constructs that always generated nested Arrays,
// e.g. <template>, <slot>, v-for, or when the children is provided by user
// with hand-written render functions / JSX. In such cases a full normalization
// is needed to cater to all possible types of children values.
// 处理多种类型的 child
function normalizeChildren (children) {
  /*
    ① children 为字符串（string）或数值（number），返回 [ children 转成的文本 VNode]
    ② children 为数组，返回 normalizeArrayChildren(children)
    ③ 其他，返回 undefined
  */
  return isPrimitive(children)
    ? [createTextVNode(children)]
    : Array.isArray(children)
      ? normalizeArrayChildren(children)
      : undefined
}

// 是否为文本节点
function isTextNode (node) {
  // node.text 存在，并且不是注释
  return isDef(node) && isDef(node.text) && isFalse(node.isComment)
}
 
// 标准化数组类型 children
function normalizeArrayChildren (children, nestedIndex) {
  var res = [];
  var i, c, last;
  // 遍历 children
  for (i = 0; i < children.length; i++) {
    c = children[i];
    // ① 如果 children[i] 为 undefined/null/布尔值，那就跳过本次循环
    if (isUndef(c) || typeof c === 'boolean') { continue }

    last = res[res.length - 1];

    //  nested
    // ② children[i] 是数组，递归调用
    if (Array.isArray(c)) {
      res.push.apply(res, normalizeArrayChildren(c, ((nestedIndex || '') + "_" + i)));
    // ③ children[i] 为字符串（string）或数值（number）
    } else if (isPrimitive(c)) {
      // 如果 res 的最后一个元素是文本节点，那就把 children[i] 作为文本添加到该文本节点里
      if (isTextNode(last)) {
        // merge adjacent text nodes
        // this is necessary for SSR hydration because text nodes are
        // essentially merged when rendered to HTML strings
        (last).text += String(c);
      // 否则，将 children[i] 转为文本节点，并添加到 res 末尾
      } else if (c !== '') {
        // convert primitive to vnode
        res.push(createTextVNode(c));
      }
    // ④ children[i] 为其他类型
    } else {
      // children[i] 和 last 都为文本节点，创建一个新的文本节点作为 res 最后一个元素
      if (isTextNode(c) && isTextNode(last)) {
        // merge adjacent text nodes
        res[res.length - 1] = createTextVNode(last.text + c.text);
      // 其他
      } else {
        // default key for nested array children (likely generated by v-for)
        if (isTrue(children._isVList) &&
          isDef(c.tag) &&
          isUndef(c.key) &&
          isDef(nestedIndex)) {
          c.key = "__vlist" + nestedIndex + "_" + i + "__";
        }
        res.push(c);
      }
    }
  }
  // 最终返回数组 res
  return res
}

/*  */
// 经过这里对 comp 的修正，确保返回一个组件构造函数
function ensureCtor (comp, base) {
  // 修正 comp
  if (comp.__esModule && comp.default) {
    comp = comp.default;
  }
  /*
   isObject (obj) 方法的作用是：判断 obj 是否为除了 null 之外的对象
   base.extend(comp) 的作用是将一个普通对象转为组件构造函数
  */
  return isObject(comp)
    ? base.extend(comp)
    : comp
}

// 创建异步的占位符，返回 VNode 节点
function createAsyncPlaceholder (
  factory,
  data,
  context,
  children,
  tag
) {
  // 创建一个空的注释节点
  var node = createEmptyVNode();
  node.asyncFactory = factory;
  node.asyncMeta = { data: data, context: context, children: children, tag: tag };
  return node
}

// 根据工厂函数 factory 的不同状态返回不同的组件构造函数
function resolveAsyncComponent (
  factory,
  baseCtor,
  context
) {
  // 1. 满足以下条件，直接返回 factory.errorComp 这个组件构造函数
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }

  // 2. 如果条件 1 不满足，factory.resolved 存在，那就返回 factory.resolved 这个组件构造函数
  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  // 3. 如果条件 1 和 2 都不满足，满足以下条件，就返回 factory.loadingComp 这个组件构造函数
  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }

  // ① 如果 factory.contexts 存在，说明已经 pending 过
  if (isDef(factory.contexts)) {
    // 就把组件 context 加进数组 factory.contexts 即可
    factory.contexts.push(context);
  // ② 否则，就同步执行了，一步步走以下流程，给 factory 添加各种属性
  } else {
    var contexts = factory.contexts = [context];
    // 同步
    var sync = true;

    /*
       遍历组件数组 contexts，依次执行每一个组件的 $forceUpdate()
       vm.$forceUpdate() -> vm._watcher.update()

       也就是说，这里主动更新每个组件的视图
     */
    var forceRender = function () {
      for (var i = 0, l = contexts.length; i < l; i++) {
        contexts[i].$forceUpdate();
      }
    };

    // resolve 方法只能执行一次
    var resolve = once(function (res) {
      /*
          ensureCtor() 对 res 修正，确保返回一个组件构造函数
          所以，factory.resolved 保存的是一个组件构造函数
       */
      factory.resolved = ensureCtor(res, baseCtor);
      // invoke callbacks only if this is not a synchronous resolve
      // (async resolves are shimmed as synchronous during SSR)
      // 非同步
      if (!sync) {
        // 遍历组件数组 contexts，依次更新每个组件的视图
        forceRender();
      }
    });

    // reject 方法也只能执行一次
    var reject = once(function (reason) {
      // 开发环境发出警告：resolve 异步组件失败...
      "development" !== 'production' && warn(
        "Failed to resolve async component: " + (String(factory)) +
        (reason ? ("\nReason: " + reason) : '')
      );
      // 如果有出错组件，那就渲染之
      if (isDef(factory.errorComp)) {
        factory.error = true;
        forceRender();
      }
    });

    /*
        factory 工厂函数也是普通函数，只不过它里面会执行异步任务

        官网上异步组件构造函数是这样定义的：
        Vue.component('async-example', function (resolve, reject) {
          setTimeout(function () {
            // 将组件定义传入 resolve 回调函数
            resolve({
              template: '<div>I am async!</div>'
            })
          }, 1000)
        })

        也就是 Vue.component('async-example',fn)，不会对 fn 做任何修正
        于是，this.options['components']['async-example'] = fn;

        可以看到，工厂函数 factory 就是普通的函数，只不过该函数里会执行异步任务
        ① 异步任务执行成功就调用 resolve 方法
        ② 异步任务执行失败就调用 reject 方法

        再看看 res = factory(resolve, reject)
        ① 将 factory 函数返回值赋给 res
        ② 执行 factory 函数里的异步任务
        ③ 异步任务执行成功就调用 resolve 方法（缓存 factory.resolved 构造函数）
        ④ 异步任务执行失败就调用 reject 方法（标志组件出错，更新视图）
        （注意：这只是上面例子的执行流程，实际上 factory 函数可以不调用 resolve/reject 方法）
        
        注意：是先返回值，后执行异步任务。下面写个简单的 demo 验证一下：
        function asyncFn () {
          setTimeout(function () {
            console.log('异步任务完成')
          }, 2000)
          return '返回值'
        }

        var res = asyncFn();
        console.log(res)

        这段代码的打印结果是：
        返回值
        异步任务完成

        简单理解就是：先执行同步任务，后执行异步任务
     */

    var res = factory(resolve, reject);

    /*
      上面官网例子中工厂函数 factory 返回了 undefined。
      其实，工厂函数 factory 还可以返回其他值：

      ① 返回一个 Promise 对象
      Vue.component(
        'async-webpack-example',
        // 该 `import` 函数返回一个 `Promise` 对象。
        () => import('./my-async-component')
      )

      ② 返回一个普通 json 对象
      const factory = () => ({
        // 需要加载的组件。应当是一个 Promise
        component: import('./MyComp.vue'),
        // 加载中应当渲染的组件
        loading: LoadingComp,
        // 出错时渲染的组件
        error: ErrorComp,
        // 渲染加载中组件前的等待时间。默认：200ms。
        delay: 200,
        // 最长等待时间。超出此时间则渲染错误组件。默认：Infinity
        timeout: 3000
      })
     */

    if (isObject(res)) {
      // ① res 为 Promise 对象
      if (typeof res.then === 'function') {
        /*
          这么理解：
          ① 工厂方法 factory(resolve, reject) 执行时调用了 resolve 方法，就像上面的例子那样，那就定义了 factory.resolved
          ② 工厂方法 factory(resolve, reject) 执行时没调用 resolve 方法，那就再这里交给 Promise 对象处理
         */
        if (isUndef(factory.resolved)) {
          res.then(resolve, reject);
        }
      // ② res 为普通 json 对象
      } else if (isDef(res.component) && typeof res.component.then === 'function') {
        // res.component 是一个 Promise 对象，成功后定义 factory.resolved 组件构造函数
        res.component.then(resolve, reject);

        // 定义 factory.errorComp 组件构造函数
        if (isDef(res.error)) {
          factory.errorComp = ensureCtor(res.error, baseCtor);
        }
        
        // 定义 factory.loadingComp 组件构造函数
        if (isDef(res.loading)) {
          factory.loadingComp = ensureCtor(res.loading, baseCtor);
          
          // 等待时间为 0
          if (res.delay === 0) {
            factory.loading = true;
          // 在时间 res.delay 后，若还不能正常渲染，那就用”正在加载中组件“更新视图
          } else {
            // 默认延迟 200 毫秒
            setTimeout(function () {
              // 没有成功，也没有失败，才渲染加载中
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                factory.loading = true;
                forceRender();
              }
            }, res.delay || 200);
          }
        }
        
        // 超出时间 res.timeout 则渲染错误组件
        if (isDef(res.timeout)) {
          setTimeout(function () {
            if (isUndef(factory.resolved)) {
              // reject 函数的实参是错误原因，失败原因是 "timeout (" + (res.timeout) + "ms)"
              reject(
                "timeout (" + (res.timeout) + "ms)"
              );
            }
          }, res.timeout);
        }
      }
    }

    sync = false;
    // return in case resolved synchronously
    /*
      ① factory.loading 为 true，返回组件 factory.loadingComp
      ② 否则，返回 factory.resolved（试一试，也许此时已经有该属性了，没有也没关系）
     */
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}


// 获取第一个子组件
function getFirstComponentChild (children) {
  if (Array.isArray(children)) {
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      // 只要当前 child 有 componentOptions 属性，那就认为它是组件，那就在此返回
      if (isDef(c) && isDef(c.componentOptions)) {
        return c
      }
    }
  }
}

// 事件初始化
function initEvents (vm) {
  vm._events = Object.create(null);
  vm._hasHookEvent = false;
  // init parent attached events
  var listeners = vm.$options._parentListeners;
  // 如果父级事件存在，那就添加到 vm._events 中
  if (listeners) {
    // 更新监听
    updateComponentListeners(vm, listeners);
  }
}

var target;

// 事件绑定
function add (event, fn, once$$1) {
  // 只执行一次
  if (once$$1) {
    target.$once(event, fn);
  } else {
    target.$on(event, fn);
  }
}

// 移除事件
function remove$1 (event, fn) {
  target.$off(event, fn);
}

// 更新组件 listeners
function updateComponentListeners (vm, listeners, oldListeners) {
  target = vm;
  // 更新监听
  updateListeners(listeners, oldListeners || {}, add, remove$1, vm);
}


/*
事件混入 

该方法调用时实参是真正的构造函数
eventsMixin(Vue$3);
*/
function eventsMixin (Vue) {
  var hookRE = /^hook:/;
  // 给 Vue 原型添加 $on 方法，这样 Vue 的实例都可以调用这个方法了
  Vue.prototype.$on = function (event, fn) {
    // 这里的 this$1 和 vm 都是指 Vue 实例
    var this$1 = this;

    var vm = this;
    // event 是数组，递归调用 $on 方法
    if (Array.isArray(event)) {
      for (var i = 0, l = event.length; i < l; i++) {
        this$1.$on(event[i], fn);
      }
    } else {
      /*
      $on 函数最核心的就是这一句，把 fn 添加到 vm._events[event] 数组里即完成了事件的绑定
      
      ① 若 vm._events[event] 不存在，初始化为空数组
      ② 向数组 vm._events[event] 末尾添加 fn
      */
      (vm._events[event] || (vm._events[event] = [])).push(fn);
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        // 标识当前 vm 拥有钩子事件
        vm._hasHookEvent = true;
      }
    }
    // 返回 Vue 实例，所以可以链式调用
    return vm
  };

  // fn 函数只能执行一次
  Vue.prototype.$once = function (event, fn) {
    var vm = this;
    function on () {
      // on 执行时就会将事件解除监听，也就是说，fn 只能执行一次
      vm.$off(event, on);
      fn.apply(vm, arguments);
    }
    on.fn = fn;
    vm.$on(event, on);
    return vm
  };

  // 事件解绑
  Vue.prototype.$off = function (event, fn) {
    var this$1 = this;

    var vm = this;
    // all
    // 如果不传参数，vm.$off() 表示移除所有事件监听。即将 vm._events 对象重置为一个空对象。
    if (!arguments.length) {
      vm._events = Object.create(null);
      return vm
    }
    // array of events
    // 如果 event 是数组，那就递归调用，一个个解除绑定
    if (Array.isArray(event)) {
      for (var i$1 = 0, l = event.length; i$1 < l; i$1++) {
        this$1.$off(event[i$1], fn);
      }
      return vm
    }


    // specific event
    var cbs = vm._events[event];
    // 如果 vm._events[event] 不存在，那说明根本没绑定过该类型事件，直接返回就好了
    if (!cbs) {
      return vm
    }

    // 如果参数长度为 1，如 vm.$off("click") 那就把点击事件全部解绑
    if (arguments.length === 1) {
      // event 类别的事件数组清空
      vm._events[event] = null;
      return vm
    }

    
    // specific handler
    // 以下才是解绑 event 类型的监听函数 fn
    var cb;
    var i = cbs.length;
    while (i--) {
      // cbs = vm._events[event]，是个数组，cb 为函数
      cb = cbs[i];
      // cb === fn 是 $on 方法绑定的，cb.fn === fn 是 $once 方法绑定的，二者其一满足即可
      if (cb === fn || cb.fn === fn) {
        // 从回调函数数组 vm._events[event] 中剔除当前项
        cbs.splice(i, 1);
        break
      }
    }
    return vm
  };

  // 事件触发
  Vue.prototype.$emit = function (event) {
    var vm = this;
    {
      var lowerCaseEvent = event.toLowerCase();
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        /*
        tip 函数的作用是：调用 console.warn 函数发出警告，例如："[Vue tip]: some tip"

        翻译一下提示：
        组件 <AaaBbb>（格式化后的组件名）发出了事件 lowerCaseEvent（全小写字母构成），但是注册的事件类型是 event（非全小写字母构成）。
        需要注意的是 html 属性是大小写不敏感的。我们不能在模板中用 v-on 来监听驼峰写法的事件类型。
        我们应该使用连字符写法。如 hyphenate('aaBbCc') -> "aa-bb-cc"。
        */
        tip(
          "Event \"" + lowerCaseEvent + "\" is emitted in component " +
          (formatComponentName(vm)) + " but the handler is registered for \"" + event + "\". " +
          "Note that HTML attributes are case-insensitive and you cannot use " +
          "v-on to listen to camelCase events when using in-DOM templates. " +
          "You should probably use \"" + (hyphenate(event)) + "\" instead of \"" + event + "\"."
        );
      }
    }
    var cbs = vm._events[event];
    if (cbs) {
      /*
        toArray(list, start) 的作用是将类数组 list 转为真正的数组，start 表示起始索引
        eg: toArray([0, 1, 2, 3, 4, 5, 6], 2) -> [2, 3, 4, 5, 6]
      */
      cbs = cbs.length > 1 ? toArray(cbs) : cbs;
      // 将第一个实参 event 排除掉，剩下的参数真正被回调函数用的实参
      var args = toArray(arguments, 1);
      // 依次执行 vm._events[event] 数组中的回调函数，也就是说执行 event 类型的所有回调函数
      for (var i = 0, l = cbs.length; i < l; i++) {
        try {
          // 执行的实参是 $emit 方法除了参数 event 以外的其他参数
          cbs[i].apply(vm, args);
        } catch (e) {
          // 如果出错，发出提示
          handleError(e, vm, ("event handler for \"" + event + "\""));
        }
      }
    }
    return vm
  };
}

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 */
// 插槽处理
function resolveSlots (children, context) {
  var slots = {};
  // children 不存在，就返回空对象
  if (!children) {
    return slots
  }

  var defaultSlot = [];
  for (var i = 0, l = children.length; i < l; i++) {
    var child = children[i];
    // named slots should only be respected if the vnode was rendered in the
    // same context.
    // 命名插槽。只有几个 vnode 在同一个上下文中渲染，才会注意命名插槽。
    if ((child.context === context || child.functionalContext === context) &&
      child.data && child.data.slot != null
    ) {
      // 插槽名
      var name = child.data.slot;
      // 如果 slots[name] 不存在，那就将 slots[name] 初始化一个空数组
      var slot = (slots[name] || (slots[name] = []));
      /*
      ① 如果 child 是 template，那就将 child.children 都加到数组 slot 中
      ② 否则，仅仅将 child 加到数组 slot 中
      */
      if (child.tag === 'template') {
        // 之所以这么写，是因为 push 方法不接受数组参数，其用法为 arrayObject.push(newelement1,newelement2,....,newelementX)
        slot.push.apply(slot, child.children);
      } else {
        slot.push(child);
      }
    } else {
      // 不是命名插槽，就是匿名的默认插槽
      defaultSlot.push(child);
    }
  }
  // ignore whitespace
  // every 方法，只有数组中所有项全部满足才会返回 true
  if (!defaultSlot.every(isWhitespace)) {
    // 数组 defaultSlot 的每一项都是注释或空白文本
    slots.default = defaultSlot;
  }
  /*
  于是，slots 结构大致为：
  {
    default : [...],
    name1 : [...],
    name2 : [...],
    ...
  }
  注意，每一个插槽名都对应一个数组，存放多个元素。如子组件 app-layout 模板：
   <div class="container">
       <header>
            <slot name="header"></slot>
       </header>
       <main>
            <slot></slot>
       </main>
       <footer>
            <slot name="footer"></slot>
       </footer>
   </div>

  父组件模板：
   <div>
       <app-layout>
           <h1 slot="header">这里是一个页面标题</h1>
           <h1 slot="header">这里是另一个页面标题</h1>

           <p>主要内容的一个段落。</p>
           <p>另一个主要段落。</p>

           <p slot="footer">这里有一些联系信息</p>
           <p slot="footer">这里有另一些联系信息</p>
       </app-layout>
   </div>

   不管是命名插槽还是匿名插槽都可以对应多个节点
   */
  return slots
}

// 是否为注释节点或文本为空
function isWhitespace (node) {
  return node.isComment || node.text === ' '
}

// 作用域插槽处理
function resolveScopedSlots (
  fns, // see flow/vnode
  res
) {
  // res 不存在则初始化为空对象
  res = res || {};
  for (var i = 0; i < fns.length; i++) {
    // fns[i] 是数组，递归调用 resolveScopedSlots 方法
    if (Array.isArray(fns[i])) {
      resolveScopedSlots(fns[i], res);
    // 一般情况下，fns[i] 是个对象 {key : keyVal, fn : fnVal}
    } else {
      res[fns[i].key] = fns[i].fn;
    }
  }
  /*
      于是，res 的结构大致如下：
      {
        keyVal1 : fnVal1,
        keyVal2 : fnVal2,
        keyVal3 : fnVal3,
        ...
      }
  */
  return res
}

/*  */

var activeInstance = null;
var isUpdatingChildComponent = false;

// 初始化生命周期
function initLifecycle (vm) {
  var options = vm.$options;

  // locate first non-abstract parent
  var parent = options.parent;
  
  if (parent && !options.abstract) {
    // 层层上溯修正 parent，找到第一个非抽象父元素
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent;
    }
    // 将当前 vm 添加到第一个非抽象父元素的 parent.$children 数组中，也就是 vm 作为第一个非抽象父元素的"子元素"
    parent.$children.push(vm);
  }

  // 非抽象父元素
  vm.$parent = parent;
  // 当前组件树的根 Vue 实例。如果当前实例没有父实例，此根 Vue 实例将会是其自己
  vm.$root = parent ? parent.$root : vm;

  // 当前实例的直接子组件
  vm.$children = [];
  // 已注册过 ref 的所有子组件
  vm.$refs = {};
  /*
  ref 被用来给元素或子组件注册引用信息。引用信息将会注册在父组件的 $refs 对象上。
  ① 如果在普通的 DOM 元素上使用，引用指向的就是 DOM 元素；
     <p ref="p">hello</p>
     vm.$refs.p 指当前 dom 节点

  ② 如果用在子组件上，引用就指向组件实例：
     <child-comp ref="child"></child-comp>
     vm.$refs.child 指当前组件实例
  */

  // 状态信息初始化
  vm._watcher = null;
  vm._inactive = null;
  vm._directInactive = false;
  vm._isMounted = false;
  vm._isDestroyed = false;
  vm._isBeingDestroyed = false;
}

// 生命周期混入
function lifecycleMixin (Vue) {
  // 更新
  Vue.prototype._update = function (vnode, hydrating) {
    var vm = this;

    // 如果已经插入到文档中，那么更新之前调用 beforeUpdate 钩子回调函数
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate');
    }

    // 保存更新之前的节点信息
    var prevEl = vm.$el;
    var prevVnode = vm._vnode;
    var prevActiveInstance = activeInstance;


    // 当前被激活的 Vue 实例
    activeInstance = vm;
    vm._vnode = vnode;
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    /*
    参考：https://www.zhihu.com/question/29504639
    Virtual DOM 算法主要是实现上面步骤的三个函数：element，diff，patch

    1. 构建虚拟 DOM
    var tree = el('div', {'id': 'container'}, [
        el('h1', {style: 'color: blue'}, ['simple virtal dom']),
        el('p', ['Hello, virtual-dom']),
        el('ul', [el('li')])
    ])

    2. 通过虚拟 DOM 构建真正的 DOM
    var root = tree.render()
    document.body.appendChild(root)

    3. 生成新的虚拟 DOM
    var newTree = el('div', {'id': 'container'}, [
        el('h1', {style: 'color: red'}, ['simple virtal dom']),
        el('p', ['Hello, virtual-dom']),
        el('ul', [el('li'), el('li')])
    ])

    4. 比较两棵虚拟 DOM 树的不同
    var patches = diff(tree, newTree)

    5. 在真正的 DOM 元素上应用变更
    patch(root, patches)

    这里的 patch 方法就是下面的 __patch__ 方法
    */
    // 初始化渲染
    if (!prevVnode) {
      // initial render。其中 vm.$el 是真实 dom 节点，vnode 是虚拟 dom 节点
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */, vm.$options._parentElm, vm.$options._refElm);
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      // 初始化后，就不需要这俩引用了。释放之，以防止独立的 dom 树保存在内存中。
      vm.$options._parentElm = vm.$options._refElm = null;
    // 更新
    } else {
      // updates
      // 比较新旧虚拟 DOM，并更新。数据更新就是由这一句关键代码完成！
      vm.$el = vm.__patch__(prevVnode, vnode);
    }

    // 更新完毕，把活动节点标记还原
    activeInstance = prevActiveInstance;

    // update __vue__ reference
    // 更新 prevEl 和 vm.$el 的 __vue__ 属性
    if (prevEl) {
      prevEl.__vue__ = null;
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm;
    }

    // if parent is an HOC, update its $el as well。其中 HOC -> High Order Component -> 高阶组件
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      // 父组件的 $el 属性也指向当前组件的 $el
      vm.$parent.$el = vm.$el;
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  };

  // 强制更新
  Vue.prototype.$forceUpdate = function () {
    var vm = this;
    if (vm._watcher) {
      vm._watcher.update();
    }
  };

  // 实例销毁
  Vue.prototype.$destroy = function () {
    var vm = this;
    // 如果已经开始销毁了，那就返回吧
    if (vm._isBeingDestroyed) {
      return
    }
    // 调用 beforeDestroy 钩子回调
    callHook(vm, 'beforeDestroy');
    // 标志开始销毁
    vm._isBeingDestroyed = true;
    // remove self from parent
    var parent = vm.$parent;
    // 从父组件中移除当前实例
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm);
    }

    // teardown watchers
    if (vm._watcher) {
      vm._watcher.teardown();
    }
    var i = vm._watchers.length;
    while (i--) {
      // 依次执行 teardown 函数
      vm._watchers[i].teardown();
    }

    // remove reference from data ob
    // frozen object may not have observer.
    // Observer 实例的 vmCount 属性减一
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--;
    }
    // call the last hook...
    // 标志当前实例被销毁了
    vm._isDestroyed = true;
    // invoke destroy hooks on current rendered tree
    // 更新虚拟 dom 树
    vm.__patch__(vm._vnode, null);
    // fire destroyed hook
    // 触发销毁完毕钩子回调
    callHook(vm, 'destroyed');
    // turn off all instance listeners.
    // 移除所有事件监听
    vm.$off();
    // remove __vue__ reference
    if (vm.$el) {
      // 移除 __vue__ 引用
      vm.$el.__vue__ = null;
    }
  };
}

/*
    vm.$mount() 手动地挂载一个未挂载的实例
    a. 参数为元素选择器，挂载到该元素，替换的该元素内容
    var MyComponent = Vue.extend({
      template: '<div>Hello!</div>'
    })
    new MyComponent().$mount('#app')

    b. 参数为空/undefined，在文档之外渲染，随后再挂载
    var component = new MyComponent().$mount()
    document.getElementById('app').appendChild(component.$el)
 */
// 安装组件
function mountComponent (vm, el, hydrating) {
  vm.$el = el;
  // 没有自定义 render 方法
  if (!vm.$options.render) {
    // 指向 createEmptyVNode 方法
    vm.$options.render = createEmptyVNode;
    {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') || vm.$options.el || el) {
          /*
            发出警告：你正在用只包含运行时的版本，这个版本的模板编译器是不可用的。可采取的方式有两种：
            ① 将模板预编译成渲染函数；
            ② 用包含模板编译器的版本
          */
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        );
      } else {
            // 警告，组件安装失败：未定义模板或者渲染函数
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        );
      }
    }
  }
  // 调用 beforeMount 钩子回调
  callHook(vm, 'beforeMount');

  var updateComponent;
  /* istanbul ignore if */
  /*
    ① 开发版本下，做性能统计
    ② mark 方法用来给相应的视点做标记。结合 performance.measure() 使用也可以算出各个时间段的耗时
  */
  if ("development" !== 'production' && config.performance && mark) {
    updateComponent = function () {
      var name = vm._name;
      var id = vm._uid;
      var startTag = "vue-perf-start:" + id;
      var endTag = "vue-perf-end:" + id;

      mark(startTag);
      var vnode = vm._render();
      mark(endTag);
      // 计算渲染耗时
      measure((name + " render"), startTag, endTag);

      mark(startTag);
      vm._update(vnode, hydrating);
      mark(endTag);
      // 计算更新耗时
      measure((name + " patch"), startTag, endTag);
    };
  } else {
    /*
        生产环境下，直接渲染、更新

        其实，跟上面的 if 块一样，注意执行这两句：
        var vnode = vm._render();
        vm._update(vnode, hydrating);

	    其中，vm._render() 的作用就是生成虚拟节点 vnode
    */
    updateComponent = function () {
      // 根据新的 vnode 对 dom 进行更新
      vm._update(vm._render(), hydrating);
    };
  }

  // 添加观察者实例。所以 vm._watcher 是一个 watcher 实例。
  vm._watcher = new Watcher(vm, updateComponent, noop);
  hydrating = false;

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  /*
        并不是执行 vm.$mount() 方法一定会将 vm 组件挂载到文档中
        参数为空/undefined，在文档之外渲染，随后再挂载例如：
        var component = new MyComponent().$mount()
        document.getElementById('app').appendChild(component.$el)

        $vnode 为 vm 在父树种的占位节点，现在占位节点为 null，就是安装成功了
   */
  if (vm.$vnode == null) {
    vm._isMounted = true;
    // 安装成功回调
    callHook(vm, 'mounted');
  }
  return vm
}

// 更新子组件
function updateChildComponent (
  vm,
  propsData,
  listeners,
  parentVnode,
  renderChildren
) {
  {  
    // 标志正在更新子组件
    isUpdatingChildComponent = true;
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  var hasChildren = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    parentVnode.data.scopedSlots || // has new scoped slots
    vm.$scopedSlots !== emptyObject // has old scoped slots
  );

  // ① 更新父节点
  vm.$options._parentVnode = parentVnode;
  vm.$vnode = parentVnode; // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode;
  }

  // ② 更新子节点
  vm.$options._renderChildren = renderChildren;

  // update $attrs and $listensers hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data && parentVnode.data.attrs;
  vm.$listeners = listeners;

  // update props
  // ③ 更新 props
  if (propsData && vm.$options.props) {
    observerState.shouldConvert = false;
    var props = vm._props;
    var propKeys = vm.$options._propKeys || [];
    for (var i = 0; i < propKeys.length; i++) {
      var key = propKeys[i];
      props[key] = validateProp(key, vm.$options.props, propsData, vm);
    }
    observerState.shouldConvert = true;
    // keep a copy of raw propsData
    vm.$options.propsData = propsData;
  }

  // update listeners
  // ④ 更新监听 listeners
  if (listeners) {
    var oldListeners = vm.$options._parentListeners;
    vm.$options._parentListeners = listeners;
    updateComponentListeners(vm, listeners, oldListeners);
  }
  // resolve slots + force update if has children
  // ⑤ 更新插槽
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context);
    vm.$forceUpdate();
  }

  {
    // 标志子组件不在更新状态
    isUpdatingChildComponent = false;
  }
}

// 是否在非活动树中
function isInInactiveTree (vm) {
  // 从父元素开始依次遍历祖先实例，只要有一个祖先实例拥有 _Inactive 属性，就返回 true
  while (vm && (vm = vm.$parent)) {
    // 只要有一个失效父元素，就返回 true
    if (vm._inactive) { return true }
  }
  return false
}

// 激活子组件
function activateChildComponent (vm, direct) {
  if (direct) {
    vm._directInactive = false;
    // 如果当前 vm 在非活动树中，那就什么都不做，返回！
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    // 取消失效状态
    vm._inactive = false;
    
    for (var i = 0; i < vm.$children.length; i++) {
      // 递归激活子组件
      activateChildComponent(vm.$children[i]);
    }
    // 组件被激活钩子回调
    callHook(vm, 'activated');
  }
}

/*
    组件失效和组件销毁对应的（componentVNodeHooks.destroy() 方法中看得清楚）：
    // ① 不需要 keepAlive，直接销毁
    if (!vnode.data.keepAlive) {
      componentInstance.$destroy()
    // ② 需要 keepAlive，那就标记失效
    } else {
      deactivateChildComponent(componentInstance, true)
    }
 */
// 使子组件失效
function deactivateChildComponent (vm, direct) {
  if (direct) {
    vm._directInactive = true;
    // 如果当前 vm 在非活动树中，那就什么都不做，返回！
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    // 标志失效状态
    vm._inactive = true;
    for (var i = 0; i < vm.$children.length; i++) {
      // 递归使子组件失效
      deactivateChildComponent(vm.$children[i]);
    }
    // 组件失效钩子回调
    callHook(vm, 'deactivated');
  }
}

/*
     比如，传进来的钩子名是 'beforeUpdate'，而之前我们还监听了事件 'hook:beforeUpdate'
     那么，callHook(vm,'evtA') 会导致：
     ① 执行钩子 'beforeUpdate' 的所有回调函数
     ② 执行事件 'hook:beforeUpdate' 的所有回调函数
  */
function callHook (vm, hook) {
  // 钩子处理函数
  var handlers = vm.$options[hook];
  if (handlers) {
    for (var i = 0, j = handlers.length; i < j; i++) {
      try {
        // this 绑定到 vm 上执行 handlers[i] 方法
        handlers[i].call(vm);
      } catch (e) {
        // 出错了，发出警告
        handleError(e, vm, (hook + " hook"));
      }
    }
  }
  // 触发自定义的钩子回调
  if (vm._hasHookEvent) {
    // eg : vm.$emit('hook:beforeUpdate')
    vm.$emit('hook:' + hook);
  }
}

/*  */


var MAX_UPDATE_COUNT = 100;

var queue = [];
var activatedChildren = [];
var has = {};
var circular = {};
var waiting = false;
var flushing = false;
var index = 0;

/**
 * Reset the scheduler's state.
 */
// 重置调度状态，以上所有状态信息都重置为默认值
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0;
  has = {};
  {
    circular = {};
  }
  waiting = flushing = false;
}

/**
 * Flush both queues and run the watchers.
 */
// flush 调度队列
function flushSchedulerQueue () {
  // 标志正在 flush
  flushing = true;
  var watcher, id;


 
  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.

  /*
     在 flush 之前，对 queue 进行排序，原因有三：
     1. 组件更新时从父组件到子组件的顺序（因为父组件会比子组件先创建）
     2. 组件的自定义 watcher 会比渲染 watcher 先执行计算（因为自定义 watcher 先创建）
     3. 如果某个组件在父组件的 watcher 执行期间被销毁了，那么这个组件的 watcher 就可以不执行了
  */

  queue.sort(function (a, b) { return a.id - b.id; });

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 这里没有对 queue.length 进行缓存，是因为在循环过程中，可能还会有新的 watcher 加入到 queue 中
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index];
    id = watcher.id;
    has[id] = null;
    /*
        ① 计算 watcher 最新的值，value = watcher.get() -> value = watcher.getter.call(vm, vm) 
        ② 若新值与旧值不一样，就执行回调函数 watcher.cb.call(watcher.vm, value, oldValue)
     */
    watcher.run();

    /*
        ① 前面说过，这个 queue 在循环执行过程中是可以动态更新的，也就是允许新的 watcher 入队
        ② 若执行 watcher.run() 过程中，又执行 queueWatcher() 将这个 watcher 入队了，于是 has[id] = true
        ③ 那就把 circular[id] 加 1，表示这个 watcher 又 run 了一次
        ④ 若在这个 for 循环某个 watcher run 的次数超过了 MAX_UPDATE_COUNT（这里是 100 次），那就可能出现了无限循环，立即终止循环
     */
    if ("development" !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1;
      // 超过 100，发出警告
      if (circular[id] > MAX_UPDATE_COUNT) {
        // 可能是一个无限循环...
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? ("in watcher with expression \"" + (watcher.expression) + "\"")
              : "in a component render function."
          ),
          watcher.vm
        );
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  // 深拷贝一份副本
  var activatedQueue = activatedChildren.slice();
  var updatedQueue = queue.slice();

  // 重置所有状态
  resetSchedulerState();

  // call component updated and activated hooks
  // 调用激活钩子和更新钩子
  callActivatedHooks(activatedQueue);
  callUpdatedHooks(updatedQueue);

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush');
  }
}

// 调用 updated 钩子
function callUpdatedHooks (queue) {
  var i = queue.length;
  // 遍历 watcher，调用对应 vm 的 updated 钩子回调
  while (i--) {
    var watcher = queue[i];
    var vm = watcher.vm;
    /*
        ① 若该 watcher 是渲染 watcher，即 watcher === watcher.vm._watcher
        ② watcher.vm 已经在 dom 中渲染过了

        ① 和 ② 同时满足，说明是 dom 更新，那就触发 updated 钩子
     */
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated');
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
// 将 vm 添加到 activatedChildren 数组中
function queueActivatedComponent (vm) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  // 将 _inactive 置为 false，渲染函数可以根据这个值来判断 vm 是否在非活动树中
  vm._inactive = false;
  activatedChildren.push(vm);
}

// 调用激活钩子，这里的 queue 是由 vm 组成的数组
function callActivatedHooks (queue) {
  for (var i = 0; i < queue.length; i++) {
    queue[i]._inactive = true;
    // 激活子组件，queue[i] 就是 vm
    activateChildComponent(queue[i], true /* true */);
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
// 将一个 watcher 添加进 watcher 队列，对于有重复 id 的 watcher 会跳过，除非队列正在 flush。
function queueWatcher (watcher) {
  var id = watcher.id;
  // id 去重
  if (has[id] == null) {
    has[id] = true;
    if (!flushing) {
      // 不在队列 flush 过程中，那就将 watcher 加到队列末尾
      queue.push(watcher);
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      var i = queue.length - 1;
      // queue 在 flush 过程中会将队列元素按 id 值从小到大排序，所以，这里会根据 id 值，修正插入位置索引
      while (i > index && queue[i].id > watcher.id) {
        i--;
      }
      queue.splice(i + 1, 0, watcher);
    }
    // queue the flush
    if (!waiting) {
      waiting = true;
      // 下一帧，调用 flush 调度队列
      nextTick(flushSchedulerQueue);
    }
  }
}

/*  */

var uid$2 = 0;

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// Watcher 实例用来解析表达式、收集 Dep 依赖，以及当表达式值变化时触发回调函数。$watch() 方法和指令中将会用的。
// 参考 initComputed 方法来理解 Watcher 函数
 /*
    为什么新建一个 watcher 就可以起到观察表达式/函数的作用呢？

    / 新建 Vue 实例
    vm = new Vue({
      data : {
        aaa : {
            bbb : {
                ccc : {
                    ddd : 1
                }
            }
        }
      }
    });

    // 新建 watcher
    var watcher = new Watcher(vm, 'aaa.bbb.ccc' , cb, options);

    理一理这个 watcher 工作的基本流程：

    (1) 执行 watcher = new Watcher() 会定义 watcher.getter = parsePath('aaa.bbb.ccc')（这是一个函数，稍后会解释），同时也会定义 watcher.value = watcher.get()，而这会触发执行 watcher.get()
    (2) 执行 watcher.get() 就是执行 watcher.getter.call(vm, vm)
    (3) parsePath('aaa.bbb.ccc').call(vm, vm) 会触发 vm.aaa.bbb.ccc 属性读取操作
    (5) vm.aaa.bbb.ccc 属性读取会触发 aaa.bbb.cc 属性的 get 函数（在 defineReactive$$1 函数中定义）
    (6) get 函数会触发 dep.depend()，也就是 Dep.target.addDep(dep)，即把 Dep.target 这个 Watcher 实例添加到 dep.subs 数组里（也就是说，dep 可以发布消息通知给订阅者 Dep.target）
    (7) 那么 Dep.targe 又是什么呢？其实 (2) 中执行 watcher.get() 之前已经将 Dep.target 锁定为当前 watcher（等到 watcher.get() 执行结束时释放 Dep.target）
    (8) 于是，watcher 就进入了 aaa.bbb.ccc 属性的订阅数组，也就是说 watcher 这个订阅者订阅了 aaa.bbb.ccc 属性
    (9) 当给 aaa.bbb.ccc 属性赋值时，如 vm.aaa.bbb.ccc = 100 会触发 vm 的 aaa.bbb.ccc 属性的 set 函数（在 defineReactive$$1 函数中定义）
    (10) set 函数触发 dep.notify()
    (11) 执行 dep.notify() 就会遍历 dep.subs 中的所有 watcher，并依次执行 watcher.update()
    (12) 执行 watcher.update() 又会触发 watcher.run()
    (13) watcher.run() 触发 watcher.cb.call(watcher.vm, value, oldValue);
*/
/*
    一个 watcher 实例主要做以下几件事：
    ① 解析表达式 expOrFn，它可能是字符串形式的表达式或者是函数
    ② 收集主题 deps。watcher 取值过程中若获取某个”活性“属性 key，那么就说明这个 watcher 对属性 key 感兴趣，就把 watcher 和 key 的 dep 互相”关注“
    ③ 当 expOrFn 变化时，就能触发回调函数 cb 执行
 */
var Watcher = function Watcher (vm, expOrFn, cb, options) {
  // 当前 watcher 的 vm 属性指向 vm
  this.vm = vm;
  // vm._watchers 数组专门用来存放跟当前 vm 相关的所有 watcher。
  vm._watchers.push(this);

  // options
  if (options) {
    this.deep = !!options.deep;
    this.user = !!options.user;
    this.lazy = !!options.lazy;
    this.sync = !!options.sync;
  } else {
    this.deep = this.user = this.lazy = this.sync = false;
  }
  this.cb = cb;
  // id 递增，值唯一
  this.id = ++uid$2; // uid for batching
  this.active = true;
  this.dirty = this.lazy; // for lazy watchers
  this.deps = [];
  this.newDeps = [];
  this.depIds = new _Set();
  this.newDepIds = new _Set();
  // 表达式转为字符串形式
  this.expression = expOrFn.toString();
  // parse expression for getter
  // ① 如果 expOrFn 是函数，那么 this.getter = expOrFn
  if (typeof expOrFn === 'function') {
    this.getter = expOrFn;
  // ② 如果 expOrFn 是表达式，那么 this.getter = parsePath(expOrFn) 也是函数，根据这个函数可以定位到 vm 的某个元素
  } else {
    /*
    结合 parsePath 定义看：
    eg：
    path = 'aaa.bbb.ccc' 
    -> segments = path.split('.')
    -> segments = ["aaa", "bbb", "ccc"]

    this.getter = parsePath(path) = function (obj) {
      for (var i = 0; i < segments.length; i++) {
        if (!obj) { return }
        obj = obj[segments[i]];
      }
      return obj
    };

    eg:
    var vm = {
        aaa : {
            bbb : {
                ccc : {
                    ddd : 1
                }
            }
        }
     }

     this.getter(vm) -> vm.aaa.bbb.ccc -> {ddd: 1}

     vm.aaa.bbb.ccc 这个获取属性的操作会触发对于的 get 函数（在 defineReactive$$1 函数中定义）
    */
    this.getter = parsePath(expOrFn);
    if (!this.getter) {
      this.getter = function () {};
      // 走到这里，说明路径不合符。只有 . 分隔的路径才是合法的。
      "development" !== 'production' && warn(
        "Failed watching path: \"" + expOrFn + "\" " +
        'Watcher only accepts simple dot-delimited paths. ' +
        'For full control, use a function instead.',
        vm
      );
    }
  }
  /*
    vm._watcher = new Watcher(vm, updateComponent, noop)
    这句代码会执行 updateComponent 函数，原因如下：

    分解上面的 new 运算符执行过程：
    vm._watcher = {}；
    vm._watcher._proto__ = Vue$3.prototype;
    ...
    vm._watcher.value = vm._watcher.get();

    vm._watcher.get() 会触发 vm._watcher.getter()，即 updateComponent()
   */
  this.value = this.lazy ? undefined : this.get();
};

/**
 * Evaluate the getter, and re-collect dependencies.
 */
Watcher.prototype.get = function get () {
  // 旧的 Dep.target 压栈，当前 watcher 实例作为新的 Dep.target
  pushTarget(this);
  var value;
  var vm = this.vm;
  try {
    // this.getter 执行时的 this 和实参都为 vm
    /*
      例如：
      var vm = new Vue({
        data : {
            a : 1
        }
      });

      对于 expOrFn = 'a'
      this.getter = parsePath('a')

      参考函数 parsePath 的定义，this.getter 可理解为：
      function (obj) {
        obj = obj['a'];
        return obj
      }

      于是 this.getter.call(vm, vm)
      -> vm.a

      【重要】这里属性获取操作触发当前 Watcher 实例对 vm.a 属性的订阅

      这里对 vm.a 的属性读取会触发 defineReactive$$1 函数中对 vm 的 a 属性的 get 操作的拦截
      于是当前 Watcher 实例会订阅 a 属性的变化（添加到 dep.subs 数组里）
     */
    value = this.getter.call(vm, vm);
  } catch (e) {
    if (this.user) {
      handleError(e, vm, ("getter for watcher \"" + (this.expression) + "\""));
    } else {
      throw e
    }
  } finally {
    // "touch" every property so they are all tracked as
    // dependencies for deep watching
    if (this.deep) {
      traverse(value);
    }
    // 恢复旧的 Dep.target
    popTarget();
    // 清除 dependency collection
    this.cleanupDeps();
  }
  return value
};
/**
 * Add a dependency to this directive.
 */
/*
      新增一个 dep：
      ① 订阅者 watcher 添加主题 dep（每个订阅者也可以订阅多个主题）
      ② 若发现 watcher.depIds 列表里没有 dep.id，那就调用 dep.addSub(watcher)，即 dep 主题添加订阅者 watcher
   
      这是一个互相关注的操作。订阅者有一个主题列表，主题也有一个订阅者列表。
*/
Watcher.prototype.addDep = function addDep (dep) {
  var id = dep.id;
  // 注意新添加的 id/dep 是加入到 this.newDepIds/this.newDeps 中，而不是 this.depIds/this.deps
  if (!this.newDepIds.has(id)) {
    this.newDepIds.add(id);
    this.newDeps.push(dep);

    /*
          ① this.depIds 中没有 dep.id，说明 this 还不在 dep 的订阅者列表里，那就加进去
          ② 反过来看，这次 this.newDepIds 把 dep.id 加进去了，等 this.newDepIds 替换 this.depIds 后，this.depIds 中就有这个 dep.id 了，所以不会重新订阅
    */
    if (!this.depIds.has(id)) {
      // 添加订阅者。将当前 watcher 加入到 dep.subs 数组里
      dep.addSub(this);
    }
  }
};

/**
 * Clean up for dependency collection.
 */
/*
    两件事：
    1. 对于 watcher 已经关注了的 watcher.deps 这组主题，逐一检查
       若某个 dep.id 没有出现在 watcher.newDepIds 这个重新收集的集合里，说明 watcher 对这个主题不再关注了，那就取消关注
    2. 用重新收集的 newDeps/newDepIds 替换旧的 deps/depIds
*/
Watcher.prototype.cleanupDeps = function cleanupDeps () {
  var this$1 = this;

  var i = this.deps.length;
  while (i--) {
    var dep = this$1.deps[i];
    // 若 newDepIds 中没有 dep.id，说明这个 watcher 不再对这个 dep 感兴趣了
    if (!this$1.newDepIds.has(dep.id)) {
      // 当前 watcher 从 dep 的订阅列表中移除
      dep.removeSub(this$1);
    }
  }

  /*
      ① 更新 dep.id 组成的集合
      这样没有创建新的集合，便完成了两个集合内容的交换。
  */ 
  var tmp = this.depIds;
  this.depIds = this.newDepIds;
  this.newDepIds = tmp;
  this.newDepIds.clear();

  /*
      ② 更新 dep 组成的数组
      这样没有创建新的数组，便完成了两个数组内容的交换。
  */ 
  tmp = this.deps;            // 将中间变量 tmp 指向 this.deps 数组
  this.deps = this.newDeps;   // 将 this.deps 指向 this.newDeps 数组
  this.newDeps = tmp;         // 将 this.newDeps 指向 tmp，也就是指向 this.deps 数组
  this.newDeps.length = 0;    // 将 this.newDeps 数组清空
};

/**
 * Subscriber interface.
 * Will be called when a dependency changes.
 */
Watcher.prototype.update = function update () {
  // ① dirty 置为 true
  if (this.lazy) {
    // 计算属性必须 dirty 为 true 才会重新计算
    this.dirty = true
  // ② 同步执行 run() 
  } else if (this.sync) {
    this.run()
  // ③ watcher 入队，异步执行 watcher.run()
  } else {
    queueWatcher(this)
  }
};

/**
 * Scheduler job interface.
 * Will be called by the scheduler.
 */
Watcher.prototype.run = function run () {
  // 当前 watcher 有效
  if (this.active) {
    var value = this.get();
    if (
      value !== this.value ||
      // Deep watchers and watchers on Object/Arrays should fire even
      // when the value is the same, because the value may
      // have mutated.
      // value 为引用类型的对象/数组时，即便引用不变，其值还是可能改变的
      isObject(value) ||
      this.deep
    ) {
      // set new value
      var oldValue = this.value;
      // 更新 this.value
      this.value = value;

      // 执行 this.cb 方法
      if (this.user) {
        try {
          this.cb.call(this.vm, value, oldValue);
        } catch (e) {
          handleError(e, this.vm, ("callback for watcher \"" + (this.expression) + "\""));
        }
      } else {
        this.cb.call(this.vm, value, oldValue);
      }
    }
  }
};

/**
 * Evaluate the value of the watcher.
 * This only gets called for lazy watchers.
 */
// lazy 观察器会用到这个方法
Watcher.prototype.evaluate = function evaluate () {
  this.value = this.get();
  this.dirty = false;
};

/**
 * Depend on all deps collected by this watcher.
 */
Watcher.prototype.depend = function depend () {
    var this$1 = this;

  var i = this.deps.length;
  while (i--) {
    /*
    看看 Dep.prototype.depend : function(){
        if (Dep.target) {
          Dep.target.addDep(this)
        }
    }
    
    所以，Watcher.prototype.depend 的作用是：
    遍历 this.deps，然后对每一个 dep 执行 Dep.target.addDep(dep)
    这可能会导致 Dep.target 关注 dep

    这也算对 this.deps 的每一个主题 dep 做一个整理吧，可能使得 Dep.target 关注这里的每一个 dep
   */
    this$1.deps[i].depend();
  }
};

/**
 * Remove self from all dependencies' subscriber list.
 */
// 从所有依赖的订阅列表中移除
Watcher.prototype.teardown = function teardown () {
    var this$1 = this;

  if (this.active) {
    // remove self from vm's watcher list
    // this is a somewhat expensive operation so we skip it
    // if the vm is being destroyed.
    // 从 vm 的 watcher 列表移除当前 watcher。这是个有点昂贵的操作，所以，如果 vm 正在被销毁，就跳过这个操作。
    if (!this.vm._isBeingDestroyed) {
      remove(this.vm._watchers, this);
    }
    var i = this.deps.length;
    // 依次从各个 dep 的订阅者数组中移除当前 watcher
    while (i--) {
      this$1.deps[i].removeSub(this$1);
    }
    // 标志当前 watcher 已经失效
    this.active = false;
  }
};

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
// 递归 traverse 对象来唤起所有转换的 getters。这样可以使得这个对象的每个嵌套属性作为一个 deep 依赖被收集。
var seenObjects = new _Set();
// 先将 seenObjects 清空，然后将 val.__ob__.dep.id 添加到 seenObjects 中
function traverse (val) {
  seenObjects.clear();
  _traverse(val, seenObjects);
}

// 将 val.__ob__.dep.id 添加到 seenObjects 中
function _traverse (val, seen) {
  var i, keys;
  var isA = Array.isArray(val);
  /*
   ① val 不是数组也不是对象，返回；
   ② val 不可扩展，返回。
  */
  if ((!isA && !isObject(val)) || !Object.isExtensible(val)) {
    return
  }
  // __ob__ 是一个 Observer 实例，将 val.__ob__.dep.id 添加到 seenObjects 中
  if (val.__ob__) {
    var depId = val.__ob__.dep.id;
    if (seen.has(depId)) {
      return
    }
    // 整个函数核心就是这一句
    seen.add(depId);
  }
  // val 是数组，递归调用
  if (isA) {
    i = val.length;
    while (i--) { _traverse(val[i], seen); }
  // val 是对象，也是递归调用
  } else {
    keys = Object.keys(val);
    i = keys.length;
    while (i--) { _traverse(val[keys[i]], seen); }
  }
}

// 共享属性
var sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
};

// 给 target 对象定义属性 key，用 target[sourceKey][key] 代理 target[key] 
function proxy (target, sourceKey, key) {
  sharedPropertyDefinition.get = function proxyGetter () {
    // 这里的 this 指 target，可以通过打印 console.log('this === target:',this === target) 来验证
    return this[sourceKey][key]
  };
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val;
  };
  /*
    ① target.key 实际执行函数 (function() { return this[sourceKey][key] }).bind(target)
    ② target.key = val 实际执行函数 (function() { this[sourceKey][key] = val }).bind(target)
  */
  Object.defineProperty(target, key, sharedPropertyDefinition);
}

// 初始化状态
function initState (vm) {
  vm._watchers = [];
  var opts = vm.$options;
  // 初始化属性，将 props 挂载到 vm._props 对象上
  if (opts.props) { initProps(vm, opts.props); }
  // 初始化方法，将 methods 挂载到 vm 对象上
  if (opts.methods) { initMethods(vm, opts.methods); }

  // 初始化 data，将 data 挂载到 vm._data 对象上
  if (opts.data) {
    initData(vm);
  } else {
    // 观察 vm._data 对象
    observe(vm._data = {}, true /* asRootData */);
  }

  // 初始化 computed，将对应的 Watcher 实例挂载到 vm._computedWatchers 对象上
  if (opts.computed) { initComputed(vm, opts.computed); }

  /*
  火狐浏览器有原生的 watch 方法
  var nativeWatch = ({}).watch;

  初始化 watch
  */
  if (opts.watch && opts.watch !== nativeWatch) {
    // 观察 opts.watch 的每一个值/表达式
    initWatch(vm, opts.watch);
  }
}

// 检查类型，若 vm.$options[name] 不是对象，则发出警告
function checkOptionType (vm, name) {
  var option = vm.$options[name];
  // option 为普通对象（不包括 null）
  if (!isPlainObject(option)) {
    warn(
      ("component option \"" + name + "\" should be an object."),
      vm
    );
  }
}

// 初始化 props，props 挂载到 vm._props 对象上
function initProps (vm, propsOptions) {
  /*
    var vm = new Comp({
      propsData: {
        msg: 'hello'
      }
    })
    创建实例时传递 props。主要作用是方便测试
   */
  var propsData = vm.$options.propsData || {};
  var props = vm._props = {};
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 缓存属性 key 值，方便以后属性更新的时候可以用数组来迭代，而不是动态的枚举对象的 key 值
  var keys = vm.$options._propKeys = [];
  // 没有父实例，就认为是根实例
  var isRoot = !vm.$parent;
  // root instance props should be converted
  // 根实例的 props 应该被转换
  observerState.shouldConvert = isRoot;
  var loop = function ( key ) {
    keys.push(key);
    // 返回合法的属性值
    var value = validateProp(key, propsOptions, propsData, vm);
    /* istanbul ignore else */
    {
      // 如果 key 值是保留属性名，那就发出警告：保留属性名不能用作组件属性名
      if (isReservedAttribute(key) || config.isReservedAttr(key)) {
        warn(
          ("\"" + key + "\" is a reserved attribute and cannot be used as component prop."),
          vm
        );
      }
      // 在 props 对象上拦截 key 属性的 get/set 操作
      defineReactive$$1(props, key, value, function () {
        if (vm.$parent && !isUpdatingChildComponent) {
          /*
            避免直接地突变一个属性值。因为父组件重新渲染的时候会覆盖这个值。
            推荐的做法是：用 data 或computed 属性。
          */
          warn(
            "Avoid mutating a prop directly since the value will be " +
            "overwritten whenever the parent component re-renders. " +
            "Instead, use a data or computed property based on the prop's " +
            "value. Prop being mutated: \"" + key + "\"",
            vm
          );
        }
      });
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // 静态 props 在 Vue.extend() 中已经代理掉了，这里只需要代理实例上定义的 props 就好了
    if (!(key in vm)) {
      // 用 vm[key] 代理 vm["_props"][key]
      proxy(vm, "_props", key);
    }
  };
  // 遍历 propsOptions
  for (var key in propsOptions) loop( key );
  observerState.shouldConvert = true;
}

/*
  做两件事：
  1. 代理。proxy(vm, "_data", key)，也就是对 vm[key] 的获取和设置实际操作的都是 vm["_data"][key]
  2. 劫持。observe(data, true)，劫持 data 属性的 get/set 操作
 */
function initData (vm) {
  var data = vm.$options.data;

  /*
   ① 如果 data 是函数，那就取这个函数的执行结果；
   ② 否则就取 data（若 data 不存在，取空对象 {}）

   这里给 vm._data 赋值，后面代理了 vm[key] 属性的获取和设置
   也就是 vm["_data"][key] 代理 vm[key]，也就是说访问 vm.message 其实是访问 vm._data.message，设置 vm.message 其实是设置 vm._data.message
  */
  data = vm._data = typeof data === 'function'
	  // getData(data, vm) -> data.call(vm)
    ? getData(data, vm)
    : data || {};
  /*
    注意 === 和 || 运算符的优先级都大于 ? :
    所以如果 data 不是对象，只能说明 getData(data, vm) 的返回值不是对象
   */

  // 如果 data 不是对象，强制转为对象，并发出警告：data 函数应该返回一个对象
  if (!isPlainObject(data)) {
    data = {};
    "development" !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    );
  }
  // proxy data on instance
  var keys = Object.keys(data);
  var props = vm.$options.props;
  var methods = vm.$options.methods;
  var i = keys.length;

  while (i--) {
    var key = keys[i];
    { 
      // data 里的属性名不应该和 methods 里的属性名重复
      if (methods && hasOwn(methods, key)) {
        warn(
          ("method \"" + key + "\" has already been defined as a data property."),
          vm
        );
      }
    }
    // data 里的属性名也不应该和 props 里的属性名重复
    if (props && hasOwn(props, key)) {
      "development" !== 'production' && warn(
        "The data property \"" + key + "\" is already declared as a prop. " +
        "Use prop default value instead.",
        vm
      );
    } else if (!isReserved(key)) {
      // vm[key] 代理 vm["_data"][key]，也就是说访问 vm.message 其实是访问 vm._data.message，设置 vm.message 其实是设置 vm._data.message
      proxy(vm, "_data", key);
    }
  }
  // observe data
  // 劫持 data 对象。asRootData 为 true 表示当前 data 为根数据。
  observe(data, true /* asRootData */);
}

// 通过调用 data 方法返回数据
function getData (data, vm) {
  try {
    return data.call(vm)
  } catch (e) {
    handleError(e, vm, "data()");
    return {}
  }
}

var computedWatcherOptions = { lazy: true };

// 初始化计算属性
function initComputed (vm, computed) {
   // 开发环境下，检查 vm.$options["computed"] 是否为对象，若不是对象，发出警告
  "development" !== 'production' && checkOptionType(vm, 'computed');

  var watchers = vm._computedWatchers = Object.create(null);

  // 遍历 vm.$options["computed"] 对象
  for (var key in computed) {
    var userDef = computed[key];
    // 如果 userDef 不是 function，那就取 userDef.get
    var getter = typeof userDef === 'function' ? userDef : userDef.get;
    { 
      // getter 是 undefined，发出警告，并且把把空函数赋给它
      if (getter === undefined) {
        warn(
          ("No getter function has been defined for computed property \"" + key + "\"."),
          vm
        );
        getter = noop;
      }
    }
    // create internal watcher for the computed property.
    // 为每一个计算属性创建一个 watcher 实例
    watchers[key] = new Watcher(vm, getter, noop, computedWatcherOptions);

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 定义计算属性 key
    if (!(key in vm)) {
      // 将计算属性 key 直接挂在到 vm 对象上，vm[key] 会触发计算属性重算，即执行上面的 getter 方法
      defineComputed(vm, key, userDef);
    } else {
      // 计算属性和 data 属性不能同名
      if (key in vm.$data) {
        warn(("The computed property \"" + key + "\" is already defined in data."), vm);
      // 计算属性和 props 属性也不能同名
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(("The computed property \"" + key + "\" is already defined as a prop."), vm);
      }
    }
  }
}

// 定义计算属性 key。将计算属性 key 直接挂在到 vm 对象上，vm[key] 会触发计算属性重算
function defineComputed (target, key, userDef) {
  // ① userDef 是 function
  if (typeof userDef === 'function') {
    /*
    var sharedPropertyDefinition = {
        enumerable: true,
        configurable: true,
        get: noop,
        set: noop
    };
    */
    sharedPropertyDefinition.get = createComputedGetter(key);
    sharedPropertyDefinition.set = noop;
  // ② userDef 是 { get : function(){}, set : function(){} } 这种形式
  } else {
    /*
        ① userDef.get 存在
           a. userDef.cache 不为 false，取 createComputedGetter(key)
           b. userDef.cache 为 false，取 userDef.get
        ② userDef.get 不存在，取 noop 这个空函数
    */
    sharedPropertyDefinition.get = userDef.get
      ? userDef.cache !== false
        ? createComputedGetter(key)
        : userDef.get
      : noop;

    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop;
  }
  // 给 target 对象添加 key 属性
  Object.defineProperty(target, key, sharedPropertyDefinition);
}

/*
     首先看一下这个函数执行的场景：
     经过 defineComputed(vm, key, userDef) 定义 key 为计算属性后：
     获取 vm[key]
     -> computedGetter()
     -> 如果脏了，就执行 this._computedWatchers[key].evaluate() 重新计算属性值
     -> 返回属性值 this._computedWatchers[key].value
*/
function createComputedGetter (key) {
  return function computedGetter () {
    var watcher = this._computedWatchers && this._computedWatchers[key];
    if (watcher) {
      // 脏检查，必须计算属性的值改变了才会重新计算
      if (watcher.dirty) {
        // 也就是 watcher.value = watcher.get(); watcher.dirty = false;
        watcher.evaluate();
      }
      /*
         某个 watcher 实例执行 get() 方法是，Dep.target 是有值的。
         a. watcher.get() 执行开始时，会执行 pushTarget(watcher) 也就是 Dep.target = watcher;
         a. watcher.get() 执行结束之前，会执行 popTarget() 也就是恢复原来的 Dep.target = targetStack.pop();

         这也印证了作者对 Watcher.prototype.get 函数的注释：
         "Evaluate the getter, and re-collect dependencies."
         计算 getter 并重新收集 dep 依赖

         走到这里，有两点可以确定：
         ① 某个 watcherA 在执行 get()
         ② 正在执行获取 vm[key]

         也就是说，若某个 watcherA 在执行 get() 的过程中（Dep.target 有值），获取了 vm[key]
         -> 说明这个新的动作也对 vm[key] 感兴趣，那就需要重新收集 key 的依赖了
         -> 重新收集 key 对应依赖就是，重新遍历 watcher 的 deps，将 watcher 分别加到各个 dep 的列表里
         -> 于是这个新的动作就可以触发 watcher 重新计算 vm[key] 的属性值
      */
      if (Dep.target) {
        // watcher 对应的所有 dep 添加 watcher 这个订阅者
        watcher.depend();
      }
      // 返回最新的值
      return watcher.value
    }
  }
}

// 初始化 methods，将 methods 挂载到 vm 对象上
function initMethods (vm, methods) {
  // 开发环境下，检查 vm.$options["methods"] 是否为对象，若不是对象，发出警告
  "development" !== 'production' && checkOptionType(vm, 'methods');
  var props = vm.$options.props;
  for (var key in methods) {
    // 将 vm.$options.methods 对象里的函数都挂载到 vm 对象上，并且绑定函数内部 this 为 vm
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm);
    {
      if (methods[key] == null) {
        // 警告：组件定义中的 key 方法未定义。你有正确引用这个方法吗？
        warn(
          "method \"" + key + "\" has an undefined value in the component definition. " +
          "Did you reference the function correctly?",
          vm
        );
      }
      // method 不能和 prop 重名
      if (props && hasOwn(props, key)) {
        // 警告： key 方法已经被定义为一个 prop 了
        warn(
          ("method \"" + key + "\" has already been defined as a prop."),
          vm
        );
      }
    }
  }
}

// 初始化 watch
function initWatch (vm, watch) {
  // 开发环境下，检查 vm.$options["watch"] 是否为对象，若不是对象，发出警告
  "development" !== 'production' && checkOptionType(vm, 'watch');

  for (var key in watch) {
    var handler = watch[key];
    // watch[key] 是数组，递归调用
    if (Array.isArray(handler)) {
      for (var i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i]);
      }
    } else {
      createWatcher(vm, key, handler);
    }
  }
}

// 创建一个 watcher，返回值为一个函数，该函数执行会调用 watcher.teardown()
function createWatcher (vm, keyOrFn, handler, options) {
  // ① 若 handler 为对象，修正为 handler.handler
  if (isPlainObject(handler)) {
    options = handler;
    handler = handler.handler;
  }
  // ② 若 handler 为字符串，修正为 vm[handler]
  if (typeof handler === 'string') {
    handler = vm[handler];
  }
  // 观察 expOrFn ，若 expOrFn 变化了，就调用函数 handler
  return vm.$watch(keyOrFn, handler, options)
}

// 状态混入
function stateMixin (Vue) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  // 用 Object.defineProperty 直接声明定义对象可能会有问题。所以，这里就程序化的建立对象。
  var dataDef = {};
  dataDef.get = function () { return this._data };
  var propsDef = {};
  propsDef.get = function () { return this._props };
  {
    dataDef.set = function (newData) {
      // 不能替换实例的根 data，推荐使用嵌套的 data 属性
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      );
    };
    // $props 是只读的
    propsDef.set = function () {
      warn("$props is readonly.", this);
    };
  }
  // 给 Vue 的原型添加 $data 和 $props 属性，这样 vm 实例就可以调用了 vm.$data 和 vm.$props 了
  Object.defineProperty(Vue.prototype, '$data', dataDef);
  Object.defineProperty(Vue.prototype, '$props', propsDef);

  // 全局的 set 和 del 方法添加到 Vue 原型上
  Vue.prototype.$set = set;
  Vue.prototype.$delete = del;

  // 观察 expOrFn ，若 expOrFn 变化了，就调用函数 cb
  Vue.prototype.$watch = function (expOrFn, cb, options) {
    var vm = this;
    // cb 是对象，调用 createWatcher 方法，然后将 cb 修正为 cb.handler
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {};
    options.user = true;
    /*
      vm.$watch 观察 Vue 实例变化的一个表达式或计算属性函数。回调函数得到的参数为新值和旧值。表达式只接受监督的键路径。对于更复杂的表达式，用一个函数取代。
      // ① 键路径形式的表达式
      vm.$watch('a.b.c', function (newVal, oldVal) {
        // 回调函数做点什么
      })

      // ② 函数形式的表达式
      vm.$watch(
        function () {
          return this.a + this.b
        },
        function (newVal, oldVal) {
          // 回调函数做点什么
        }
      )

      为了发现对象内部值的变化，可以在选项参数中指定 deep: true 。注意监听数组的变动不需要这么做。

      vm.$watch('someObject', callback, {
        deep: true
      })
      vm.someObject.nestedValue = 123
      // callback is fired
     */
    // 新建 watcher，观察 expOrFn，若 expOrFn 变动，则调用 cb 函数
    var watcher = new Watcher(vm, expOrFn, cb, options);
    /*
        为什么新建一个 watcher 就可以起到观察的作用呢？

        ① expOrFn 变化时会触发对应的 dep.notify()
        ② dep.notify() 即执行对应的 watcher.update()
        ③ watcher.update() 又会触发 watcher.run()
        ④ watcher.run() 执行过程很简单：
           value = watcher.get();
           oldValue = watcher.value;
           watcher.cb.call(watcher.vm, value, oldValue);

        这其实也是一个 watcher 工作的基本流程
     */


    /*
      在选项参数中指定 immediate: true 将立即以表达式的当前值触发回调：

      vm.$watch('a', callback, {
        immediate: true
      })
      立即以 `a` 的当前值触发回调
     */
    // options.immediate 存在，直接调用 cb 方法
    if (options.immediate) {
      // watcher.value 就是 expOrFn 的当前值，作为 cb 的参数
      cb.call(vm, watcher.value);
    }

    /*
      vm.$watch 返回一个取消观察函数，用来停止触发回调：

      var unwatch = vm.$watch('a', cb)
      
      unwatch()
      // 之后取消观察
     */
    return function unwatchFn () {
      watcher.teardown();
    }
  };
}

// 初始化 provide
function initProvide (vm) {
  var provide = vm.$options.provide;
  if (provide) {
    // 如果 provide 是函数，取函数执行结果，否则就取 provide
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide;
  }
}

// 初始化注入
function initInjections (vm) {
  // 注入的数据，存在对象 result 中
  var result = resolveInject(vm.$options.inject, vm);
  if (result) {
    observerState.shouldConvert = false;
    Object.keys(result).forEach(function (key) {
      /* istanbul ignore else */
      {
        // 在 vm 对象上拦截 key 属性的 get/set 操作
        defineReactive$$1(vm, key, result[key], function () {
          /*
            避免直接地突变一个属性值。因为父组件重新渲染的时候会覆盖这个值。
            推荐的做法是：用 data 或computed 属性。
          */
          warn(
            "Avoid mutating an injected value directly since the changes will be " +
            "overwritten whenever the provided component re-renders. " +
            "injection being mutated: \"" + key + "\"",
            vm
          );
        });
      }
    });
    observerState.shouldConvert = true;
  }
}

// 处理注入，inject 中的列的属性名，依次和祖先元素的 provide 属性属性名对比，只有找到了就存到 result 中，最后返回 result
function resolveInject (inject, vm) {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    var result = Object.create(null);
    /*
        ① hasSymbol 为 true 表示原生支持 Symblo 和 Reflect
        ② Reflect.ownKeys 方法用于返回对象的所有属性，基本等同于 Object.getOwnPropertyNames 与 Object.getOwnPropertySymbols 之和
        ③ Object.keys 方法返回对象的可枚举属性组成的数组
    */
    var keys = hasSymbol
        ? Reflect.ownKeys(inject)
        : Object.keys(inject);

    for (var i = 0; i < keys.length; i++) {
      /*
        参考：https://cn.vuejs.org/v2/api/#provide-inject
        provide 和 inject 主要为高阶插件/组件库提供用例。并不推荐直接用于应用程序代码中。
        
        var Provider = {
          provide: {
            foo: 'bar'
          },
          // ...
        }
        var Child = {
          inject: ['foo'],
          created () {
            console.log(this.foo) // => "bar"
          }
          // ...
        }

        可以看到，子组件的 inject 会去祖先组件的 provide 中取值
      */
      // inject【数组索引 | 属性名】
      var key = keys[i];
      // inject【属性值】对应 provide【属性名】
      var provideKey = inject[key];
      var source = vm;
      // 向上遍历祖先实例
      while (source) {
        // 只要当前属性名存在于某个祖先 vm.$options.provide 中，就终止循环
        if (source._provided && provideKey in source._provided) {
          result[key] = source._provided[provideKey];
          break
        }
        source = source.$parent;
      }
      // hasOwn(result, key) 为 false，说明以上并没给执行给 result 添加 key 属性的操作，也就是所有祖先元素中都没找到，那就发出警告
      if ("development" !== 'production' && !hasOwn(result, key)) {
        warn(("Injection \"" + key + "\" not found"), vm);
      }
    }
    return result
  }
}

/*
  createFunctionalComponent 只在 createComponent 函数中调用：
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }
  如果组件构造函数选项里 functional 为 true，那么该组件就是函数式组件
  例如：
  Vue.component('my-component', {
    functional: true,
    // 为了弥补缺少的实例，提供第二个参数作为上下文
    render: function (createElement, context) {
      // ...
    },
    // Props 可选
    props: {
      // ...
    }
  })
  
 【函数式组件的特点是】：它无状态 (没有 data)，无实例 (没有 this 上下文)。
  
  对比一下普通的组件定义：
  Vue.component('anchored-heading', {
    render: function (createElement) {
      // render 函数只有一个参数
    },
    props: {
      // ...
    }
  })

  函数式组件和普通组件定义的不同点体现在：
  1. 显式指定 functional: true
  2. render 函数多一个参数 context 代表上下文
     其中，context 包括以下属性供组件使用：
     props：提供 props 的对象
     children: VNode 子节点的数组
     slots: slots 对象
     data：传递给组件的 data 对象
     parent：对父组件的引用
     listeners: (2.3.0+) 一个包含了组件上所注册的 v-on 侦听器的对象。这只是一个指向 data.on 的别名。
     injections: (2.3.0+) 如果使用了 inject 选项，则该对象包含了应当被注入的属性。
 */
// 创建函数式组件，最后返回一个 vnode
function createFunctionalComponent (
  Ctor,
  propsData,
  data,
  context,
  children
) {
  var props = {};
  var propOptions = Ctor.options.props;

  /*
    在 2.3.0 之前的版本中，如果一个函数式组件想要接受 props，则 props 选项是必须的。
    在 2.3.0 或以上的版本中，你可以省略 props 选项，所有组件上的属性都会被自动解析为 props。
   */
  // ① 定义了 Ctor.options.props，那就以它作为 props
  if (isDef(propOptions)) {
    for (var key in propOptions) {
      props[key] = validateProp(key, propOptions, propsData || {});
    }
  // ② 否则，就将 data.attrs 和 data.props 作为 props
  } else {
    if (isDef(data.attrs)) { mergeProps(props, data.attrs); }
    if (isDef(data.props)) { mergeProps(props, data.props); }
  }
  // ensure the createElement function in functional components
  // gets a unique context - this is necessary for correct named slot check
  /*
    ① 确保 createElement 函数函数式组件中
    ② 获取唯一的上下文 —— 这对于检查命名插槽是有必要的

    Object.create 方法接受一个对象作为参数，然后以它为原型，返回一个实例对象。该实例完全继承继承原型对象的属性。
  */
  var _context = Object.create(context);
  /*
      h 是一个函数，该函数的作用是返回一个 vnode
      h(a, b, c, d)
      -> createElement(_context, a, b, c, d, true)

      SIMPLE_NORMALIZE = 1; 简单标准化
      ALWAYS_NORMALIZE = 2; 正常标准化

      createElement 最后一个参数为 true 表示对 children(c) 强制采用”正常标准化”处理
   */
  var h = function (a, b, c, d) { return createElement(_context, a, b, c, d, true); };
  /*
      函数式组件在声明的时候，render 函数有两个参数：
      // 为了弥补缺少的实例，提供第二个参数作为上下文
      render: function (createElement, context) {
        // ...
      }
   */
  var vnode = Ctor.options.render.call(null, h, {
    data: data,
    props: props,
    children: children,
    parent: context,
    listeners: data.on || {},
    /*
        resolveInject() 返回一个 json 对象，键名为 inject 中【数组索引 | 属性名】，键值为 provide【属性名】中属性值
        例如：
        {
          'foo' : 'bar'
        }
     */
    injections: resolveInject(Ctor.options.inject, context),
    /*
        slots 是一个函数，执行结果是一个 json 对象，每个子属性是由 dom 元素组成的数组
        slots()
        -> resolveSlots(children, context)
        -> {
          default : [...],
          name1 : [...],
          name2 : [...],
          ...
        }
     */
    slots: function () { return resolveSlots(children, context); }
  });
  // 给 vnode 添加属性
  if (vnode instanceof VNode) {
    vnode.functionalContext = context;
    vnode.functionalOptions = Ctor.options;
    // vnode.data.slot = data.slot
    if (data.slot) {
      (vnode.data || (vnode.data = {})).slot = data.slot;
    }
  }
  return vnode
}

// 将 from 的属性（属性名驼峰化）都赋给 to
function mergeProps (to, from) {
  for (var key in from) {
    // camelize 方法将连字符分隔的字符串驼峰化，例如：a-b-c -> aBC
    to[camelize(key)] = from[key];
  }
}

/*  */

// hooks to be invoked on component VNodes during patch
// 组件 patch 过程中的钩子方法 
var componentVNodeHooks = {
  // 1. 初始化（创建组件实例）
  init: function init (
    vnode,
    hydrating,
    parentElm,
    refElm
  ) {
    // ① 若该 vnode 没有对应的组件实例，那就创建一个新的
    if (!vnode.componentInstance || vnode.componentInstance._isDestroyed) {
      // 创建组件实例
      var child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance,
        parentElm,
        refElm
      );
      /*
          vm.$mount() 手动地挂载一个未挂载的实例
          a. 参数为元素选择器，挂载到该元素，替换的该元素内容
          var MyComponent = Vue.extend({
            template: '<div>Hello!</div>'
          })
          new MyComponent().$mount('#app')

          b. 参数为空/undefined，在文档之外渲染，随后再挂载
          var component = new MyComponent().$mount()
          document.getElementById('app').appendChild(component.$el)
       */
      child.$mount(hydrating ? vnode.elm : undefined, hydrating);
    // ② vnode 有对应的组件实例，那就更新这个组件（这里的 vnode.data.keepAlive 是个布尔值，true）
    } else if (vnode.data.keepAlive) {
      // kept-alive components, treat as a patch
      var mountedNode = vnode; // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode);
    }
  },

  // 2. prepatch（更新组件实例）
  /*
      看看数据类型 MountedComponentVNode：
      declare type MountedComponentVNode = {
        context: Component;
        componentOptions: VNodeComponentOptions;
        componentInstance: Component;
        parent: VNode;
        data: VNodeData;
      };

      prepatch(oldVnode,vnode) 的作用是更新组件：
      ① 从 oldVnode 中获取对应的组件实例 child
      ② 对实例 child 的 props、listeners、parent vnode、children 等进行更新
   */
  prepatch: function prepatch (oldVnode, vnode) {
    var options = vnode.componentOptions;
    // 组件实例
    var child = vnode.componentInstance = oldVnode.componentInstance;
    // 对组件 child 的 props、listeners、parent vnode、children 等进行更新
    updateChildComponent(
      child,             // 组件实例
      options.propsData, // updated props，更新属性
      options.listeners, // updated listeners，更新监听器
      vnode,             // new parent vnode，更新父 vnode
      options.children   // new children，更新 children
    );
  },

  // 3. insert（标记组件的 _isMounted、_directInactive 等状态）
  insert: function insert (vnode) {
    /*
        context 和 componentInstance 都是 Component 类型，也就是说都是组件实例
        做个猜想（未验证）：
        ① componentInstance 是 vnode 对应的组件实例
        ② context 是父组件实例
     */
    var context = vnode.context;
    var componentInstance = vnode.componentInstance;
    // ① 标记 componentInstance._isMounted 为 true
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true;
      callHook(componentInstance, 'mounted');
    }
    // ② 标记激活了组件 componentInstance
    if (vnode.data.keepAlive) {
      // 如果上下文已经插入过文档，那就将 componentInstance 添加到 activatedChildren 数组中（随后这个 componentInstance 组件会被标记激活了）
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        /*
            在更新过程中，保持 alive 组件的子组件可能变化。如果直接的遍历组件树可能会在不正确的子节点上调用已经激活过的钩子。
            推荐的做法是：我们将它们加入到队列里，等这个 patch 过程结束后再执行队列。
        */
        queueActivatedComponent(componentInstance);
      // b. 直接标记激活了组件 componentInstance
      } else {
        activateChildComponent(componentInstance, true /* direct */);
      }
    }
  },

  // 4. destroy（销毁组件）
  destroy: function destroy (vnode) {
    var componentInstance = vnode.componentInstance;
    // 没被销毁过，才执行
    if (!componentInstance._isDestroyed) {
      // ① 不需要 keepAlive，直接销毁
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy();
      // ② 需要 keepAlive，那就标记失效
      } else {
        deactivateChildComponent(componentInstance, true /* direct */);
      }
    }
  }
};

var hooksToMerge = Object.keys(componentVNodeHooks);
// -> ["init", "prepatch", "insert", "destroy"]

// 创建组件，返回 vnode
function createComponent (Ctor, data, context, children, tag) {
  // ① 若没指定构造函数 Ctor，就此返回
  if (isUndef(Ctor)) {
    return
  }

  var baseCtor = context.$options._base;

  // plain options object: turn it into a constructor
  // ② 若 Ctor 是个选项对象，那就将其转为构造函数
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor);
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  // ③ 到这里，Ctor 还不是构造函数，那就发出警告，并返回
  if (typeof Ctor !== 'function') {
    {
      // 无效的组件定义
      warn(("Invalid Component definition: " + (String(Ctor))), context);
    }
    return
  }

  // 1. 异步组件
  var asyncFactory;
  /*
    ① 异步组件工厂函数 factory 只是普通的函数，没有 factory.cid 属性
    ② 而通过 Ctor = Vue.extend(extendOptions) 创建的组件构造函数都有 Ctor.cid 属性
 */
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor;
    // 根据工厂函数 asyncFactory 的不同状态返回不同的组件构造函数
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context);
    /*
        resolveAsyncComponent() 返回值为 undefined，说明异步任务没执行完，组件构造函数还没创建
        那就调用 createAsyncPlaceholder() 先创建一个占位符
     */
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      /*
        对于异步组件，这里返回一个占位符。这种占位符会作为注释节点来渲染，不过它会保留节点的所有元信息。
        这些元信息在异步的服务器渲染和 hydration 时是有用的。
      */
     // 创建组件占位符（看起来像注释节点，但是它会保存节点所有的原始信息，水化后就可以变成正常节点了）
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {};

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  // resolve 构造函数选项，以免组件构造函数创建后全局的 mixin 被应用
  /*
      Ctor.options = Ctor.super.options + Ctor.extendOptions，也就是：
      子类构造函数的 options 是父类构造函数的 options 和自身扩展的 options 和并集
   */
  resolveConstructorOptions(Ctor);

  // transform component v-model data into props & events
  // 将 v-model 数据转换成 props 和 events
  if (isDef(data.model)) {
    // 自定义组件 v-model 绑定的 prop 和 event（默认情况下是 value 和 input）
    transformModel(Ctor.options, data);
  }

  /*
    ① 遍历 Ctor.options.props 对象的键名 key
    ② 从 data.props 和 data.attrs 提取值
    ③ 若找到 (data.props | data.attrs)[key]，就复制到 res 对象中
    ④ 最后返回 json 对象 res
 */
  var propsData = extractPropsFromVNodeData(data, Ctor, tag);

  // 2. 函数式组件，返回 vnode
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // keep listeners
  var listeners = data.on;

  /*
      除了 props & listeners & slot，抽象组件不需要任何数据了
      ① 将 data 对象清空
      ② data.slot 属性重新加回来
      ③ props 和 listeners 属性在哪加回来的呢？new VNode() 过程中？
   */
  // 3. 抽象组件
  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    var slot = data.slot;
    // 将 data 清空，抽象组件不需要数据
    data = {};
    if (slot) {
      data.slot = slot;
    }
  }

  // merge component management hooks onto the placeholder node
  // 将对象 data.hook 的 "init", "prepatch", "insert", "destroy" 四个属性进行更新
  mergeHooks(data);

  // return a placeholder vnode
  // 节点标签
  var name = Ctor.options.name || tag;
  // 4. 一般组件，新建 vnode
  var vnode = new VNode(
    ("vue-component-" + (Ctor.cid) + (name ? ("-" + name) : '')),
    data, undefined, undefined, undefined, context,
    { Ctor: Ctor, propsData: propsData, listeners: listeners, tag: tag, children: children },
    asyncFactory
  );
  return vnode
}

// 创建与 vnode 对应的组件实例
function createComponentInstanceForVnode (
  vnode, // we know it's MountedComponentVNode but flow doesn't
  parent, // activeInstance in lifecycle state
  parentElm,
  refElm
) {
  var vnodeComponentOptions = vnode.componentOptions;
  // ① 修正选项对象
  var options = {
    _isComponent: true,
    parent: parent,
    propsData: vnodeComponentOptions.propsData,
    _componentTag: vnodeComponentOptions.tag,
    _parentVnode: vnode,
    _parentListeners: vnodeComponentOptions.listeners,
    _renderChildren: vnodeComponentOptions.children,
    _parentElm: parentElm || null,
    _refElm: refElm || null
  };
  /*
      1. 插槽
      假定 my-component 组件有如下模板：
      <div>
        <h2>我是子组件的标题</h2>
        <slot>
          只有在没有要分发的内容时才会显示。
        </slot>
      </div>

      父组件模板：
      <div>
        <h1>我是父组件的标题</h1>
        <my-component>
          <p>这是一些初始内容</p>
          <p>这是更多的初始内容</p>
        </my-component>
      </div>

      渲染结果：
      <div>
        <h1>我是父组件的标题</h1>
        <div>
          <h2>我是子组件的标题</h2>
          <p>这是一些初始内容</p>
          <p>这是更多的初始内容</p>
        </div>
      </div>

      2. 内联模板。如果子组件有 inline-template 特性，子组件将把它的内容当作子组件自身的模板，而不是把它当作分发内容。
      <my-component inline-template>
        <div>
          <p>这些将作为组件自身的模板。</p>
          <p>而非父组件透传进来的内容。</p>
        </div>
      </my-component>

      插槽和内联模板一对比就会发现：
      ① 对于插槽，<my-component> 里的内容是父组件的内容
      ② 对于内联模板，<my-component inline-template> 里的内容属于子组件
   */
  // check inline-template render functions
  var inlineTemplate = vnode.data.inlineTemplate;
  // 对于内联组件，组件的内容都是固定的，可以直接确定 render 和 staticRenderFns
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render;
    options.staticRenderFns = inlineTemplate.staticRenderFns;
  }

  // 根据以上 options 选项，返回实例。这里的 Ctor 指的是“构造函数”
  // vnodeComponentOptions.Ctor 应该是 Vue.extend() 产生的组件构造函数
  // new vnodeComponentOptions.Ctor(options) 为组件实例
  // ② 根据选项对象创建组件实例
  return new vnodeComponentOptions.Ctor(options)
}

// 将对象 data.hook 的 "init", "prepatch", "insert", "destroy" 四个属性进行更新
function mergeHooks (data) {
  if (!data.hook) {
    data.hook = {};
  }
  /*
      hooksToMerge = Object.keys(componentVNodeHooks)
      -> hooksToMerge = ["init", "prepatch", "insert", "destroy"]
      
      以 key = "prepatch" 为例：
      fromParent = data.hook["prepatch"]
      ours = componentVNodeHooks["prepatch"]
      
      mergeHook(ours, fromParent) 表示合并两个钩子方法
   */
  for (var i = 0; i < hooksToMerge.length; i++) {
    var key = hooksToMerge[i];
    var fromParent = data.hook[key];
    var ours = componentVNodeHooks[key];
    /*
        以 i = 0 为例：
        key = "init"

        ① data.hook["init"] 存在，那么新的 data.hook["init"] 重置为旧的 data.hook["init"] 和 componentVNodeHooks["init"] 合并后的函数
        ② data.hook["init"] 不存在，那么新的 data.hook["init"] 就是 componentVNodeHooks["init"]
    */
   // 更新 data.hook[key]
    data.hook[key] = fromParent ? mergeHook$1(ours, fromParent) : ours;
  }
}

// 返回一个新的函数，新函数每次调用时，one、two 这俩方法都执行
function mergeHook$1 (one, two) {
  return function (a, b, c, d) {
    one(a, b, c, d);
    two(a, b, c, d);
  }
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
/*
    将组件的自定义 v-model 信息（value 和 callback）转成 prop 和 event
    实际调用时：transformModel(Ctor.options, data)

    默认情况下 v-model 指令绑定的是表单元素的 value 属性，监听的是 input 事件。
    在定义组件实例的时候，我们可以自定义绑定的 prop 和监听的事件，例如：
    new Vue({
      ...
      model : {
        prop : 'myProp';
        event : 'click';
      }
      ...
    })
    这样 v-model 指令绑定的时候 'myProp'，监听的是 'click' 事件
 */
function transformModel (options, data) {
  /*
    组件选项对象的 model 属性是个 json 对象，也就是说我们定义组件实例时可以传入这种形式的 model
    declare type ComponentOptions = {
      ...
      // 自定义组件 v-model 绑定的 prop 和 event（默认情况下是 value 和 input）
      model?: {
        prop?: string;
        event?: string;
      };
      ...
    };
   */
  var prop = (options.model && options.model.prop) || 'value';
  var event = (options.model && options.model.event) || 'input';
  
  /*
    ① genComponentModel ( el, value, modifiers) 方法对元素的 v-model 属性解析生成
      el.model = {
        value: ("(" + value + ")"),
        expression: ("\"" + value + "\""),
        callback: ("function (" + baseValueExpression + ") {" + assignment + "}")
      };
    ② genData$2 (el, state) 方法将其挂载到 data 上
      if (el.model) {
        data += "model:{value:" + (el.model.value) + ",callback:" + (el.model.callback) + ",expression:" + (el.model.expression) + "},";
      }
      也就是：
      data.model : { 
          value : el.model.value, 
          callback : el.model.callback, 
          expression : el.model.expression
      }
   */

  // ① 加入 data.props 对象中
  (data.props || (data.props = {}))[prop] = data.model.value;

  // ② 加入 data.on 对象中
  var on = data.on || (data.on = {});
  // 如果当前事件已经绑定过回调函数，那就回调函数数组合并
  if (isDef(on[event])) {
    // on[event] 应该是个数组，数组合并
    on[event] = [data.model.callback].concat(on[event]);
  } else {
    on[event] = data.model.callback;
  }
}

/*  */

var SIMPLE_NORMALIZE = 1;
var ALWAYS_NORMALIZE = 2;

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
// 创建元素，修正参数，实际调用 _createElement(context, tag, data, children, normalizationType)，返回一个 vnode
function createElement (context, tag, data, children, normalizationType, alwaysNormalize) {
  // data 为数组、字符串或数值，则参数的含义重新分配（相当于为定义 data，其他参数取前 1 位）
  if (Array.isArray(data) || isPrimitive(data)) {
    // normalizationType 修正为第 4 个实参
    normalizationType = children;
    // children 修正为第 3 个实参
    children = data;
    data = undefined;
  }
  // alwaysNormalize === true，再次修正 normalizationType 为 2
  if (isTrue(alwaysNormalize)) {
	/*
		SIMPLE_NORMALIZE = 1;	简单标准化
		ALWAYS_NORMALIZE = 2;	正常标准化
	*/
    normalizationType = ALWAYS_NORMALIZE;
  }
  return _createElement(context, tag, data, children, normalizationType)
}

/*
  该函数的作用是生成 vnode，分为以下几类：
  ① data && data.__ob__ 存在，return createEmptyVNode()
  ② !tag 即 tag 不存在时，return createEmptyVNode()
  ③ tag 是 html/svg 内置标签名，return vnode = new VNode(config.parsePlatformTagName(tag), data, children, undefined, undefined, context);
  ④ tag 是组件标签名（字符串），return vnode = createComponent(resolveAsset(context.$options, 'components', tag), data, context, children, tag);
  ⑤ tag 是其他字符串，return vnode = new VNode(tag, data, children, undefined, undefined, context);
  ⑥ tag 是构造函数名，return vnode = createComponent(tag, data, context, children);
 
  可以看出，除了直接调用 new VNode() 生成 vnode，就是用 createComponent() 和 createEmptyVNode() 来生成 vnode 
 */
// 返回一个 vnode。如 _createElement(vm, 'a', {attr:{'href':'#'}}, [vnode...], 2)
function _createElement (context, tag, data, children, normalizationType) {
  // ① 对 data 进行检查。避免使用被 observed 的 data 对象作为 vnode data
  if (isDef(data) && isDef((data).__ob__)) {
    "development" !== 'production' && warn(
      "Avoid using observed data object as vnode data: " + (JSON.stringify(data)) + "\n" +
      'Always create fresh vnode data objects in each render!',
      context
    );
    // 返回空的 vnode
    return createEmptyVNode()
  }
  
  /*
      var vm = new Vue({
        el: '#example',
        data: {
          currentView: 'home'
        },
        components: {
          home: { ... },
          posts: { ...  },
          archive: { ... }
        }
      })
      <component v-bind:is="currentView">
        <!-- 组件在 vm.currentview 变化时改变！ -->
      </component>

      对 vm.currentView 进行修改就可以在同一个挂载点动态切换多个组件了
   */

  // ② 对 data.is 进行检查
  if (isDef(data) && isDef(data.is)) {
    tag = data.is;
  }

  // ③ 对 tag 进行检查
  if (!tag) {
    // in case of component :is set to falsy value
    // 所以得注意 :is 被设置为一个假值的情况
    return createEmptyVNode()
  }
  
  // ④ 对 data.key 进行检查
  if ("development" !== 'production' && isDef(data) && isDef(data.key) && !isPrimitive(data.key)) {
    // key 值必须为字符串或数值等基本数据类型
    warn(
      'Avoid using non-primitive value as key, ' +
      'use string/number value instead.',
      context
    );
  }


  // ⑤ 对 children 进行检查和修正
  /*
      若 children 是数组，并且 children[0] 是函数，那么：
      1. 将这个函数作为默认的 scoped slot
      2. 将 children 数组清空
   */
  // support single function children as default scoped slot
  // children 为数组，并且该数组的第一个元素是函数
  if (Array.isArray(children) && typeof children[0] === 'function') {
    data = data || {};
    data.scopedSlots = { default: children[0] };
    // 将 children 数组清空
    children.length = 0;
  }


  // 对 children 数组进行修正，修正后 children 还是数组
  if (normalizationType === ALWAYS_NORMALIZE) {
    // 标准化处理，返回一个数组
    children = normalizeChildren(children);
  // SIMPLE_NORMALIZE 为 1
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    // 简单的标准化处理：将 children 数组扁平化，变成一维数组
    children = simpleNormalizeChildren(children);
  }

  // ⑥ 根据参数，生成 vnode
  var vnode, ns;

  // 1. tag 是字符串
  if (typeof tag === 'string') {
    var Ctor;
    // 命名空间
    ns = config.getTagNamespace(tag);

    // a. tag 是 html/svg 内置标签名
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      /*
        identity = function (_) { return _; };
        config.parsePlatformTagName = identity;
        也就是说，直接用这个内置标签名
     */
      vnode = new VNode(config.parsePlatformTagName(tag), data, children, undefined, undefined, context);
    // b. tag 是组件标签名，根据标签名找到组件构造函数，然后创建组件
    } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag);
    // c. 其他未知标签名
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(tag, data, children, undefined, undefined, context);
    }
  // 2. tag 为其他类型
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children);
  }

  // 如果有 vnode 就返回 vnode 
  if (isDef(vnode)) {
    // // 标记命名空间 vnode.ns = ns
    if (ns) { applyNS(vnode, ns); }
    return vnode
  // 否则返回空 vnode
  } else {
    return createEmptyVNode()
  }
}

// 标记 vnode.ns = ns，vnode 和其子节点共用同一个 ns
function applyNS (vnode, ns) {
  vnode.ns = ns;
  if (vnode.tag === 'foreignObject') {
    // use default namespace inside foreignObject
    return
  }
  // 遍历子节点，递归调用 applyNS
  if (isDef(vnode.children)) {
    for (var i = 0, l = vnode.children.length; i < l; i++) {
      var child = vnode.children[i];
      // 子节点没有 ns 属性，标记之
      if (isDef(child.tag) && isUndef(child.ns)) {
        applyNS(child, ns);
      }
    }
  }
}

/*  */

/**
 * Runtime helper for rendering v-for lists.
 */
// Vue.prototype._l = renderList 渲染 v-for 列表，返回数组 ret，该数组元素是 render 函数执行结果
function renderList (val,render) {
  var ret, i, l, keys, key;
  // val 是数组或 val 是字符串，例如 v-for="(value, key) in items"
  if (Array.isArray(val) || typeof val === 'string') {
    ret = new Array(val.length);
    for (i = 0, l = val.length; i < l; i++) {
      ret[i] = render(val[i], i);
    }
  // val 是数值，例如 v-for="item in 5"
  } else if (typeof val === 'number') {
    ret = new Array(val);
    for (i = 0; i < val; i++) {
	  // i + 1 为 1 2 3 4 5
      ret[i] = render(i + 1, i);
    }
  // val 是对象
  } else if (isObject(val)) {
    keys = Object.keys(val);
    ret = new Array(keys.length);
    for (i = 0, l = keys.length; i < l; i++) {
      key = keys[i];
      ret[i] = render(val[key], key, i);
    }
  }
  // val 是以上 3 种情况之一，ret 就会被赋值为数组，在此给 ret 添加一个 _isVList 属性
  if (isDef(ret)) {
    (ret)._isVList = true;
  }
  return ret
}

/*  */

/**
 * Runtime helper for rendering <slot>
 */
// 渲染插槽，这个函数的返回值依赖于 this，也就是说跟它的执行对象有关
function renderSlot (
  name,
  fallback,
  props,
  bindObject
) {
  var scopedSlotFn = this.$scopedSlots[name];
  if (scopedSlotFn) { // scoped slot
    props = props || {};
    if (bindObject) {
      // 合并 bindObject 和 props
      props = extend(extend({}, bindObject), props);
    }
    return scopedSlotFn(props) || fallback
  } else {
    var slotNodes = this.$slots[name];
    // warn duplicate slot usage
    if (slotNodes && "development" !== 'production') {
      slotNodes._rendered && warn(
        // 某个插槽重复的出现在一棵渲染树中，可能会导致渲染错误
        "Duplicate presence of slot \"" + name + "\" found in the same render tree " +
        "- this will likely cause render errors.",
        this
      );
      // 标志当前插槽渲染过
      slotNodes._rendered = true;
    }
    return slotNodes || fallback
  }
}

/*  */

/**
 * Runtime helper for resolving filters
 */
 // 处理过滤器 Vue.prototype._f = resolveFilter;
function resolveFilter (id) {
  // 根据 id 返回某个指定的过滤器
  return resolveAsset(this.$options, 'filters', id, true) || identity
}

/*  */

/**
 * Runtime helper for checking keyCodes from config.
 */
// Vue.prototype._k = checkKeyCodes;
// 检查键值，eventKeyCode 和配置的键值不相同返回 true，例如 _k($event.keyCode,"right",39) 不是点击鼠标右键返回 true
function checkKeyCodes (eventKeyCode, key, builtInAlias) {
  // builtInAlias 为内置别名
  var keyCodes = config.keyCodes[key] || builtInAlias;
  if (Array.isArray(keyCodes)) {
    return keyCodes.indexOf(eventKeyCode) === -1
  } else {
    return keyCodes !== eventKeyCode
  }
}

/*  */

/**
 * Runtime helper for merging v-bind="object" into a VNode's data.
 */
// 将 v-bind="object" 转换成 VNode 的 data，以下操作会修改 data，最后返回 data
function bindObjectProps (data, tag, value, asProp, isSync) {
  if (value) {
    // value 不是对象
    if (!isObject(value)) {
      // v-bind 在没有参数的情况下，值应该为对象或数组
      "development" !== 'production' && warn(
        'v-bind without argument expects an Object or Array value',
        this
      );
    } else {
      // 将数组 value 转为对象
      if (Array.isArray(value)) {
        value = toObject(value);
      }
      var hash;
      var loop = function ( key ) {
        if (
          key === 'class' ||
          key === 'style' ||
          isReservedAttribute(key)
        ) {
          hash = data;
        } else {
          var type = data.attrs && data.attrs.type;
          /*
            hash 值为 data.domProps 或 data.attrs
            如果 data.domProps 或 data.attrs 不存在，初始化为一个空对象
          */
          hash = asProp || config.mustUseProp(tag, type, key)
            ? data.domProps || (data.domProps = {})
            : data.attrs || (data.attrs = {});
        }

        // key 不在 hash 对象里
        if (!(key in hash)) {
          // 修改 hash，就是修改 data
          hash[key] = value[key];

          if (isSync) {
            var on = data.on || (data.on = {});
            // 修改 on 就是修改 data.on
            on[("update:" + key)] = function ($event) {
              value[key] = $event;
            };
          }
        }
      };
      // 遍历 value 对象
      for (var key in value) loop( key );
    }
  }
  // 返回修改过的 data
  return data
}

/*  */

/**
 * Runtime helper for rendering static trees.
 */
// 渲染静态树
function renderStatic (index, isInFor) {
  var tree = this._staticTrees[index];

  // if has already-rendered static tree and not inside v-for,
  // we can reuse the same tree by doing a shallow clone.

  // 如果已经渲染了静态树并且不是在 v-for 内部。我们可以通过浅拷贝来复用这颗树，就此返回。
  if (tree && !isInFor) {
    return Array.isArray(tree) ? cloneVNodes(tree) : cloneVNode(tree)
  }
  // otherwise, render a fresh tree.
  // 否则，重新渲染静态树
  tree = this._staticTrees[index] =
    // vm._renderProxy = new Proxy(vm, handlers)，也就是说 vm._renderProxy 的属性读取会被代理（对不存在的属性发出警告）。也可以简单地把 this._renderProxy 看作 this.vm
    this.$options.staticRenderFns[index].call(this._renderProxy);

  // 标记静态节点 tree.isStatic = true; tree.key = "__static__" + index; tree.isOnce = false;
  markStatic(tree, ("__static__" + index), false);
  return tree
}

/**
 * Runtime helper for v-once.
 * Effectively it means marking the node as static with a unique key.
 */
// 标记一次
function markOnce (tree, index, key) {
  markStatic(tree, ("__once__" + index + (key ? ("_" + key) : "")), true);
  return tree
}

// 标记静态树
function markStatic (tree, key, isOnce) {
  // 遍历 tree，依次对每一个 node 进行标记
  if (Array.isArray(tree)) {
    for (var i = 0; i < tree.length; i++) {
      if (tree[i] && typeof tree[i] !== 'string') {
        markStaticNode(tree[i], (key + "_" + i), isOnce);
      }
    }
  } else {
    markStaticNode(tree, key, isOnce);
  }
}

// 标记静态节点
function markStaticNode (node, key, isOnce) {
  // 静态
  node.isStatic = true;
  node.key = key;
  node.isOnce = isOnce;
}

// 修改 data ，最终返回 data
function bindObjectListeners (data, value) {
  if (value) {
    // value 不是对象，发出警告
    if (!isPlainObject(value)) {
      // v-on 在不带参数时的值应该是对象
      "development" !== 'production' && warn(
        'v-on without argument expects an Object value',
        this
      );
    } else {
      var on = data.on = data.on ? extend({}, data.on) : {};
      for (var key in value) {
        var existing = on[key];
        var ours = value[key];
        // 如果 data 里已经有了 key 对应的回调函数数组，那就 ours、existing 俩数组合并，否则就取 ours
        on[key] = existing ? [].concat(ours, existing) : ours;
      }
    }
  }
  return data
}

// 初始化渲染
function initRender (vm) {
  vm._vnode = null; // the root of the child tree
  vm._staticTrees = null;
  var parentVnode = vm.$vnode = vm.$options._parentVnode; // the placeholder node in parent tree
  var renderContext = parentVnode && parentVnode.context;
  vm.$slots = resolveSlots(vm.$options._renderChildren, renderContext);
  // emptyObject = Object.freeze({}) 被冻结的对象，是不可以修改的
  vm.$scopedSlots = emptyObject;


  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  /*
    将 createElement 方法绑定到这个实例。这里我们可以获取正确的渲染上下文。
    参数顺序：tag, data, children, normalizationType, alwaysNormalize

    内部版本是被模板编译而成的渲染函数用的
	createElement 最后参数为 false 表示是否进行正常标准化处理由参数 d 决定
  */
  vm._c = function (a, b, c, d) { return createElement(vm, a, b, c, d, false); };


  // normalization is always applied for the public version, used in
  // user-written render functions.
  // normalization 主要在公共版本中应用，也就是用户自己编写的渲染函数中。createElement 最后参数为 true 表示总是进行 ALWAYS_NORMALIZE = 2 的正常标准化处理
  vm.$createElement = function (a, b, c, d) { return createElement(vm, a, b, c, d, true); };

  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  var parentData = parentVnode && parentVnode.data;
  /* istanbul ignore else */
  {
    // 在 vm 对象上拦截 $attrs 属性的 get/set 操作
    defineReactive$$1(vm, '$attrs', parentData && parentData.attrs, function () {
      // 进行 set 操作并且开发环境下执行这句，其中 isUpdatingChildComponent 是个全局变量
      !isUpdatingChildComponent && warn("$attrs is readonly.", vm);
    }, true);
    // 在 vm 对象上拦截 $listeners 属性的 get/set 操作
    defineReactive$$1(vm, '$listeners', parentData && parentData.on, function () {
      // 进行 set 操作并且开发环境下执行这句，其中 isUpdatingChildComponent 是个全局变量
      !isUpdatingChildComponent && warn("$listeners is readonly.", vm);
    }, true);
  }
}

// 渲染混合，给 Vue 的原型添加方法，然后实例都可以用这里的方法。这个方法只执行一次 renderMixin(Vue$3);
function renderMixin (Vue) {
  Vue.prototype.$nextTick = function (fn) {
    return nextTick(fn, this)
  };

  // 生成 vnode 并返回
  Vue.prototype._render = function () {
    var vm = this;
    var ref = vm.$options;
    var render = ref.render;
    var staticRenderFns = ref.staticRenderFns;
    var _parentVnode = ref._parentVnode;

    // 如果当前实例已经插入文档
    if (vm._isMounted) {
      // clone slot nodes on re-renders
      for (var key in vm.$slots) {
        // vnode 是不能共用的，所以需要用 cloneVNodes 方法重新生成
        vm.$slots[key] = cloneVNodes(vm.$slots[key]);
      }
    }

    vm.$scopedSlots = (_parentVnode && _parentVnode.data.scopedSlots) || emptyObject;

    // vm._staticTrees 初始化为空数组
    if (staticRenderFns && !vm._staticTrees) {
      vm._staticTrees = [];
    }

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    // 设置父节点，这使得渲染函数可以访问占位节点上的数据
    vm.$vnode = _parentVnode;

    /*
        注意区别：
        vm.$vnode  保存的是 vm 对应的 _parentVnode，父树中的占位节点
        vm._vnode  保存的是 vm 对应的 vnode，子树的根
    */

    // render self
    var vnode;
    // 调用 render 方法，出错就调用错误处理函数。生成 vnode。
    try {
      // vm.$createElement = function (a, b, c, d) { return createElement(vm, a, b, c, d, true); };
      vnode = render.call(vm._renderProxy, vm.$createElement);
    } catch (e) {
      handleError(e, vm, "render function");
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      {
        vnode = vm.$options.renderError
          ? vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
          : vm._vnode;
      }
    }
    // return empty vnode in case the render function errored out
    // 如果 vnode 不是 VNode 的实例，就生成一个空的 VNode 实例，以免渲染方法出错
    if (!(vnode instanceof VNode)) {
      if ("development" !== 'production' && Array.isArray(vnode)) {
        // 渲染函数只能返回一个根节点，不能有多个！
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        );
      }
      vnode = createEmptyVNode();
    }
    // set parent
    vnode.parent = _parentVnode;
    return vnode
  };

  // internal render helpers.
  // these are exposed on the instance prototype to reduce generated render
  // code size.
  // 这些方法暴露在原型上以减少生成的渲染函数代码量
  Vue.prototype._o = markOnce;
  Vue.prototype._n = toNumber;
  Vue.prototype._s = toString;
  Vue.prototype._l = renderList;
  Vue.prototype._t = renderSlot;
  Vue.prototype._q = looseEqual;
  Vue.prototype._i = looseIndexOf;
  Vue.prototype._m = renderStatic;
  Vue.prototype._f = resolveFilter;
  Vue.prototype._k = checkKeyCodes;
  Vue.prototype._b = bindObjectProps;
  Vue.prototype._v = createTextVNode;
  Vue.prototype._e = createEmptyVNode;
  Vue.prototype._u = resolveScopedSlots;
  Vue.prototype._g = bindObjectListeners;
}

/*  */

var uid$1 = 0;

// 初始化混入
function initMixin (Vue) {
  // Vue 的构造函数里，就执行这一个初始化方法
  Vue.prototype._init = function (options) {
    var vm = this;
    // a uid，全局变量，每个 Vue 实例有一个唯一的 _uid
    vm._uid = uid$1++;

    var startTag, endTag;
    /* istanbul ignore if */
    // 开发模式下记录初始化开始时间
    if ("development" !== 'production' && config.performance && mark) {
      startTag = "vue-perf-init:" + (vm._uid);
      endTag = "vue-perf-end:" + (vm._uid);
      mark(startTag);
    }

    // a flag to avoid this being observed
    // 标志当前对象是 Vue 实例，有了这个标志就不会被 observe 了
    vm._isVue = true;

    // merge options，给 vm.$options 赋值
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 直接给 vm.$options 添加属性。优化内部组件实例化。由于动态选项合并相当慢，并且没有一个内部组件的选项需要特殊处理
      initInternalComponent(vm, options);
    } else {
      // 合并构造函数的 options 和参数 options
      vm.$options = mergeOptions(
        // 合并父构造函数和当前构造函数 vm.constructor 的 options
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      );
    }


    /* istanbul ignore else */
    {
      initProxy(vm);
    }
    // expose real self，保留对自身的引用
    vm._self = vm;

    // 各项初始化
    initLifecycle(vm);
    initEvents(vm);
    initRender(vm);
    // beforeCreate 钩子回调
    callHook(vm, 'beforeCreate');
    initInjections(vm); // resolve injections before data/props
    initState(vm);
    initProvide(vm); // resolve provide after data/props
    // created 钩子回调
    callHook(vm, 'created');

    /* istanbul ignore if */
    // 开发模式下记录初始化结束时间
    if ("development" !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false);
      mark(endTag);
      // 初始化总耗时
      measure(((vm._name) + " init"), startTag, endTag);
    }

    // 如果有 el 属性，vm 和真实 dom 进行挂载
    if (vm.$options.el) {
      vm.$mount(vm.$options.el);
    }
  };
}

// 初始化内部组件，即给 vm.$options 的属性赋值
function initInternalComponent (vm, options) {
  var opts = vm.$options = Object.create(vm.constructor.options);
  // doing this because it's faster than dynamic enumeration.
  // 之所以一个个列举而不是循环遍历，是因为这样会比较快
  opts.parent = options.parent;
  opts.propsData = options.propsData;
  opts._parentVnode = options._parentVnode;
  opts._parentListeners = options._parentListeners;
  opts._renderChildren = options._renderChildren;
  opts._componentTag = options._componentTag;
  opts._parentElm = options._parentElm;
  opts._refElm = options._refElm;
  if (options.render) {
    opts.render = options.render;
    opts.staticRenderFns = options.staticRenderFns;
  }
}

// 处理构造函数选项，最终返回 Ctor.options，子类选项 = 父类选项 + 子类扩展的选项
function resolveConstructorOptions (Ctor) {
  var options = Ctor.options;
  /*
    看一看 Vue.options，最基本的有以下 4 个选项：
    {
        components: {KeepAlive: {…}, Transition: {…}, TransitionGroup: {…}},
        directives: {model: {…}, show: {…}},
        filters: {},
        _base: Vue
    }

    Vue.options = Object.create(null);

    ① Vue.options._base = Vue;

    ② ASSET_TYPES.forEach(function (type) {
        Vue.options[type + 's'] = Object.create(null);
    });
    -> 相当于：
    Vue.options.components = {};
    Vue.options.directives = {};
    Vue.options.filters = {};

    其中，Vue.options.components 会被以下语句修改：

    // 平台相关组件
    var platformComponents = {
        Transition: Transition,
        TransitionGroup: TransitionGroup
    };
    // 通用内置组件
    var builtInComponents = {
        KeepAlive: KeepAlive
    };

    extend(Vue$3.options.components, platformComponents);
    extend(Vue.options.components, builtInComponents);

    于是：
    Vue.options.components = {KeepAlive: {…}, Transition: {…}, TransitionGroup: {…}};

    其中，Vue.options.directives 会被以下语句修改：
    var platformDirectives = {
        model: model$1,
        show: show
    };

    extend(Vue$3.options.directives, platformDirectives);

    于是：
    Vue.options.directives = {model: {…}, show: {…}}
   */
  if (Ctor.super) {
    // 处理构造函数的父类选项
    var superOptions = resolveConstructorOptions(Ctor.super);
    var cachedSuperOptions = Ctor.superOptions;

    // 本次取到的父类选项和之前的不一样
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 新的覆盖旧的
      Ctor.superOptions = superOptions;

      // check if there are any late-modified/attached options (#4976)
      // 检查是否还有最新修改的选项
      var modifiedOptions = resolveModifiedOptions(Ctor);

      // update base extend options
      if (modifiedOptions) {
        // Ctor.extendOptions 见 Vue.extend = function (extendOptions){...} 函数中定义
        extend(Ctor.extendOptions, modifiedOptions);
      }
      // 子类构造函数的 options 是父类构造函数的 options 和自身扩展的 options 和并集
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions);
      if (options.name) {
        options.components[options.name] = Ctor;
      }
    }
  }
  return options
}

// 返回被修改过的选项组成的 json 对象
function resolveModifiedOptions (Ctor) {
  var modified;
  var latest = Ctor.options;
  var extended = Ctor.extendOptions;
  var sealed = Ctor.sealedOptions;
  for (var key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) { modified = {}; }
      modified[key] = dedupe(latest[key], extended[key], sealed[key]);
    }
  }
  return modified
}

/*
  ① latest 是数组，过滤数组 latest，选出属于 extended 或不属于 sealed 的元素
  ② 否则，直接返回 latest

  dedupe 的意思就是删除重复数据
*/
function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  // 对比 latest 和 sealed 以确保在合并过程中生命周期钩子不会重复

  // latest 为数组
  if (Array.isArray(latest)) {
    var res = [];

    // 如果 sealed 和 extended 不是数组，那就转为数组
    sealed = Array.isArray(sealed) ? sealed : [sealed];
    extended = Array.isArray(extended) ? extended : [extended];

    for (var i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      // latest[i] 在数组 extended 中，并且不在数组 sealed 中
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i]);
      }
    }
    return res
  // 否则直接返回 latest
  } else {
    return latest
  }
}

// 真正的 Vue 构造函数
function Vue$3 (options) {
  // 如果 this 不是 Vue$3 的实例，发出警告：Vue 是一个构造函数，必须用 new 关键词来调用
  if ("development" !== 'production' && !(this instanceof Vue$3)) {
    warn('Vue is a constructor and should be called with the `new` keyword');
  }
  // 根据 options 完成一系列初始化操作
  this._init(options);
}

// 将 _init 方法挂载到 Vue$3.prototype 上。所以上面的 Vue$3 函数才可以调用 _init 方法
initMixin(Vue$3);

// 将 $data、$props、$set、$delete、$watch 等 5 个属性/方法挂载到 Vue$3.prototype 上
stateMixin(Vue$3);

// 将 $on、$once、$off、$emit 等 4 个方法挂载到 Vue$3.prototype 上
eventsMixin(Vue$3);

// 将 _update、$forceUpdate、$destroy 等 3 个方法挂载到 Vue$3.prototype 上
lifecycleMixin(Vue$3);

// 将 $nextTick、_render 以及 _o、_n、_s、_l、_t、_q、_i、_m、_f、_k、_b、_v、_e、_u、_g 等一系列方法挂载到 Vue$3.prototype 上
renderMixin(Vue$3);

// 定义静态方法 Vue$3.use
function initUse (Vue) {
  // 使用第三方插件
  Vue.use = function (plugin) {
    // 已经安装过的插件
    var installedPlugins = (this._installedPlugins || (this._installedPlugins = []));
    // 如果当前插件已经安装过，直接返回 this，也就是 Vue
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // 将实参转成数组形式，并剔除第一个实参，也就是说从第二个参数开始为 plugin/plugin.install 方法的实参
    var args = toArray(arguments, 1);
    // 将 Vue 添加到 args 数组开头
    args.unshift(this);
    // 如果 plugin.install 是函数，那就执行之
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args);
    // 否则，如果 plugin 是函数，执行之
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args);
    }
    // 将当前插件加入已安装过的插件数组里
    installedPlugins.push(plugin);
    return this
  };
}


// 定义静态方法 Vue$3.mixin
function initMixin$1 (Vue) {
  // 合并 Vue.options 和 mixin 对象
  Vue.mixin = function (mixin) {
    this.options = mergeOptions(this.options, mixin);
    return this
  };
  // 因为 Vue.mixin() 改变的是 Vue.options。所以这是全局注册一个混合，影响注册之后所有创建的每个 Vue 实例。
}


// 定义静态方法 Vue$3.extend
function initExtend (Vue) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  // 每个实例构造函数（包括 Vue）都有一个唯一的 cid。这使得我们能够为原型继承创建被包裹的“子构造函数”，并且缓存它们。
  Vue.cid = 0;
  var cid = 1;

  /**
   * Class inheritance 类继承
   */
  /*
    该方法的作用是使用基础 Vue 构造器，创建一个“子类”（组件的构造函数）。参数是一个包含组件选项的对象。
    其中，data 选项是特例，它在 Vue.extend() 中必须是函数。

    eg：
    <div id="mount-point"></div>

    // 创建构造器
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
    // 创建 Profile 实例，并挂载到一个元素上。
    new Profile().$mount('#mount-point')
  */
  // 构造函数继承。返回一个新的构造函数 Sub。可以理解为返回一个组件的构造函数。
  Vue.extend = function (extendOptions) {
    // 参数未定义则初始化为空对象
    extendOptions = extendOptions || {};

    // 父类
    var Super = this;
    var SuperId = Super.cid;
    // 缓存的构造函数，cachedCtors 缓存跟配置对象 extendOptions 相关的所有子类，只要给定父类 id 就可以唯一确定子类
    /*
      cachedCtors 缓存"父类 cid - 子类"集合，结构为：
      {
        SuperId1 ： Sub1,
        SuperId2 ： Sub2,
        ...
      }
     */
    var cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {});
    // 如果找到了缓存的构造函数，就此返回。配置对象 extendOptions 和父类 Super 确定了，确实可以唯一确定一个子类
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    var name = extendOptions.name || Super.options.name;
    { 
      /*
        \w : 匹配字母或数字或下划线或汉字
        /^[a-zA-Z][\w-]*$/ 匹配字母开头后面跟若干个字母或数字或下划线或汉字或-
      */
      if (!/^[a-zA-Z][\w-]*$/.test(name)) {
        // 有效的组件名之内包含字母数字和连字符，并且要以字母开头
        warn(
          'Invalid component name: "' + name + '". Component names ' +
          'can only contain alphanumeric characters and the hyphen, ' +
          'and must start with a letter.'
        );
      }
    }

    // 子构造函数
    var Sub = function VueComponent (options) {
      this._init(options);
    };

    // 继承 Vue 的原型
    Sub.prototype = Object.create(Super.prototype);
    Sub.prototype.constructor = Sub;

    
    Sub.cid = cid++;
    // 合并 Vue.options 和 extendOptions
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    );
    // super 属性指向父类
    Sub['super'] = Super;

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    /*
        对于 props 和 computed 属性，在 Vue 实例延伸期间，在扩展的原型上我们定义了代理 getters。
        这样会避免每次实例创建都调用 Object.defineProperty 方法。
    */
    if (Sub.options.props) {
      initProps$1(Sub);
    }
    if (Sub.options.computed) {
      initComputed$1(Sub);
    }

    // allow further extension/mixin/plugin usage
    // 获取父类的 extend、mixin 和 use 方法
    Sub.extend = Super.extend;
    Sub.mixin = Super.mixin;
    Sub.use = Super.use;

    // create asset registers, so extended classes
    // can have their private assets too.
    /*
    // 配置类型
    var ASSET_TYPES = [
      'component',
      'directive',
      'filter'
    ];
    */
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type];
    });

    // enable recursive self-lookup，启用递归自查找
    if (name) {
      Sub.options.components[name] = Sub;
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    // 在扩展期间保持对父级 options 的引用。后面在实例化时我们可以检查父级 options 是否更新了
    Sub.superOptions = Super.options;
    Sub.extendOptions = extendOptions;
    Sub.sealedOptions = extend({}, Sub.options);

    // cache constructor，缓存构造函数
    cachedCtors[SuperId] = Sub;
    return Sub
  };
}

// 给 Comp.prototype 添加若干属性/方法
function initProps$1 (Comp) {
  var props = Comp.options.props;
  for (var key in props) {
    // Comp.prototype[key] 代理 Comp.prototype["_props"][key]
    proxy(Comp.prototype, "_props", key);
  }
}

// 给 Comp.prototype 添加若干属性/方法
function initComputed$1 (Comp) {
  var computed = Comp.options.computed;
  for (var key in computed) {
    // 给 Comp.prototype 对象添加 key 属性，该属性的 get/set 操作由 computed[key] 指定的方法拦截 
    defineComputed(Comp.prototype, key, computed[key]);
  }
}

// 定义静态方法 Vue$3.component、Vue$3.directive、Vue$3.filter
function initAssetRegisters (Vue) {
  /**
   * Create asset registration methods.
   */
  /*
    资源类型
    var ASSET_TYPES = [
      'component',
      'directive',
      'filter'
    ];

    以获取/注册指令为例：
    // 注册（两个实参）
    Vue.directive('my-directive', {
      bind: function () {},
      inserted: function () {},
      update: function () {},
      componentUpdated: function () {},
      unbind: function () {}
    })

    // 注册（两个实参）
    Vue.directive('my-directive', function () {
      // 这里将会被 `bind` 和 `update` 调用
    })

    // 获取已注册的指令（一个实参）
    var myDirective = Vue.directive('my-directive')
  */
  ASSET_TYPES.forEach(function (type) {
    // 对 definition 进行修正，最后返回 definition
    Vue[type] = function (id, definition) {
      // ① 只有一个实参就是【获取】已注册的组件，例如 Vue.component('my-component') -> Vue.options['components']['my-component']
      if (!definition) {
        return this.options[type + 's'][id]
      // ② 两个参数，注册新组件
      } else {
        /* istanbul ignore if */
        {
          // 特殊处理一：若 Vue.component 的参数 id 不能是保留标签名
          if (type === 'component' && config.isReservedTag(id)) {
            warn(
              'Do not use built-in or reserved HTML elements as component ' +
              'id: ' + id
            );
          }
        }

        // 特殊处理二：若 Vue.component 的参数 definition 为普通对象
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id;
          /*
            其中 Vue.options._base = Vue，所以 definition = Vue.extend(definition)，也就是说：
            如果 definition 是普通对象，自动调用 Vue.extend 将它修正为一个组件
            
            所以：Vue.component('my-com', {...})
            实质是：Vue.component('my-com', Vue.extend({...}))
          */
          definition = this.options._base.extend(definition);
        }
      
        // 特殊处理三：若 Vue.directive 的参数 definition
        if (type === 'directive' && typeof definition === 'function') {
          /*
            如果 definition 是函数，那就将它修正为对象：
            { bind: definition, update: definition }

            也就是说以下两种写法等价：
            Vue.directive('my-directive', myFunc)
            Vue.directive('my-directive', {
              bind: myFunc,
              update: myFunc
            })
          */
          definition = { bind: definition, update: definition };
        }
        // 注册组件，然后返回。注意 type 后跟 's'
        this.options[type + 's'][id] = definition;
        /*
            // 官网上异步组件是这样定义的：
            Vue.component('async-example', function (resolve, reject) {
              setTimeout(function () {
                // 将组件定义传入 resolve 回调函数
                resolve({
                  template: '<div>I am async!</div>'
                })
              }, 1000)
            })

            也就是 Vue.component('async-example',fn)，不会对 fn 做任何修正
            于是，this.options['components']['async-example'] = fn;
         */
        return definition
      }
    };
  });
}

/*  */

var patternTypes = [String, RegExp, Array];

// 获取组件名称
function getComponentName (opts) {
  return opts && (opts.Ctor.options.name || opts.tag)
}

// pattern 和 name 是否匹配
function matches (pattern, name) {
  // ① pattern 是数组，name 在数组中则返回 true
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  // ② pattern 是逗号分隔的字符串，name 在这个字符串中则返回 true
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  // ③ pattern 是正则，用 test 方法来检验 name
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

// 裁剪 cache
function pruneCache (cache, current, filter) {
  for (var key in cache) {
    var cachedNode = cache[key];
    if (cachedNode) {
      var name = getComponentName(cachedNode.componentOptions);
      // 不能通过过滤器 filter 则销毁 cachedNode
      if (name && !filter(name)) {
        if (cachedNode !== current) {
          pruneCacheEntry(cachedNode);
        }
        cache[key] = null;
      }
    }
  }
}

// 销毁
function pruneCacheEntry (vnode) {
  if (vnode) {
    vnode.componentInstance.$destroy();
  }
}


var KeepAlive = {
  name: 'keep-alive',
  abstract: true,

  
  props: {
    // patternTypes = [String, RegExp, Array]
    include: patternTypes,
    exclude: patternTypes
  },

  created: function created () {
    // 空对象
    this.cache = Object.create(null);
  },

  destroyed: function destroyed () {
    var this$1 = this;

    for (var key in this$1.cache) {
      // 销毁 cache 的元素
      pruneCacheEntry(this$1.cache[key]);
    }
  },

  watch: {
    // 包含，销毁不包含的
    include: function include (val) {
      // 裁剪 this.cache
      pruneCache(this.cache, this._vnode, function (name) { return matches(val, name); });
    },
    // 不包含，销毁包含的
    exclude: function exclude (val) {
      pruneCache(this.cache, this._vnode, function (name) { return !matches(val, name); });
    }
  },

  // 返回 vnode
  render: function render () {
    var vnode = getFirstComponentChild(this.$slots.default);
    var componentOptions = vnode && vnode.componentOptions;
    if (componentOptions) {
      // check pattern
      var name = getComponentName(componentOptions);
      // name 不存在于 this.include 中，或 name 存在于 this.exclude 中，返回 vnode
      if (name && ((this.include && !matches(this.include, name)) || (this.exclude && matches(this.exclude, name)))) {
        return vnode
      }
      
      /*
        ① 若 vnode.key 为 null，那么 key 为 componentOptions.Ctor.cid + "::" + componentOptions.tag 或 componentOptions.Ctor.cid
        ② 否则，key 为 vnode.key
      */
      var key = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        // 相同的构造函数可能会被注册成不同的局部组件，所以仅仅判断 cid 是不够的
        ? componentOptions.Ctor.cid + (componentOptions.tag ? ("::" + (componentOptions.tag)) : '')
        : vnode.key;


      if (this.cache[key]) {
        vnode.componentInstance = this.cache[key].componentInstance;
      } else {
        this.cache[key] = vnode;
      }
      vnode.data.keepAlive = true;
    }
    return vnode
  }
};


// 内置组件
var builtInComponents = {
  KeepAlive: KeepAlive
};

// 初始化全局 api，也就是将一些全局方法挂载到 Vue$3 下
function initGlobalAPI (Vue) {
  // config
  var configDef = {};
  // 这里的 config 对象包含 Vue 的全局配置。包括 silent、optionMergeStrategies、devtools ...
  configDef.get = function () { return config; };
  {
    configDef.set = function () {
      // 不可以替换整个 Vue.config 对象，只能修改其属性
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      );
    };
  }
  /*
     Vue.config 是一个对象，包含 Vue 的全局配置

     之前定义了一个全局的 config 对象，包含 silent、optionMergeStrategies、devtools、mustUseProp、isReservedTag、isReservedAttr ... 等属性/方法

     不过，这个全局 config 的很多方法都是没有具体定义的，一般是空方法。
    
     这里相当于定义：Vue.config = config（获取 Vue.config 就会返回之前定义的那个全局的 config 对象）

     后面又定义了以下语句：

     Vue$3.config.mustUseProp = mustUseProp;
     Vue$3.config.isReservedTag = isReservedTag;
     Vue$3.config.isReservedAttr = isReservedAttr;
     Vue$3.config.getTagNamespace = getTagNamespace;
     Vue$3.config.isUnknownElement = isUnknownElement;

     也就是说，定义了一些真正有作用的函数，覆盖了之前 config 的默认值
   */
  Object.defineProperty(Vue, 'config', configDef);

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // 以下工具方法并不作为公共 api 的一部分。不要依赖这些方法，除非你了解这些方法的风险。
  Vue.util = {
    warn: warn,
    extend: extend,
    mergeOptions: mergeOptions,
    defineReactive: defineReactive$$1
  };

  Vue.set = set;
  Vue.delete = del;
  Vue.nextTick = nextTick;

  Vue.options = Object.create(null);
  /*
    // 配置类型
    var ASSET_TYPES = [
      'component',
      'directive',
      'filter'
    ];
    以下相当于：
    Vue.options.components = {};
    Vue.options.directives = {};
    Vue.options.filters = {};
  */
  ASSET_TYPES.forEach(function (type) {
    Vue.options[type + 's'] = Object.create(null);
  });

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue;

  // 添加内置组件 KeepAlive
  extend(Vue.options.components, builtInComponents);

  // 定义静态方法 Vue$3.use
  initUse(Vue);
  // 定义静态方法 Vue$3.mixin
  initMixin$1(Vue);
  // 定义静态方法 Vue$3.extend
  initExtend(Vue);
  // 定义静态方法 Vue$3.component、Vue$3.directive、Vue$3.filter
  initAssetRegisters(Vue);
}

initGlobalAPI(Vue$3);

// 定义 Vue$3.prototype.$isServer，即是否在服务器环境
Object.defineProperty(Vue$3.prototype, '$isServer', {
  get: isServerRendering
});

// 定义 Vue$3.prototype.$ssrContext
Object.defineProperty(Vue$3.prototype, '$ssrContext', {
  get: function get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
});

// 当前版本是 2.4.0
Vue$3.version = '2.4.0';

/*  */

// these are reserved for web because they are directly compiled away
// during template compilation
/*
 style,class 属性是为 web 保留的。因为在模板编译过程中它们是直接编译的。

 makeMap 方法检验字符串是不是在 str 中，eg:
 makeMap('aaa,bbb,ccc',true)('aa')  -> undefined
 makeMap('aaa,bbb,ccc',true)('aaa') -> true

 isReservedAttr 方法用来判断参数是否为 style 或 class
*/
var isReservedAttr = makeMap('style,class');

// attributes that should be using props for binding
// acceptValue 方法用来判断参数是否为 input,textarea,option,select 四者之一
var acceptValue = makeMap('input,textarea,option,select');


// 以下 4 种情况必须用 prop
var mustUseProp = function (tag, type, attr) {
  return (
    (attr === 'value' && acceptValue(tag)) && type !== 'button' ||
    (attr === 'selected' && tag === 'option') ||
    (attr === 'checked' && tag === 'input') ||
    (attr === 'muted' && tag === 'video')
  )
};

// 参数为 contenteditable,draggable,spellcheck 三者之一，说明是可枚举属性
var isEnumeratedAttr = makeMap('contenteditable,draggable,spellcheck');

// 参数为以下值之一，说明是布尔属性
var isBooleanAttr = makeMap(
  'allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,' +
  'default,defaultchecked,defaultmuted,defaultselected,defer,disabled,' +
  'enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,' +
  'muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,' +
  'required,reversed,scoped,seamless,selected,sortable,translate,' +
  'truespeed,typemustmatch,visible'
);

/*
 参考：http://www.w3school.com.cn/xlink/xlink_syntax.asp

 ① XLink 是 XML Linking language 的缩写，XLink 用于在 XML 文档中创建超级链接的标准方法，类似于 html 链接，但更强大
 ② 为了访问 XLink 的属性和特性，我们必须在文档的顶端声明 XLink 命名空间。XLink 的命名空间是："http://www.w3.org/1999/xlink"。

 eg:
    <?xml version="1.0"?>
    <homepages xmlns:xlink="http://www.w3.org/1999/xlink">
        <homepage xlink:type="simple" xlink:href="http://www.w3school.com.cn">Visit W3School</homepage>
        <homepage xlink:type="simple" xlink:href="http://www.w3.org">Visit W3C</homepage>
    </homepages>

    <homepage> 元素中的 xlink:type 和 xlink:href 属性定义了来自 XLink 命名空间的 type 和 href 属性。
    xlink:type="simple" 可创建一个简单的两端链接（意思是“从这里到哪里”）。另外，还有多端链接（多方向）。
*/
var xlinkNS = 'http://www.w3.org/1999/xlink';

// 是否为 xlink
var isXlink = function (name) {
  return name.charAt(5) === ':' && name.slice(0, 5) === 'xlink'
};

// 获取 xlink 的 prop 名，也就是排除 xlink: 这前 6 个字符
var getXlinkProp = function (name) {
  return isXlink(name) ? name.slice(6, name.length) : ''
};

// 是否为假值，即 null、undefined 或 false
var isFalsyAttrValue = function (val) {
  return val == null || val === false
};

// 生成 class 给 vnode 用
function genClassForVnode (vnode) {
  var data = vnode.data;
  var parentNode = vnode;
  var childNode = vnode;
  // 从当前组件开始，逐级向子组件取 class
  while (isDef(childNode.componentInstance)) {
    childNode = childNode.componentInstance._vnode;
    if (childNode.data) {
      // 合并子组件和当前组件的 class
      data = mergeClassData(childNode.data, data);
    }
  }
  // 从当前组件开始，逐级向父组件取 class
  while (isDef(parentNode = parentNode.parent)) {
    if (parentNode.data) {
      // 合并当前组件和父组件的 class
      data = mergeClassData(data, parentNode.data);
    }
  }
  return renderClass(data.staticClass, data.class)
}

// 返回一个 json 对象，包含 staticClass 和 class 等两个属性
function mergeClassData (child, parent) {
  return {
    // 静态 class 由父组件和子组件的静态 class 拼接而成 
    staticClass: concat(child.staticClass, parent.staticClass),
    class: isDef(child.class)
      ? [child.class, parent.class]
      : parent.class
  }
}

// 返回 class 
function renderClass (
  staticClass,
  dynamicClass
) {
  if (isDef(staticClass) || isDef(dynamicClass)) {
      // 拼接静态的和动态的 class
    return concat(staticClass, stringifyClass(dynamicClass))
  }
  /* istanbul ignore next */
  return ''
}

// 链接字符串 a 和 b，中间用空格分开
function concat (a, b) {
  return a ? b ? (a + ' ' + b) : a : (b || '')
}

// 从 value 中提取字符串形式的 class 值
function stringifyClass (value) {
  // 数组元素之间空格分开
  if (Array.isArray(value)) {
    return stringifyArray(value)
  }
  // 对象键名之间空格分开
  if (isObject(value)) {
    return stringifyObject(value)
  }
  // 字符串返回本身
  if (typeof value === 'string') {
    return value
  }
  /* istanbul ignore next */
  // 以上都不满足，就返回空字符串
  return ''
}

/*
数组转为字符串形式，元素之间用空格分开，例如：
stringifyArray(['cls1','cls2','cls3']);
-> "cls1 cls2 cls3"
*/
function stringifyArray (value) {
  var res = '';
  var stringified;
  for (var i = 0, l = value.length; i < l; i++) {
    if (isDef(stringified = stringifyClass(value[i])) && stringified !== '') {
      // 元素之间用空格分开
      if (res) { res += ' '; }
      res += stringified;
    }
  }
  return res
}

/*
对象转为字符串形式，注意只取出对象的键名，用空格分开，例如：
stringifyObject({
    cls1 : 'val1',
    cls2 : 'val2',
    cls3 : 'val3'
});
-> "cls1 cls2 cls3"
*/ 
function stringifyObject (value) {
  var res = '';
  for (var key in value) {
    if (value[key]) {
      // 键名之间用空格分开
      if (res) { res += ' '; }
      res += key;
    }
  }
  return res
}

// 命名空间映射
var namespaceMap = {
  svg: 'http://www.w3.org/2000/svg',
  math: 'http://www.w3.org/1998/Math/MathML'
};

// html 保留标签名
var isHTMLTag = makeMap(
  'html,body,base,head,link,meta,style,title,' +
  'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
  'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
  'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
  's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
  'embed,object,param,source,canvas,script,noscript,del,ins,' +
  'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
  'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
  'output,progress,select,textarea,' +
  'details,dialog,menu,menuitem,summary,' +
  'content,element,shadow,template,blockquote,iframe,tfoot'
);

// this map is intentionally selective, only covering SVG elements that may
// contain child elements.
// svg 保留标签名，这里只是挑选了部分可能包含子元素的 svg 元素
var isSVG = makeMap(
  'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
  'foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
  'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
  true
);

// 是否为 pre 标签
var isPreTag = function (tag) { return tag === 'pre'; };

// 是否是保留标签
var isReservedTag = function (tag) {
  return isHTMLTag(tag) || isSVG(tag)
};

// 获取标签的命名空间
function getTagNamespace (tag) {
  if (isSVG(tag)) {
    return 'svg'
  }
  // basic support for MathML
  // note it doesn't support other MathML elements being component roots
  // 这里只是对 MathML 最基本的支持。注意，并不支持其他的 MathML 元素
  if (tag === 'math') {
    return 'math'
  }
}

// 存储未知组件名
var unknownElementCache = Object.create(null);

// 是否为未知组件名
function isUnknownElement (tag) {
  /* istanbul ignore if */
  // 只要不是浏览器环境，就返回 true
  if (!inBrowser) {
    return true
  }
  // 保留标签，返回 false
  if (isReservedTag(tag)) {
    return false
  }
  tag = tag.toLowerCase();
  /* istanbul ignore if */
  // 如果有缓存的话，返回缓存结果
  if (unknownElementCache[tag] != null) {
    return unknownElementCache[tag]
  }
  var el = document.createElement(tag);
  // tag 中包含 '-'，判断 el.constructor 是否为 window.HTMLUnknownElement 或 window.HTMLElement
  if (tag.indexOf('-') > -1) {
    // http://stackoverflow.com/a/28210364/1070244
    return (unknownElementCache[tag] = (
      el.constructor === window.HTMLUnknownElement ||
      el.constructor === window.HTMLElement
    ))
  // 否则，判断 el.toString() 中是否包含字符串 HTMLUnknownElement
  } else {
    return (unknownElementCache[tag] = /HTMLUnknownElement/.test(el.toString()))
  }
}

/*  */

/**
 * Query an element selector if it's not an element already.
 */
// 根据 el 选择器，返回对应元素，如果找不到，就新创建一个 div 返回
function query (el) {
  // el 为字符串选择器
  if (typeof el === 'string') {
    // 注意这里使用的是 querySelector，也就是返回查询到的第一个元素。一般情况下，我们应该传入一个 id 或确定的 dom 节点。
    var selected = document.querySelector(el);
    if (!selected) {
      "development" !== 'production' && warn(
        'Cannot find element: ' + el
      );
      // 找不到则新建一个 div 返回
      return document.createElement('div')
    }
    return selected
  // el 本身就是元素
  } else {
    return el
  }
}

// 创建元素并返回该元素。只有 select 元素会特殊对待
function createElement$1 (tagName, vnode) {
  var elm = document.createElement(tagName);
  if (tagName !== 'select') {
    return elm
  }
  // false or null will remove the attribute but undefined will not
  // 当 vnode.data.attrs.multiple 不为 undefined 时，给 select 元素加上 multiple 属性
  if (vnode.data && vnode.data.attrs && vnode.data.attrs.multiple !== undefined) {
    elm.setAttribute('multiple', 'multiple');
  }
  return elm
}

// 创建一个具有指定的命名空间 namespace 和限定名称 tagName 的元素。
function createElementNS (namespace, tagName) {
  /*
    var namespaceMap = {
        svg: 'http://www.w3.org/2000/svg',
        math: 'http://www.w3.org/1998/Math/MathML'
    };
  */
  return document.createElementNS(namespaceMap[namespace], tagName)
}

// 创建文本节点
function createTextNode (text) {
  return document.createTextNode(text)
}

// 创建注释节点
function createComment (text) {
  return document.createComment(text)
}

// 将 newNode 元素插入到参考节点 referenceNode 之前
function insertBefore (parentNode, newNode, referenceNode) {
  parentNode.insertBefore(newNode, referenceNode);
}

// 删除子节点
function removeChild (node, child) {
  node.removeChild(child);
}

// 添加子节点
function appendChild (node, child) {
  node.appendChild(child);
}

// 获取父节点
function parentNode (node) {
  return node.parentNode
}

// nextSibling 属性返回指定节点之后紧跟的节点，在相同的树层级中
function nextSibling (node) {
  return node.nextSibling
}

// 获取元素标签名（大写字母构成）
function tagName (node) {
  return node.tagName
}

// 设置元素的文本
function setTextContent (node, text) {
  node.textContent = text;
}

// 设置元素属性
function setAttribute (node, key, val) {
  node.setAttribute(key, val);
}

/*
 Object.freeze() 方法可以冻结一个对象，冻结指的是不能向这个对象添加新的属性，
 不能修改其已有属性的值，不能删除已有属性，以及不能修改该对象已有属性的可枚举性、可配置性、可写性。
 也就是说，这个对象永远是不可变的。该方法返回被冻结的对象。
*/
var nodeOps = Object.freeze({
    createElement: createElement$1,
    createElementNS: createElementNS,
    createTextNode: createTextNode,
    createComment: createComment,
    insertBefore: insertBefore,
    removeChild: removeChild,
    appendChild: appendChild,
    parentNode: parentNode,
    nextSibling: nextSibling,
    tagName: tagName,
    setTextContent: setTextContent,
    setAttribute: setAttribute
});

/*  */

var ref = {
  // 添加引用 ref
  create: function create (_, vnode) {
    registerRef(vnode);
  },
  // 更新引用 ref
  update: function update (oldVnode, vnode) {
    // oldVnode 和 vnode 的 ref 不一样，则删除旧的，添加新的
    if (oldVnode.data.ref !== vnode.data.ref) {
      registerRef(oldVnode, true);
      registerRef(vnode);
    }
  },
  // 删除引用 ref
  destroy: function destroy (vnode) {
    registerRef(vnode, true);
  }
};

/*
    ① 参数 isRemoval 为 true，删除引用
    ② 否则，添加引用
 */
function registerRef (vnode, isRemoval) {
  var key = vnode.data.ref;
  // 如果没有 vnode.data.ref，直接返回
  if (!key) { return }

  /*
      vm 为当前 vnode 所在的父组件实例，例如上例中的 parent
      vm.$refs 用来管理所有子组件的引用
   */
  var vm = vnode.context;

  // vnode 对应的组件实例，也就是 ref
  var ref = vnode.componentInstance || vnode.elm;
  var refs = vm.$refs;

  // 1. 删除引用
  if (isRemoval) {
    /*
        ① refs[key] 是数组，删除数组中的 ref

        当 ref 和 v-for 一起使用时，获取到的引用会是一个数组，包含和循环数据源对应的子组件。
        所以 refs[key] 是一组组件实例，ref 就是其中一个
     */
    if (Array.isArray(refs[key])) {
      remove(refs[key], ref);
    // ② refs[key] 不是数组，直接置为 undefined
    } else if (refs[key] === ref) {
      refs[key] = undefined;
    }
  // 2. 添加引用
  } else {
    // ① 当 ref 和 v-for 一起使用时，需要 refs[key] 需要转为数组
    if (vnode.data.refInFor) {
      // refs[key] 不是数组，转为数组
      if (!Array.isArray(refs[key])) {
        refs[key] = [ref];
      // refs[key] 是数组，添加 ref 
      } else if (refs[key].indexOf(ref) < 0) {
        refs[key].push(ref);
      }
    // ② 一般情况，直接给 refs 添加 key 属性就好了
    } else {
      refs[key] = ref;
    }
  }
}

/**
 * Virtual DOM patching algorithm based on Snabbdom by
 * Simon Friis Vindum (@paldepind)
 * Licensed under the MIT License
 * https://github.com/paldepind/snabbdom/blob/master/LICENSE
 *
 * modified by Evan You (@yyx990803)
 *
   虚拟节点算法参考的是 Snabbdom
/*
 * Not type-checking this because this file is perf-critical and the cost
 * of making flow understand it is not worth it.
 */

// 创建空节点，除了 tag -> ''，data -> {} ，children -> []，其他属性都是 undefined/false
var emptyNode = new VNode('', {}, []);

var hooks = ['create', 'activate', 'update', 'remove', 'destroy'];

/*
    该函数判断 a 和 b 是否可以视作“同一棵树”，从而进行一对一的更新
    （注意：a 和 b 肯定不是同一个 VNode 实例，否则干嘛不直接用 a === b 判断）
    
    这里可以看出：【重要】key 值相等是判断两个 vnode 是否“相同”的首要条件
    
    也就是说，只有 key 值相同的节点才可能 sameVnode (a, b) === true
    进而才可能执行 patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly)
 */
function sameVnode (a, b) {
  return (
    /*
        运算符的优先级： === 高于 && 高于 ||
        这里：a.key === b.key && ((condition1) || (condition2))
        
        ① 两个 vnode 的 key 值必须一样
        ② 以下两个条件必须满足其一：
           a. 普通组件的 tag、isComment、data 状态、inputType 类型等一样
           b. 异步组件占位符的 asyncFactory、asyncFactory.error 状态等一样
     */
    a.key === b.key && (
      (
        // tag、isComment、data、inputType 等一样
        a.tag === b.tag &&
        a.isComment === b.isComment &&
        isDef(a.data) === isDef(b.data) &&
        sameInputType(a, b)
      ) || (
        isTrue(a.isAsyncPlaceholder) &&
        a.asyncFactory === b.asyncFactory &&
        isUndef(b.asyncFactory.error)
      )
    )
  )
}

// Some browsers do not support dynamically changing type for <input>
// so they need to be treated as different nodes
/*
    有些浏览器不支持动态改变 <input> 标签的 type 类型。所以它们需要被当做不同的节点。
    下面的方法判断两个 <input> 标签的 type 类型是否一致。
 */
function sameInputType (a, b) {
  // ① 如果第一个参数不是 input 标签，那么直接返回 true
  if (a.tag !== 'input') { return true }
  var i;
  var typeA = isDef(i = a.data) && isDef(i = i.attrs) && i.type;
  var typeB = isDef(i = b.data) && isDef(i = i.attrs) && i.type;
  // ② 若 a.data.attrs.type === b.data.attrs.type，那么返回 true
  return typeA === typeB
}

/*
  将 children 中每个 children[i] 的 i 和 children[i].key 对应起来
  返回值 map 结构大致为：
  {
    key0 : idx0,
    key1 : idx1,
    key2 : idx2,
    ...
  }
 */
function createKeyToOldIdx (children, beginIdx, endIdx) {
  var i, key;
  var map = {};
  for (i = beginIdx; i <= endIdx; ++i) {
    key = children[i].key;
    if (isDef(key)) { map[key] = i; }
  }
  return map
}

/*
    简化一下下面这个长达 600 行的方法：
    export function createPatchFunction (backend) {
        // 初始化 cbs = {...}

        function emptyNodeAt (elm) {...}
        function createRmCb (childElm, listeners) {...}
        function removeNode (el) {...}
        function createElm (vnode, insertedVnodeQueue, parentElm, refElm, nested) {...}
        function createComponent (vnode, insertedVnodeQueue, parentElm, refElm) {...}
        function initComponent (vnode, insertedVnodeQueue) {...}
        function reactivateComponent (vnode, insertedVnodeQueue, parentElm, refElm) {...}
        function insert (parent, elm, ref$$1) {...}
        function createChildren (vnode, children, insertedVnodeQueue) {...}
        function isPatchable (vnode) {...}
        function invokeCreateHooks (vnode, insertedVnodeQueue) {...}
        function setScope (vnode) {...}
        function addVnodes (parentElm, refElm, vnodes, startIdx, endIdx, insertedVnodeQueue) {...}
        function invokeDestroyHook (vnode) {...}
        function removeVnodes (parentElm, vnodes, startIdx, endIdx) {...}
        function removeAndInvokeRemoveHook (vnode, rm) {...}
        function updateChildren (parentElm, oldCh, newCh, insertedVnodeQueue, removeOnly) {...}
        function patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly) {...}
        function invokeInsertHook (vnode, queue, initial) {...}
        function hydrate (elm, vnode, insertedVnodeQueue) {...}
        function assertNodeMatch (node, vnode) {...}

        return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {...}
    }

    再简化一点：
    export function createPatchFunction (backend) {
        // ...
        return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {...}
    }

    实际调用时：
    var patch = createPatchFunction({ nodeOps: nodeOps, modules: modules });
    其中：
    ① nodeOps 对象封装了 dom 操作相关方法
      nodeOps = Object.freeze({
          createElement: createElement$1,
          createElementNS: createElementNS,
          createTextNode: createTextNode,
          createComment: createComment,
          insertBefore: insertBefore,
          removeChild: removeChild,
          appendChild: appendChild,
          parentNode: parentNode,
          nextSibling: nextSibling,
          tagName: tagName,
          setTextContent: setTextContent,
          setAttribute: setAttribute
      });
    ② modules 为属性、指令等相关的生命周期方法
      modules = [
          attrs,
          klass,
          events,
          domProps,
          style,
          transition,
          ref,
          directives
      ]
      更具体点：
      modules = [
        {
            create: updateAttrs,
            update: updateAttrs
        },
        {
            create: updateClass,
            update: updateClass
        },
        {
            create: updateDOMListeners,
            update: updateDOMListeners
        },
        {
            create: updateDOMProps,
            update: updateDOMProps
        },
        {
            create: updateStyle,
            update: updateStyle
        },
        {
            create: _enter,
            activate: _enter,
            remove: function remove$$1 (vnode, rm) {}
        },
        {
            create: function create (_, vnode) {},
            update: function update (oldVnode, vnode) {},
            destroy: function destroy (vnode) {}
        },
        {
            create: updateDirectives,
            update: updateDirectives,
            destroy: function unbindDirectives (vnode) {
              updateDirectives(vnode, emptyNode);
            }
        }
      ]
 */
// 最终返回一个函数（函数名为 patch）
function createPatchFunction (backend) {
  var i, j;
  var cbs = {};
 
  // modules 为数组 [attrs,klass,events,domProps,style,transition,ref,directives]，数组每个项包括 create、update 等方法
  var modules = backend.modules;
  // nodeOps 为对象，对象包括 createElement、insertBefore 等 dom 操作方法
  var nodeOps = backend.nodeOps;
 
  // hooks = ['create', 'activate', 'update', 'remove', 'destroy']
  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = [];
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        cbs[hooks[i]].push(modules[j][hooks[i]]);
      }
    }
  }
  /*
    于是，cbs 结构如下：
    {
        create : [
            updateAttrs(oldVnode, vnode)
            updateClass(oldVnode, vnode)
            updateDOMListeners(oldVnode, vnode)
            updateDOMProps(oldVnode, vnode)
            updateStyle(oldVnode, vnode)
            _enter(_, vnode)
            create(_, vnode)
            updateDirectives(oldVnode, vnode)
        ],
        activate : [
            _enter(_, vnode)
        ],
        update : [
            updateAttrs(oldVnode, vnode)
            updateClass(oldVnode, vnode)
            updateDOMListeners(oldVnode, vnode)
            updateDOMProps(oldVnode, vnode)
            updateStyle(oldVnode, vnode)
            update(oldVnode, vnode)
            updateDirectives(oldVnode, vnode)
        ],
        remove : [
            remove$$1(vnode, rm)
        ],
        destroy : [
            destroy(vnode)
            unbindDirectives(vnode)
        ]
    }
  */

  /*
      ① nodeOps.tagName(elm) 方法获取 dom 元素 elm 的 tagName 属性（大写字母构成）
      ② emptyNodeAt (elm) 的作用是以 elm 元素创建一个空的 vnode 实例
   */
  function emptyNodeAt (elm) {
    // 第 5 个参数 elm 表示 vnode.elm = elm
    return new VNode(nodeOps.tagName(elm).toLowerCase(), {}, [], undefined, elm)
  }

  
  /* 
      创建 remove listeners 的回调
      ① 执行 createRmCb (childElm, listeners) 返回一个闭包 remove
      ② 执行 remove() -> --remove.listeners
      ③ 若 remove.listeners === 0，执行 removeNode(childElm)

      例如 var rm = createRmCb (childElm, 3)
      那么，执行 3 次 rm 函数才会移除元素 childElm
  */
  function createRmCb (childElm, listeners) {
    // 每调用一次该方法，remove$$1.listeners 减 1，当减到 0 时，移除 childElm 元素
    function remove$$1 () {
      if (--remove$$1.listeners === 0) {
        // 从 dom 中移除 childElm
        removeNode(childElm);
      }
    }
    // 把 listeners 挂载到函数（对象） remove$$1 下
    remove$$1.listeners = listeners;
    return remove$$1
  }

  /*
      ① 找到 dom 元素 el 的父元素 parent
      ② 从父元素 parent 中移除元素 el
   */
  function removeNode (el) {
    // 原生获取 el 元素的父节点
    var parent = nodeOps.parentNode(el);
    // element may have already been removed due to v-html / v-text
    if (isDef(parent)) {
      // 原生删除节点 el
      nodeOps.removeChild(parent, el);
    }
  }

  var inPre = 0;

  // 根据 vnode 新的生成 dom 元素
  function createElm (vnode, insertedVnodeQueue, parentElm, refElm, nested) {
    // 是否为根节点插入
    vnode.isRootInsert = !nested; // for transition enter check

    /*
        ① 只有 vnode.data && vnode.componentInstance 都存在，才会返回 true
        ② createComponent 函数生成 dom 元素，但是暂时不挂载
     */ 
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return
    }

    var data = vnode.data;
    var children = vnode.children;
    var tag = vnode.tag;


    // 1. 生成元素
    if (isDef(tag)) {
      { 
        /*
            v-pre 指令表示跳过这个元素和它的子元素的编译过程。可以用来显示原始 Mustache 标签，例如：
            <span v-pre>{{ this will not be compiled }}</span>

            ① processPre (el) 中：
            if (getAndRemoveAttr(el, 'v-pre') != null) {
                el.pre = true;
            }
            ② genData$2(el, state) 中：
            if (el.pre) {
                data += "pre:true,";
            }
         */
        if (data && data.pre) {
          inPre++;
        }
        if (
          !inPre &&
          !vnode.ns &&
          !(config.ignoredElements.length && config.ignoredElements.indexOf(tag) > -1) &&
          config.isUnknownElement(tag)
        ) {
          // 未知类型的自定义元素 <tag> - 你有正确注册这个组件吗？对于递归组件，确保提供了 name 选项
          warn(
            'Unknown custom element: <' + tag + '> - did you ' +
            'register the component correctly? For recursive components, ' +
            'make sure to provide the "name" option.',
            vnode.context
          );
        }
      }

      /*
          namespaceMap = {
            svg: 'http://www.w3.org/2000/svg',
            math: 'http://www.w3.org/1998/Math/MathML'
          }

          ① vnode.ns 存在，调用原生 document.createElementNS(namespaceMap[vnode.ns], tag) 方法创建命名空间
          ② 否则，调用原生 document.createElement(tag) 方法创建 dom 元素
       */
      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag)
        : nodeOps.createElement(tag, vnode);

      // 有可能的话将 vnode.elm 的 ancestor.context.$options._scopeId 属性值设为空字符串 ''
      setScope(vnode);

      {
        // 生成一组子元素，分别插入到 vnode.elm 这个元素中
        createChildren(vnode, children, insertedVnodeQueue);

        /*
            ① 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
            ② 执行 vnode.data.hook.create(emptyNode, vnode)
            ③ 将 vnode 加入队列到 insertedVnodeQueue 中
         */
        if (isDef(data)) {
          invokeCreateHooks(vnode, insertedVnodeQueue);
        }
        // 将 vnode.elm 插入到父元素 parentElm 中（参考节点 refElm 之前）
        insert(parentElm, vnode.elm, refElm);
      }

      if ("development" !== 'production' && data && data.pre) {
        inPre--;
      }
    // 2. 生成注释
    } else if (isTrue(vnode.isComment)) {
      // 原生方法 document.createComment(vnode.text) 创建注释元素
      vnode.elm = nodeOps.createComment(vnode.text);
      // 把新创建的这个注释节点插入到参考节点 refElm 之前
      insert(parentElm, vnode.elm, refElm);
    // 3. 生成文本
    } else {
      // 调用原生 document.createTextNode(vnode.text) 方法创建文本元素
      vnode.elm = nodeOps.createTextNode(vnode.text);
      // 把新创建的这个文本节点插入到参考节点 refElm 之前
      insert(parentElm, vnode.elm, refElm);
    }
  }


  /*
      简单地认为做了 3 件事：
      ① 调用 vnode.data.hook.init() 方法，也就是说若该 vnode 没有对应的组件实例，那就创建一个新的，并渲染，但暂时不挂载
      ② 将 vnode 和 vnode 的所有子树的根 vnode 都会添加到数组 insertedVnodeQueue 中
      ③ 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
   
      再简单点说，该函数根据 vnode，创建 vnode.componentInstance 组件，并渲染，不挂载。
      
      只有 vnode.data && vnode.componentInstance 都存在，才会返回 true
   */
  function createComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
    var i = vnode.data;
    
    if (isDef(i)) {
      var isReactivated = isDef(vnode.componentInstance) && i.keepAlive;
      /*
        i = componentVNodeHooks.init，该钩子方法的作用是：
        ① 若该 vnode 没有对应的组件实例，那就创建一个新的，并渲染，但暂时不挂载该组件
        ② vnode 有对应的组件实例，那就更新这个组件
     */
      if (isDef(i = i.hook) && isDef(i = i.init)) {
        /*
            init 函数的第二个参数为 false，执行的是 vnode.componentInstance(undefined,false)
            这意味着只渲染该组件，但是不挂载，例如：

            var component = new MyComponent().$mount()
            document.getElementById('app').appendChild(component.$el)
            $mount() 函数参数为空/undefined，在文档之外渲染，随后再挂载
            
            -> vnode.data.hook.init(vnode, false, parentElm, refElm)
            -> vnode.componentInstance.$mount(undefined, false)

            说明：这里只生成了真实的 dom 元素，但暂时不挂载
         */
        i(vnode, false /* hydrating */, parentElm, refElm);
      }
      // after calling the init hook, if the vnode is a child component
      // it should've created a child instance and mounted it. the child
      // component also has set the placeholder vnode's elm.
      // in that case we can just return the element and be done.
      /*
         在调用 init 钩子后，如果 vnode 是一个子组件，那它应该创建了一个子实例并且插入过文档中。
         这个子组件同样也设置了占位符 vnode 的 elm。这样的话我们直接返回这个元素就好了。
      */
      if (isDef(vnode.componentInstance)) {
        /*
            ① 将 vnode 和 vnode 的所有子树的根 vnode 都会添加到数组 insertedVnodeQueue 中
            ② 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
         */
        initComponent(vnode, insertedVnodeQueue);
        if (isTrue(isReactivated)) {
          // 重新激活组件
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm);
        }
        return true
      }
    }
  }

  /*
      简单地认为做了 3 件事：
      ① 将 vnode 的所有子树的根 vnode 都会添加到数组 insertedVnodeQueue 中
      ② 将 vnode 加入队列到 insertedVnodeQueue 中
      ③ 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
   */
  function initComponent (vnode, insertedVnodeQueue) {
    /*
        ① 若 vnode.data.pendingInsert 存在（数组，数组元素是 vnode 的每个子实例对应的根 vnode）
        ② 那就将数组 vnode.data.pendingInsert 合并到数组 insertedVnodeQueue 里
        ③ vnode.data.pendingInsert 置为 null（不能直接清空该数组，空数组也是 true）
        
        这样下来，vnode 的所有子树的根 vnode 都会添加到数组 insertedVnodeQueue 中
     */
    if (isDef(vnode.data.pendingInsert)) {
      // 将数组 vnode.data.pendingInsert 中元素依次加到 insertedVnodeQueue 尾部
      insertedVnodeQueue.push.apply(insertedVnodeQueue, vnode.data.pendingInsert);
      // 然后，将 vnode.data.pendingInsert 清空
      vnode.data.pendingInsert = null;
    }

    /* 
        ① 将 vnode.data.hook.init() 方法生成的 vnode.componentInstance.$el 赋给 vnode.elm ？
        ② vnode.componentInstance.$el 是真实的 dom 元素
    */
    vnode.elm = vnode.componentInstance.$el;


    // 1. vnode 是有实在内容的 vnode
    if (isPatchable(vnode)) {
      /*
          ① 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
          ② 执行 vnode.data.hook.create(emptyNode, vnode)
          ③ 将 vnode 加入队列到 insertedVnodeQueue 中
       */
      invokeCreateHooks(vnode, insertedVnodeQueue);
      // 有可能的话将 vnode.elm 的 ancestor.context.$options._scopeId 属性值设为空字符串 ''
      setScope(vnode);
    // 2. 没有实在内容的 vnode，除了 ref，其他的都不要
    } else {
      // empty component root.
      // skip all element-related modules except for ref (#3455)
      // 空组件根节点。跳过所有元素相关的模块，除了 ref
      // 添加引用，这样就可以通过 vnode.context.$refs[vnode.data.ref] 找到 vnode.componentInstance 这个组件实例了
      registerRef(vnode);
      // 将 vnode 加入队列到 insertedVnodeQueue 中
      insertedVnodeQueue.push(vnode);
    }
  }

  // 激活组件
  function reactivateComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
    var i;
    // hack for #4339: a reactivated component with inner transition
    // does not trigger because the inner node's created hooks are not called
    // again. It's not ideal to involve module-specific logic in here but
    // there doesn't seem to be a better way to do it.
    /*
        一个内部有 transition 的 reactivated 组件不会触发，因为内部节点的 created 钩子没再触发。
        在这里执行特殊的逻辑并不是很理想的办法，但是貌似也没更好的办法了
     */ 

    var innerNode = vnode;
    // 递归激活内部节点
    while (innerNode.componentInstance) {
      innerNode = innerNode.componentInstance._vnode;
      // 只要有一个子树有 transition，那就停止循环
      if (isDef(i = innerNode.data) && isDef(i = i.transition)) {
        /*
        cbs.activate : [
            _enter(_, vnode)
        ]
        */
        for (i = 0; i < cbs.activate.length; ++i) {
          // 激活节点
          cbs.activate[i](emptyNode, innerNode);
        }
        insertedVnodeQueue.push(innerNode);
        break
      }
    }
    // unlike a newly created component,
    // a reactivated keep-alive component doesn't insert itself
    // 不同于新建的组件，一个重新激活的 keep-alive 组件不会插入自身
    // 将节点 vnode.elm 插入到参考节点 refElm 之前
    insert(parentElm, vnode.elm, refElm);
  }

  // 将节点 elm 插入到参考节点 ref$$1 之前
  function insert (parent, elm, ref$$1) {
    if (isDef(parent)) {
      if (isDef(ref$$1)) {
        // ① 存在参考元素 ref，将 elm 插入 ref 之前
        if (ref$$1.parentNode === parent) {
          // 将节点 elm 插入到参考节点 ref$$1 之前
          nodeOps.insertBefore(parent, elm, ref$$1);
        }
      } else {
        // ② 否则，在 parent 末尾插入元素 elm
        nodeOps.appendChild(parent, elm);
      }
    }
  }

  // 生成一组 dom 元素（vnode 节点的子元素）
  function createChildren (vnode, children, insertedVnodeQueue) {
    // ① 子元素是一组节点
    if (Array.isArray(children)) {
      for (var i = 0; i < children.length; ++i) {
        /*
            对比一下形参 createElm (vnode, insertedVnodeQueue, parentElm, refElm, nested)
            vnode.elm 对应 parentElm
         */ 
        createElm(children[i], insertedVnodeQueue, vnode.elm, null, true);
      }
    // ② 子元素是文本
    } else if (isPrimitive(vnode.text)) {
      nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(vnode.text));
    }
  }

  // vnode 是否可修补（是否有实实在在的内容），返回布尔值
  function isPatchable (vnode) {
    // 一层一层往下找，找到最深的 vnode 的 tag，只要定义了 tag 说明这个 vnode 是有实在内容的，那就值得修补
    while (vnode.componentInstance) {
      // vm._vnode  保存的是 vm 对应的 vnode，子树的根
      vnode = vnode.componentInstance._vnode;
    }
    // vnode.tag 存在
    return isDef(vnode.tag)
  }

  /*
      ① 依次调用 cbs.create[i] 钩子函数来更新 attr、class、listeners 等等
      ② 执行 vnode.data.hook.create(emptyNode, vnode)
      ③ 将 vnode 加入队列到 insertedVnodeQueue 中
   */
  function invokeCreateHooks (vnode, insertedVnodeQueue) {

    for (var i$1 = 0; i$1 < cbs.create.length; ++i$1) {
      cbs.create[i$1](emptyNode, vnode);
    }
    /*
      cbs.create : [
          updateAttrs(oldVnode, vnode)
          updateClass(oldVnode, vnode)
          updateDOMListeners(oldVnode, vnode)
          updateDOMProps(oldVnode, vnode)
          updateStyle(oldVnode, vnode)
          _enter(_, vnode)
          create(_, vnode)
          updateDirectives(oldVnode, vnode)
      ]

      vnode.data.hook 即包括 ["init", "prepatch", "insert", "destroy"] 等 4 个钩子方法
      还包括其他自定义的钩子方法，比如 create
     */
    i = vnode.data.hook; // Reuse variable
    if (isDef(i)) {
      if (isDef(i.create)) { i.create(emptyNode, vnode); }
      if (isDef(i.insert)) { insertedVnodeQueue.push(vnode); }
    }
  }

  // set scope id attribute for scoped CSS.
  // this is implemented as a special case to avoid the overhead
  // of going through the normal attribute patching process.
  /*
      该函数目的是给元素添加一个特殊的 id，避免 css 样式影响其他模块
      这么做是为了避免正常属性更新过程中的开销
   */
  function setScope (vnode) {
    var i;
    var ancestor = vnode;

    // ① 遍历祖先实例，有可能的话将 vnode.elm 的 ancestor.context.$options._scopeId 属性值设为空字符串 ''
    while (ancestor) {
      /*
          ① ancestor.context 是父组件实例
          ② ancestor.context.$options._scopeId 属性存在

          只要有一个祖先实例有 i 属性，那就将 vnode.el 的 i 属性值置为空，这里难道不应该 break 吗？
          
          循环下来，就给 vnode.elm 添加了很多值为 '' 的属性，如：
          <div scopeId1 scopeId2 scopeId3>
       */ 
      if (isDef(i = ancestor.context) && isDef(i = i.$options._scopeId)) {
        // 将 vnode.elm 的 ancestor.context.$options._scopeId 属性值设为空字符串 ''
        nodeOps.setAttribute(vnode.elm, i, '');
      }
      ancestor = ancestor.parent;
    }

    // for slot content they should also get the scopeId from the host instance.
    // ② 检查当期激活实例，也可能将 vnode.elm 的 ancestor.context.$options._scopeId 属性值设为空字符串 ''
    if (isDef(i = activeInstance) && i !== vnode.context && isDef(i = i.$options._scopeId)) {
      nodeOps.setAttribute(vnode.elm, i, '');
    }
  }

  // 在父元素 parentElm 中添加一组子元素 vnodes（索引范围 startIdx-endIdx）
  function addVnodes (parentElm, refElm, vnodes, startIdx, endIdx, insertedVnodeQueue) {
    for (; startIdx <= endIdx; ++startIdx) {
      createElm(vnodes[startIdx], insertedVnodeQueue, parentElm, refElm);
    }
  }

  // 触发所有的 destroy 钩子函数
  function invokeDestroyHook (vnode) {
    var i, j;
    var data = vnode.data;

    /*
        ① 执行 vnode.data.hook.destroy(vnode) 钩子函数
        
        ② 遍历以下数组，依次执行每一个钩子方法
        cbs.destroy : [
            destroy(vnode)
            unbindDirectives(vnode)
        ]
    */
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.destroy)) { 
          // 这里的 i 为 vnode.data.hook.destroy
          i(vnode); 
      }

      for (i = 0; i < cbs.destroy.length; ++i) { 
          cbs.destroy[i](vnode); 
      }
    }

    // 若 vnode.children 存在，遍历每一个子 vnode，递归调用 invokeDestroyHook() 方法
    if (isDef(i = vnode.children)) {
      for (j = 0; j < vnode.children.length; ++j) {
        invokeDestroyHook(vnode.children[j]);
      }
    }
  }

  // 从父元素 parentElm 中删除一组子元素 vnodes（索引范围 startIdx-endIdx）
  function removeVnodes (parentElm, vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      var ch = vnodes[startIdx];
      if (isDef(ch)) {
        // ① 移除元素
        if (isDef(ch.tag)) {
          // 删除模板和触发钩子函数
          removeAndInvokeRemoveHook(ch);
          invokeDestroyHook(ch);
        // ② 移除文本节点
        } else { // Text node
          // 原生删除节点 ch.elm
          removeNode(ch.elm);
        }
      }
    }
  }

  /*
      ① 在 removeVnodes 函数中 removeAndInvokeRemoveHook(ch) 没有参数 rm
      ② 自身递归时，removeAndInvokeRemoveHook(i, rm) 有参数 rm
   */
  function removeAndInvokeRemoveHook (vnode, rm) {
    // 1. rm 或 vnode.data 存在，那就说明说了移除元素，还有钩子函数要执行
    if (isDef(rm) || isDef(vnode.data)) {
      var i;
      var listeners = cbs.remove.length + 1;

      if (isDef(rm)) {
        // we have a recursively passed down rm callback
        // increase the listeners count
        rm.listeners += listeners;
      } else {
        /*
            例如 var rm = createRmCb (childElm, 3)，每次调用 rm 函数第二个参数减 1
            执行 3 次 rm 函数才会移除元素 childElm

            这个 rm 函数会在 cbs.remove、vnode.data.hook.remove 等钩子函数中触发
         */
        rm = createRmCb(vnode.elm, listeners);
      }

      // recursively invoke hooks on child component root node
      // 在子元素根节点上递归调用 removeAndInvokeRemoveHook
      if (isDef(i = vnode.componentInstance) && isDef(i = i._vnode) && isDef(i.data)) {
        /*
            这里 i = vnode.componentInstance._vnode
            并且 i.data 存在，rm 也存在

            在子组件的根节点上递归调用 removeAndInvokeRemoveHook(i, rm)
            这样 rm.listeners 就不断增加
         */ 
        removeAndInvokeRemoveHook(i, rm);
      }

      // 依次执行 cbs.remove 数组中的钩子，会触发 rm 函数
      for (i = 0; i < cbs.remove.length; ++i) {
        cbs.remove[i](vnode, rm);
      }

      // 执行 vnode.data.hook.remove(vnode, rm) 钩子函数，会触发 rm 函数
      if (isDef(i = vnode.data.hook) && isDef(i = i.remove)) {
        // 这里 i 为 vnode.data.hook.remove
        i(vnode, rm);
      } else {
        rm();
      }
    // 2. rm 和 vnode.data 都不存在，那就直接从 dom 中移除元素 vnode.elm
    } else {
      // 原生删除节点 vnode.elm
      removeNode(vnode.elm);
    }
  }

  /*
      实际调用时：
      oldCh = oldVnode.children
      ch = vnode.children
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)
      }
   */
  function updateChildren (parentElm, oldCh, newCh, insertedVnodeQueue, removeOnly) {
    var oldStartIdx = 0;
    var newStartIdx = 0;

    /* 旧的开始节点和结束节点*/
    var oldEndIdx = oldCh.length - 1;
    var oldStartVnode = oldCh[0];
    var oldEndVnode = oldCh[oldEndIdx];

    /* 新的开始节点和结束节点*/
    var newEndIdx = newCh.length - 1;
    var newStartVnode = newCh[0];
    var newEndVnode = newCh[newEndIdx];

    var oldKeyToIdx, idxInOld, elmToMove, refElm;

    // removeOnly is a special flag used only by <transition-group>
    // to ensure removed elements stay in correct relative positions
    // during leaving transitions
    /*
        removeOnly 是一个只在 <transition-group> 中用的特殊标志。
        以确保被删除的元素在离开 transitions 过程中保持正确的相对位置。

        其他情况下，removeOnly 都是假，canMove 是 true，意思就是可以移动
    */
    var canMove = !removeOnly;

    
    /*
        注意几点：
        1. 循环结束条件为：新旧数组有一个已经遍历完
        2. 循环过程中始终关注的是旧的节点（对其更新，移位）
        3. 每个执行过 patchVnode() 的节点就“丢弃”，不再关注
        4. oldStartVnode、oldEndVnode、newStartVnode、newEndVnode 在循环过程中动态更新，它们的值时下一次循环中的参考值
     */
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {

      // 1.【旧的开始节点】不存在，那么取下一个节点作为开始节点
      // 优先级第 1，这样保证了 oldStartVnode 不是 undefined
      if (isUndef(oldStartVnode)) {
        oldStartVnode = oldCh[++oldStartIdx]; // Vnode has been moved left

      // 2.【旧的结束节点】不存在，那么取前一个节点作为结束节点
      // 优先级第 2，这样保证了 oldEndVnode 也不是 undefined
      } else if (isUndef(oldEndVnode)) {
        oldEndVnode = oldCh[--oldEndIdx];

      // 3.【旧的开始节点】和【新的开始节点】是同一个节点
      // 优先级第 3，新旧开始节点一样，那就更新这个节点
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        // 更新后，旧的开始节点 -> 新的开始节点，不用移位置
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
        // 更新新旧开始节点，并更新新旧开始索引
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];

      // 4.【旧的结束节点】和【新的结束节点】是同一个节点
      // 优先级第 4，新旧结束节点一样，那就更新这个节点
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        // 更新后，旧的结束节点 -> 新的结束节点，不用移位置
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
        // 更新新旧结束节点，并更新新旧结束索引
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];

      // 5.【旧的开始节点】和【新的结束节点】是同一个节点
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
        // 更新后，旧的开始节点 -> 新的结束节点，那么这个节点应该移到最右边
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
        
        /*
            将节点 oldStartVnode.elm 插入到 oldEndVnode.elm 的下一个节点之前
            也就是说，将节点 oldStartVnode.elm 插入到节点 oldEndVnode.elm 之后。

            由于只有 insertBefore 方法，没有 insertAfter 方法，这里相当于实现了 insertAfter 方法，所以这里看起来有点绕
        */
        canMove && nodeOps.insertBefore(parentElm, oldStartVnode.elm, nodeOps.nextSibling(oldEndVnode.elm));
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];

      // 6.【旧的结束节点】和【新的开始节点】是同一个节点
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
        // 更新后，旧的结束节点 -> 新的开始节点，那么这个节点应该移到最左边
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);

        // 将节点 oldEndVnode.elm 插入到 oldStartVnode.elm 节点之前
        canMove && nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];

      // 7. 其他，对应关系不明了，需要通过 key 值来确定
      } else {
        /*
            createKeyToOldIdx (children, beginIdx, endIdx)
            将数组 children 中每个 children[i] 的 i 和 children[i].key 对应起来
            返回值 map 结构大致为：
            {
                key0 : idx0,
                key1 : idx1,
                key2 : idx2,
                ...
            }

           【重要】key 值是确定节点对应关系的关键
        */
        if (isUndef(oldKeyToIdx)) { 
            oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx); 
        }

        // 获取新的开始节点在旧的节点数组里对应的索引
        idxInOld = isDef(newStartVnode.key) ? oldKeyToIdx[newStartVnode.key] : null;

        // ① 新的开始节点不存在于旧的节点数组里，也就是说这是全新的元素，那就把这个新的节点插入就的开始节点之前就好了
        if (isUndef(idxInOld)) { // New element
          createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm);
          newStartVnode = newCh[++newStartIdx];
        // ②【新的开始节点】存在于旧的节点数组里，也就是说新的【新的开始节点】的 key 和某个旧的节点的 key 是相等的
        } else {
          // 待移动节点
          elmToMove = oldCh[idxInOld];

          /*
              elmToMove 找不到了，说明之前有 key 值匹配到这个节点，然后下面将 oldCh[idxInOld] 置为 undefined 了
              所以，若新的节点数组 newCh 里有多个节点的 key 值相同，除了第一个来匹配的以外，后面的都匹配不到了
           */ 
          if ("development" !== 'production' && !elmToMove) {
            // v-for 列表的每一个列表项应该有唯一的 key 值。否则在更新的时候会出现。
            warn(
              'It seems there are duplicate keys that is causing an update error. ' +
              'Make sure each v-for item has a unique key.'
            );
          }

          // a. 待移动节点和新的开始节点是同一个节点
          if (sameVnode(elmToMove, newStartVnode)) {
            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);

            // 这个节点已经更新过了，那就置空吧
            oldCh[idxInOld] = undefined;

            // 更新后，旧的节点 -> 新的开始节点，那么这个节点应该移到最左边
            canMove && nodeOps.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
            newStartVnode = newCh[++newStartIdx];
          // b. 即便 key 相等，不同节点，那就还是当做一个新的元素
          } else {
            // 根据 newStartVnode 创建一个新的 dom 节点，插入到 oldStartVnode.elm 之前
            createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm);
            newStartVnode = newCh[++newStartIdx];
          }
        }
      }
    }

    /*
        看一下 while 循环的条件：
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {...}
        于是，循环结束条件为：新旧数组 oldCh/newCh 其中有一个已经遍历完

        1. oldStartIdx > oldEndIdx 说明旧的数组 oldCh 先遍历完
           那么意味着新的数组 newCh 剩余的都是新元素，那就都插入 dom 中
           新的元素应该插入到哪里呢，这就由参考节点 refElm 来决定了
            
           a. 若 newCh[newEndIdx + 1] 不存在，那就说明 newCh[newEndIdx].elm 已经是 parentElm 的最后节点了，那就不需要参考元素，之间在 parentElm 最末尾插入就行了
           b. 若 newCh[newEndIdx + 1] 存在，那就以 newCh[newEndIdx + 1].elm 为参考节点，新元素插在其之前（也就是 newCh[newEndIdx].elm 之后）
            
           总之，新元素紧跟在元素 newCh[newEndIdx].elm 后面插入
     */
    if (oldStartIdx > oldEndIdx) {
      /*
          ① refElm 节点的作用，在 insert (parentElm, elm, refElm) 函数中体现：
             a. 若存在参考元素 ref，将 elm 插入 ref 之前；
             b. 否则，在 parent 末尾插入元素 elm 

          ② 再看看 addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue) 函数的作用：
             在父元素 parentElm 中添加一组子元素 newCh（索引范围 newStartIdx ~ newEndIdx）
          
          所以以上 while 循环是为了修正 newStartIdx 和 newEndIdx 的值
       */
      refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm;
      // 创建 newEndIdx - newStartIdx + 1 个元素
      addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
    /*
        2. newStartIdx > newEndIdx 说明新的数组 newCh 先遍历完
           那么意味着旧的数组 newCh 剩余的都是多余的元素，那就删删删，从 dom 中移除它们
     */
    } else if (newStartIdx > newEndIdx) {
      removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
    }
  }

  /*
      【重要】执行该方法的前提是 sameVnode(oldVnode, vnode) === true
   */
  function patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly) {
    // 1. oldVnode 和 vnode 是同一个 VNode 实例，完全一样，那就没什么好更新的，直接返回
    if (oldVnode === vnode) {
      return
    }

    // 根元素（真实 dom 元素）
    const elm = vnode.elm = oldVnode.elm

    // 2. 如果 oldVnode 是异步组件占位符，那就检查一下可否替换成真正元素，返回
    if (isTrue(oldVnode.isAsyncPlaceholder)) {
      // ① 异步工厂函数成功得到组件构造函数，那就水化，是的占位符变成真正元素
      if (isDef(vnode.asyncFactory.resolved)) {
        hydrate(oldVnode.elm, vnode, insertedVnodeQueue)
      // ② 否则，继续等着吧
      } else {
        vnode.isAsyncPlaceholder = true
      }
      /*
          这里不管走 if 分支执行 hydrate() 函数，还是走 else 分支
          都会执行 vnode.isAsyncPlaceholder = true 
       */
      return
    }

    // reuse element for static trees.
    // note we only do this if the vnode is cloned -
    // if the new node is not cloned it means the render functions have been
    // reset by the hot-reload-api and we need to do a proper re-render.
    
    // 3. vnode 是 oldVnode 的克隆节点，并且是静态的，复用这棵静态树。返回。
    if (isTrue(vnode.isStatic) &&
      isTrue(oldVnode.isStatic) &&
      vnode.key === oldVnode.key &&
      (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
    ) {
      vnode.componentInstance = oldVnode.componentInstance
      return
    }

    // 4. 其他情况，更新这棵树
    let i
    const data = vnode.data
    // ① 执行钩子函数 vnode.data.hook.prepatch(oldVnode,vnode)
    if (isDef(data) && isDef(i = data.hook) && isDef(i = i.prepatch)) {
      /*
          vnode.data.hook.prepatch(oldVnode,vnode) 的作用是更新组件：
          首先，从 oldVnode 中获取对应的组件实例 child
          然后，对实例 child 的 props、listeners、parent vnode、children 等进行更新
       */
      i(oldVnode, vnode)
    }

    const oldCh = oldVnode.children
    const ch = vnode.children

    // ② 依次执行 cb.update 钩子函数，执行 vnode.data.hook.update(oldVnode, vnode) 钩子函数
    if (isDef(data) && isPatchable(vnode)) {
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
      if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
    }

    // ③ 更新子元素
    // ③-1 子元素是元素节点，更新/添加/删除元素
    if (isUndef(vnode.text)) {
      // a. 新树和旧树都有子元素，更新子元素（递归）
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)
      // b. 旧树没有子元素，添加新的子元素
      } else if (isDef(ch)) {
        if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)
      // c. 新树没有子元素，删除旧的子元素
      } else if (isDef(oldCh)) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1)
      // d. 新树旧树都没有子元素
      } else if (isDef(oldVnode.text)) {
        // 若旧树有文本，文本清空
        nodeOps.setTextContent(elm, '')
      }
    // ③-2 子元素是文本，更新文本
    } else if (oldVnode.text !== vnode.text) {
      nodeOps.setTextContent(elm, vnode.text)
    }

    // ④ 执行钩子函数 vnode.data.hooke.postpatch(oldVnode, vnode)
    /*
        一个指令对象可包括以下几个钩子函数，例如：
        dir.def ：{
            bind：只调用一次，指令第一次绑定到元素时调用。在这里可以进行一次性的初始化设置。
            inserted：被绑定元素插入父节点时调用 (仅保证父节点存在，但不一定已被插入文档中)。
            update：所在组件的 VNode 更新时调用，但是可能发生在其子 VNode 更新之前。指令的值可能发生了改变，也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新。
            componentUpdated：指令所在组件的 VNode 及其子 VNode 全部更新后调用。
            unbind：只调用一次，指令与元素解绑时调用。
        }

        执行 vnode.data.hooke.postpatch(oldVnode, vnode)
        -> 即依次执行各个指令的 componentUpdated 钩子函数
     */
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.postpatch)) i(oldVnode, vnode)
    }
  }

  // insert 钩子
  function invokeInsertHook (vnode, queue, initial) {
    // delay insert hooks for component root nodes, invoke them after the element is really inserted
    // ① 初次渲染，不要急着执行每个根节点的 insert 钩子函数，等到它们真正插入文档之后再执行
    if (isTrue(initial) && isDef(vnode.parent)) {
      vnode.parent.data.pendingInsert = queue
    // ② 非初次渲染，可以直接执行 insert 钩子函数了
    } else {
      /*
          ① 参数 queue 就是数组 insertedVnodeQueue，每一个 queue[i] 就是一个组件的根节点
          ② 执行每个 insert 钩子函数（标记每个组件实例的 _isMounted、_directInactive 等状态）
          
          insert 钩子函数可不只是更新 _isMounted、_directInactive 等状态
         
          一个指令对象可包括以下几个钩子函数，例如：
          dir.def ：{
              bind：只调用一次，指令第一次绑定到元素时调用。在这里可以进行一次性的初始化设置。
              inserted：被绑定元素插入父节点时调用 (仅保证父节点存在，但不一定已被插入文档中)。
              update：所在组件的 VNode 更新时调用，但是可能发生在其子 VNode 更新之前。指令的值可能发生了改变，也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新。
              componentUpdated：指令所在组件的 VNode 及其子 VNode 全部更新后调用。
              unbind：只调用一次，指令与元素解绑时调用。
          }
          所以当 vnode.data.hook.insert 钩子执行时，还会依次触发所有指令的 inserted 钩子函数
       */
      for (let i = 0; i < queue.length; ++i) {
        queue[i].data.hook.insert(queue[i])
      }
    }
  }

  var bailed = false;
  // list of modules that can skip create hook during hydration because they
  // are already rendered on the client or has no need for initialization
  // 以下模块可以跳过 create 钩子。因为它们在客户端已经渲染过，或者说它们根本不需要初始化
  var isRenderedModule = makeMap('attrs,style,class,staticClass,staticStyle,key');

  // Note: this is a browser-only function so we can assume elms are DOM nodes.
  // 这个函数只为浏览器定义，elm 可以认为 dom 节点
  /*
    说一下 hydrate 这个概念。其字面意思是“水合物，注水”。

    服务器端渲染时，服务器输出的是字符串，而浏览器端需要根据这些字符串完成初始化工作，
    比如创建组件实例，这样才能响应用户操作。这个过程就叫 hydrate，有时候也会说 re-hydrate

    可以把 hydrate 理解成给干瘪的字符串“注水”。一个完整的网页可以看成是干货掺了水的结果，纯数据只是干巴巴的干货，不是给人看的，
    但是“注水”之后，变成可以展示的 html，就变成浏览器可以解释用户能看的东西了，这过程就是 hydrate。
  */
  function hydrate (elm, vnode, insertedVnodeQueue) {
    /*
        看函数 
        function isAsyncPlaceholder (node) {
          return node.isComment && node.asyncFactory
        }
        可见，vnode.isComment 和 vnode.asyncFactory 需同时满足才能判定为异步组件占位符
     */
    // 1. 异步组件，就此返回 true，也算是“注水”成功
    if (isTrue(vnode.isComment) && isDef(vnode.asyncFactory)) {
      vnode.elm = elm
      vnode.isAsyncPlaceholder = true
      return true
    }

    // 2. elm 和 vnode 类型不匹配，返回 false，“注水”失败
    if (process.env.NODE_ENV !== 'production') {
      if (!assertNodeMatch(elm, vnode)) {
        return false
      }
    }


    // 把 vnode 和 elm 元素绑定起来
    vnode.elm = elm

    const { tag, data, children } = vnode


    // 执行 vnode.data.hook.init(vnode,true) 生成组件实例，并渲染挂载
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.init)) i(vnode, true /* hydrating */)
      
      // 3. 如果组件实例 vnode.componentInstance 存在，在此返回 true，“注水”成功
      if (isDef(i = vnode.componentInstance)) {
        // child component. it should have hydrated its own tree.
        /*
            ① 将 vnode 和 vnode 的所有子树的根 vnode 都会添加到数组 insertedVnodeQueue 中
            ② 依次调用 cbs.create[i] 钩子函数来更新 vnode 的 attr、class、listeners 等等
         */
        initComponent(vnode, insertedVnodeQueue)
        return true
      }
    }

    // ① vnode.tag 存在，目标是元素节点
    if (isDef(tag)) {
      if (isDef(children)) {
        // empty element, allow client to pick up and populate children
        // a. elm 元素没有子元素，那就添加子元素
        if (!elm.hasChildNodes()) {
          createChildren(vnode, children, insertedVnodeQueue)
        // b. elm 有子元素
        } else {
          let childrenMatch = true

          let childNode = elm.firstChild

          // 只要有一个子元素“注水”失败，那就标记 childrenMatch 为 false
          for (let i = 0; i < children.length; i++) {
            if (!childNode || !hydrate(childNode, children[i], insertedVnodeQueue)) {
              childrenMatch = false
              break
            }
            childNode = childNode.nextSibling
          }


          // if childNode is not null, it means the actual childNodes list is
          // longer than the virtual children list.
          /*
              走到这里，childNode 还存在，那说明真实的 childNodes 列表比虚拟的 children 列表长
              也就是说，elm.children 的长度大于 vnode.children 的长度
           */
          // 4. 至少有一个子元素“注水”失败，或者实际子元素的个数大于虚拟节点个数，这里返回，“注水”失败
          if (!childrenMatch || childNode) {
            // 将 bailed 标记为 true（保释？）
            if (process.env.NODE_ENV !== 'production' &&
              typeof console !== 'undefined' &&
              !bailed
            ) {
              bailed = true
              console.warn('Parent: ', elm)
              console.warn('Mismatching childNodes vs. VNodes: ', elm.childNodes, children)
            }
            return false
          }
        }
      }

      if (isDef(data)) {
        for (const key in data) {
          /*
                以下模块在“注水”过程中可以跳过，不执行其 create 钩子函数。因为它们在客户端已经渲染，或者根本没有初始化的必要。
                isRenderedModule = makeMap('attrs,style,class,staticClass,staticStyle,key')
           
                也就是说，只要有一个 key 不是 'attrs,style,class,staticClass,staticStyle,key'
                那就执行 invokeCreateHooks(vnode, insertedVnodeQueue)
           */
          if (!isRenderedModule(key)) {
            /*
                ① 依次调用 cbs.create[i] 钩子函数来更新 attr、class、listeners 等等
                ② 执行 vnode.data.hook.create(emptyNode, vnode)
                ③ 将 vnode 加入队列到 insertedVnodeQueue 中
             */
            invokeCreateHooks(vnode, insertedVnodeQueue)
            break
          }
        }
      }
    // ② 否则，目标是文本节点
    } else if (elm.data !== vnode.text) {
      elm.data = vnode.text
    }

    // 5. 走到这里了，“注水”成功
    return true
  }


  // node 和 vnode 类型是否匹配，只有匹配上了，才可能用 vnode 对元素 node 进行“注水“
  function assertNodeMatch (node, vnode) {
    if (isDef(vnode.tag)) {
      /*
          createComponent 函数创建的一般组件的 tag 为：
          "vue-component-" + (Ctor.cid) + (name ? ("-" + name) : '')

          ① vnode.tag 是以 'vue-component' 开头
          ② vnode.tag 和 node.tagName 是同一个标签名
       */
      return (
        vnode.tag.indexOf('vue-component') === 0 ||
        vnode.tag.toLowerCase() === (node.tagName && node.tagName.toLowerCase())
      )
    } else {
      /*
          ① node.nodeType === 3 为 Text 类型，代表元素或属性中的文本内容
          ② node.nodeType === 8 为 Comment 类型，代表注释
       */
      return node.nodeType === (vnode.isComment ? 8 : 3)
    }
  }

  // createPatchFunction 函数最终返回的就是这个打补丁函数
  /*
      其中：
      ① oldVnode 可能是 VNode 实例，也可能是 dom 元素
      ② 新的 VNode 实例
      ③ hydrating 为 true 才执行 hydrate(oldVnode, vnode, insertedVnodeQueue) 函数“注水”，这里的 oldVnode 就是 dom 元素
      ④ removeOnly 该参数只用于 <transition-group> 中，用来确保被移除的元素在 leaving transitions 中保持相对正确的位置
      ⑤ parentElm 为 dom 元素，它将作为虚拟 vnode 生成的 dom 元素的父元素
      ⑥ refElm 作为 vnode 生成的 dom 元素插入父元素 parentElm 时的参考节点（插入 refElm 元素之前）
   */
  return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {
    // 1. 如果 vnode 不存在，直接在这里返回（如果 oldVnode 存在，那就销毁 oldVnode 吧）
    if (isUndef(vnode)) {
      // 触发所有的 destroy 钩子函数
      if (isDef(oldVnode)) { invokeDestroyHook(oldVnode); }
      return
    }

    var isInitialPatch = false;
    var insertedVnodeQueue = [];

    // 2. oldVnode 不存在，说明新的节点，那就创建新的节点（初始化）
    if (isUndef(oldVnode)) {
      // empty mount (likely as component), create new root element
      isInitialPatch = true;
      // 根据 vnode 新的生成 dom 元素
      createElm(vnode, insertedVnodeQueue, parentElm, refElm);
    // 3. vnode、oldVnode 都存在，那就打补丁吧（更新）
    } else {
      /*
          如果 oldVnode.nodeType 存在，那就说明它是真实 dom 节点
          也就是说这里的参数 oldVnode 是真实的 dom 元素，而不是 VNode 实例
       */
      var isRealElement = isDef(oldVnode.nodeType);
                                
     
      /*
          sameVnode(oldVnode, vnode)
          判断 oldVnode 和 vnode 是否可以视作“同一棵树”，从而进行一对一的更新

          注意一下 sameVnode(oldVnode, vnode) 和 patchVnode() 方法
          它们俩一直是成对出现，由此可以看出：
          patchVnode() 方法执行的前提是 sameVnode(oldVnode, vnode) 为 true
       */
       // ① 如果不是真实节点，并且 sameVnode(oldVnode, vnode) 为 true
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // patch existing root node，打补丁，进行 update 操作
        patchVnode(oldVnode, vnode, insertedVnodeQueue, removeOnly);
      // ② 其他
      } else {
        // ②-1【重要】oldVnode 是真实的 dom 元素，"注水"后返回
        if (isRealElement) {
          // mounting to a real element
          // check if this is server-rendered content and if we can perform
          // a successful hydration.
          /*
            SSR_ATTR = 'data-server-rendered'，ssr 应该是 server side render 的简称
            这里强制将 hydrating 置为 true
          */
          if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
            oldVnode.removeAttribute(SSR_ATTR);
            hydrating = true;
          }

          // 需要“注水”
          if (isTrue(hydrating)) {
            // a. “注水”成功
            if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
              // 第三个参数 isInitialPatch 为 true 表示初次渲染，不要急着执行每个根节点的 insert 钩子函数，等到它们真正插入文档之后再执行
              invokeInsertHook(vnode, insertedVnodeQueue, true);
              return oldVnode
            // b. “注水”失败，发出警告
            } else {
              /*
                客户端渲染的虚拟 dom 树和服务端渲染的不匹配。这很有可能是不正确的 html 标记引起的。
                比如：在 p 标签里有块级元素，少写了 tbody 标签等。
              */
              warn(
                'The client-side rendered virtual DOM tree is not matching ' +
                'server-rendered content. This is likely caused by incorrect ' +
                'HTML markup, for example nesting block-level elements inside ' +
                '<p>, or missing <tbody>. Bailing hydration and performing ' +
                'full client-side render.'
              );
            }
          }
          // either not server-rendered, or hydration failed.
          // create an empty node and replace it

          // 不在服务端渲染或“注水”失败，那就以 elm 元素创建一个空的 vnode 实例
          oldVnode = emptyNodeAt(oldVnode);
        }

        // replacing existing element
        var oldElm = oldVnode.elm;
        var parentElm$1 = nodeOps.parentNode(oldElm);

        // ②-2 重新生成 dom 元素，替换原来的元素 oldVnode.elm
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          /*
              ① oldElm._leaveCb 为 true，表示动画离开
                 那么父元素为 null，不会插入到文档中（insert 函数中规定插入的条件是父元素必须存在）
              ② 否则，父元素还是原来的 nodeOps.parentNode(oldElm)
           */
          oldElm._leaveCb ? null : parentElm$1,
          // 参考节点就是其后的兄弟节点，也就是说新生成的节点会插入到参考节点之前
          nodeOps.nextSibling(oldElm)
        );

        // vnode.parent 应该是父占位符
        if (isDef(vnode.parent)) {
          // component root element replaced.
          // update parent placeholder node element, recursively
          var ancestor = vnode.parent;
          // 每个祖先占位节点 ancestor.elm 属性都指向 vnode.elm
          while (ancestor) {
            ancestor.elm = vnode.elm;
            ancestor = ancestor.parent;
          }
          // 可修补
          if (isPatchable(vnode)) {
            /*
                cbs.create : [
                    updateAttrs(oldVnode, vnode)
                    updateClass(oldVnode, vnode)
                    updateDOMListeners(oldVnode, vnode)
                    updateDOMProps(oldVnode, vnode)
                    updateStyle(oldVnode, vnode)
                    _enter(_, vnode)
                    create(_, vnode)
                    updateDirectives(oldVnode, vnode)
                ]
            */
            for (var i = 0; i < cbs.create.length; ++i) {
              cbs.create[i](emptyNode, vnode.parent);
            }
          }
        }
        
        // 父元素存在
        if (isDef(parentElm$1)) {
    		  /*
        			例如，dom 结构为：
        			<body>
        				<div id="app">
        					{{message}}
        				</div>
        				<div id="app">
        					Hello Vue!
        				</div>
        			</body>
        			所以，我们需要移除模板：
        			<div id="app">
        				{{message}}
        			</div>
              这样只是一个形象表述，事实不是这样的
    		  */
          // 移除旧的元素
          removeVnodes(parentElm$1, [oldVnode], 0, 0);
        // 父元素不存在，那就调用销毁钩子
        } else if (isDef(oldVnode.tag)) {
          invokeDestroyHook(oldVnode);
        }
      }
    }
    
    /*
        ① isInitialPatch 为 true 表示初次渲染，不要急着执行每个根节点的 insert 钩子函数，等到它们真正插入文档之后再执行
        ② isInitialPatch 为 false 表示非初次渲染，可以直接执行 insert 钩子函数了
     */
    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch);
    // 最终返回生成的新的 dom 元素 
    return vnode.elm
  }
}

/*  */

// 指令生命周期：create -> update -> destroy
var directives = {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives (vnode) {
    updateDirectives(vnode, emptyNode);
  }
};

// 更新指令
function updateDirectives (oldVnode, vnode) {
  // 旧的 vnode 或新的 vnode 有指令就进行更新。也就是说，如果都没指令就不更新了
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode);
  }
}

// 更新指令
function _update (oldVnode, vnode) {
  // ① oldVnode 是 emptyNode，说明是 create 操作
  var isCreate = oldVnode === emptyNode;
  // ② vnode 是 emptyNode，说明是 destroy 操作
  var isDestroy = vnode === emptyNode;

  // 一个 json 对象，即所有指令的集合
  var oldDirs = normalizeDirectives$1(oldVnode.data.directives, oldVnode.context);
  var newDirs = normalizeDirectives$1(vnode.data.directives, vnode.context);

  // 包含有 inserted 钩子的所有指令
  var dirsWithInsert = [];
  // 包含有 componentUpdated 钩子的所有指令
  var dirsWithPostpatch = [];

  /*
      一个指令对象可包括以下几个钩子函数，例如：
      dir.def ：{
          bind：只调用一次，指令第一次绑定到元素时调用。在这里可以进行一次性的初始化设置。
          inserted：被绑定元素插入父节点时调用 (仅保证父节点存在，但不一定已被插入文档中)。
          update：所在组件的 VNode 更新时调用，但是可能发生在其子 VNode 更新之前。指令的值可能发生了改变，也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新。
          componentUpdated：指令所在组件的 VNode 及其子 VNode 全部更新后调用。
          unbind：只调用一次，指令与元素解绑时调用。
      }
  */
  var key, oldDir, dir;
  // 遍历 vnode 的所有指令
  for (key in newDirs) {
    // 新/旧指令
    oldDir = oldDirs[key];
    dir = newDirs[key];

    // ① 没有对应的旧指令
    if (!oldDir) {
      // new directive, bind
      // 执行 dir.def['bind'] 钩子方法，第一次绑定，所以执行指令定义函数的 bind 钩子函数
      callHook$1(dir, 'bind', vnode, oldVnode);
      // 如果还定义了 inserted 钩子函数，那就把当前 dir 加入队列，后面在元素插入父节点时会用到的
      if (dir.def && dir.def.inserted) {
        dirsWithInsert.push(dir);
      }
    // ② 有对应的旧指令
    } else {
      // existing directive, update
      dir.oldValue = oldDir.value;
      // 执行 dir.def['update'] 钩子方法
      callHook$1(dir, 'update', vnode, oldVnode);
      // 如果还定义了 componentUpdated 钩子函数，那就把当前 dir 加入队列，后面在 vnode 及其孩子的 vnode 全部更新时调用时会用到的
      if (dir.def && dir.def.componentUpdated) {
        dirsWithPostpatch.push(dir);
      }
    }
  }

  // 遍历所有 inserted 钩子函数的指令
  if (dirsWithInsert.length) {
    var callInsert = function () {
      for (var i = 0; i < dirsWithInsert.length; i++) {
        // 执行 dirsWithInsert[i].def.inserted 方法，即依次执行各个指令的 inserted 钩子函数
        callHook$1(dirsWithInsert[i], 'inserted', vnode, oldVnode);
      }
    };
    // ① 节点是新创的，将指令 inserted 钩子合并到组件的 insert 钩子中
    if (isCreate) {
      /*
          mergeVNodeHook (def, hookKey, hook) 的作用：
          将钩子方法 hook 加入到 def[hookKey] 中，也就是添加一个钩子方法，以后执行 def[hookKey] 也就会执行 hook 方法了
       
          下面这句的作用是将 callInsert 函数合并到整个组件的的 insert 钩子函数中
          从这里也可以看到指令的 inserted 钩子函数是在组件 insert 时触发（插入到父元素时触发）
       */
      mergeVNodeHook(vnode.data.hook || (vnode.data.hook = {}), 'insert', callInsert);
    // ② 节点已存在，说明已经合并过了，那就直接执行 inserted 钩子就好
    } else {
      callInsert();
    }
  }

  // 遍历所有 componentUpdated 钩子函数的指令
  if (dirsWithPostpatch.length) {
    // 将匿名函数添加到 vnode.data.hook['postpatch'] 中，那么以后执行 vnode.data.hook['postpatch'] 这个函数时，就会执行这个匿名函数了
    mergeVNodeHook(vnode.data.hook || (vnode.data.hook = {}), 'postpatch', function () {
      for (var i = 0; i < dirsWithPostpatch.length; i++) {
        // 执行 dirsWithPostpatch[i].def.componentUpdated 方法，即依次执行各个指令的 componentUpdated 钩子函数
        callHook$1(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode);
      }
    });
  }

  // 不是新创建的 vnode 才执行
  if (!isCreate) {
    // 对于不要的指令进行解绑，会调用 unbind 钩子
    for (key in oldDirs) {
      if (!newDirs[key]) {
        // 不需要的旧指令解绑，调用 unbind 钩子函数
        callHook$1(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy);
      }
    }
  }
}

var emptyModifiers = Object.create(null);

/*
      看看 VNodeDirective 类型的定义：
       declare type VNodeDirective = {
        name: string;
        rawName: string;
        value?: any;
        oldValue?: any;
        arg?: string;
        modifiers?: ASTModifiers;
        def?: Object;
      };

      参数 dirs 的结构如下：
      [
        {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        ...
      ]

      返回值为对 dirs 修正后的对象 res，结构为：
      {
        dirName1 : {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        dirName2 : {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        ...
      }
*/
// 返回一个 json 对象，即所有指令的集合
function normalizeDirectives$1 (dirs, vm) {
  var res = Object.create(null);
  // ① 若 dirs 不存在，直接返回空对象
  if (!dirs) {
    return res
  }
  var i, dir;
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i];
    if (!dir.modifiers) {
      // emptyModifiers = Object.create(null)，即空对象
      dir.modifiers = emptyModifiers;
    }
    res[getRawDirName(dir)] = dir;
    /*
      一个指令对象可包括以下几个钩子函数，例如：
      dir.def ：{
          bind：只调用一次，指令第一次绑定到元素时调用。在这里可以进行一次性的初始化设置。
          inserted：被绑定元素插入父节点时调用 (仅保证父节点存在，但不一定已被插入文档中)。
          update：所在组件的 VNode 更新时调用，但是可能发生在其子 VNode 更新之前。指令的值可能发生了改变，也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新。
          componentUpdated：指令所在组件的 VNode 及其子 VNode 全部更新后调用。
          unbind：只调用一次，指令与元素解绑时调用。
      }
     */
    dir.def = resolveAsset(vm.$options, 'directives', dir.name, true);
  }
  /*
      res 结构如下：
      {
        dirName1 : {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        dirName2 : {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        ...
      }
   */
  // ② 对每个 dir 的属性进行修正，然后存进 res 对象
  return res
}

// 获取原指令名
function getRawDirName (dir) {
  /*
    ① dir.rawName 存在，那就直接返回 dir.rawName
    ② 否则，返回 dir.name 和 dir.modifiers 对象的键值用 '.' 拼起来的字符串
       
    例如：<div id="hook-arguments-example" v-demo:foo.a.b="message"></div>
    返回值为 rawName = "v-demo:foo.a.b"
  */
  // return dir.rawName || ((dir.name) + "." + (Object.keys(dir.modifiers || {}).join('.')))
  return dir.rawName || ((dir.name) + "." + (Object.keys(dir.modifiers || {}).join('.')))
}

/*
  执行钩子函数
  例如：dir.def = { bind: definition, update: definition }
 */
function callHook$1 (dir, hook, vnode, oldVnode, isDestroy) {
  var fn = dir.def && dir.def[hook];
  if (fn) {
    /*
      钩子函数参数分别如下：
      vnode.elm：指令所绑定的元素，可以用来直接操作 DOM 。
      dir：一个对象，包含以下属性：
          name：指令名，不包括 v- 前缀。
          value：指令的绑定值，例如：v-my-directive="1 + 1" 中，绑定值为 2。
          oldValue：指令绑定的前一个值，仅在 update 和 componentUpdated 钩子中可用。无论值是否改变都可用。
          expression：字符串形式的指令表达式。例如 v-my-directive="1 + 1" 中，表达式为 "1 + 1"。
          arg：传给指令的参数，可选。例如 v-my-directive:foo 中，参数为 "foo"。
          modifiers：一个包含修饰符的对象。例如：v-my-directive.foo.bar 中，修饰符对象为 { foo: true, bar: true }。
      vnode：Vue 编译生成的虚拟节点。
      oldVnode：上一个虚拟节点，仅在 update 和 componentUpdated 钩子中可用。
     */
    try {
      // 这个方法主要就是这一句，即执行 dir.def[hook] 方法
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy);
    } catch (e) {
      handleError(e, vnode.context, ("directive " + (dir.name) + " " + hook + " hook"));
    }
  }
}


/*
var ref = {
  // 添加引用 ref
  create: function create (_, vnode) {...},
  // 更新引用 ref
  update: function update (oldVnode, vnode) {...},
  // 删除引用 ref
  destroy: function destroy (vnode) {...}
};

var directives = {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives (vnode) {
    updateDirectives(vnode, emptyNode);
  }
};
*/
// 基本模块
var baseModules = [
  ref,
  directives
];

// 更新属性
function updateAttrs (oldVnode, vnode) {
  var opts = vnode.componentOptions;
  // 构造函数选项的 inheritAttrs 设为 false，那就直接返回吧
  if (isDef(opts) && opts.Ctor.options.inheritAttrs === false) {
    return
  }
  // 新旧属性都没定义，也直接返回
  if (isUndef(oldVnode.data.attrs) && isUndef(vnode.data.attrs)) {
    return
  }

  var key, cur, old;
  // dom 节点
  var elm = vnode.elm;
  var oldAttrs = oldVnode.data.attrs || {};
  var attrs = vnode.data.attrs || {};


  // clone observed objects, as the user probably wants to mutate it
  if (isDef(attrs.__ob__)) {
    attrs = vnode.data.attrs = extend({}, attrs);
  }

  // 遍历 attrs，和 oldAttrs 不一样的就设置
  for (key in attrs) {
    cur = attrs[key];
    old = oldAttrs[key];
    // 新旧属性值不一样，设置属性
    if (old !== cur) {
      setAttr(elm, key, cur);
    }
  }
  // #4391: in IE9, setting type can reset value for input[type=radio]
  /* istanbul ignore if */
  // ie9 下有个问题，设置 input 的 type 为 radio 时，会重置它的 value 属性值。所以在 ie9 下，新旧 value 值不一样，那就以新的值为准
  if (isIE9 && attrs.value !== oldAttrs.value) {
    // 例如：<input type="checkbox" name="vehicle" value="Car" checked="checked" /> 别忘了 value 也是一个属性
    setAttr(elm, 'value', attrs.value);
  }

  // 遍历 oldAttrs，删除不要的属性
  for (key in oldAttrs) {
    if (isUndef(attrs[key])) {
      if (isXlink(key)) {
        elm.removeAttributeNS(xlinkNS, getXlinkProp(key));
      } else if (!isEnumeratedAttr(key)) {
        elm.removeAttribute(key);
      }
    }
  }

}

// 调用原生方法为对象设置属性
function setAttr (el, key, value) {
  // key 为 checked、enabled 等需要布尔值的属性
  if (isBooleanAttr(key)) {
    // set attribute for blank value
    // e.g. <option disabled>Select one</option>
    // value 为 null、undefined 或 false，删除这个属性
    if (isFalsyAttrValue(value)) {
      el.removeAttribute(key);
    } else {
      // 例如：<input type="checkbox" name="vehicle" value="Car" checked="checked" />
      el.setAttribute(key, key);
    }
  // key 为 contenteditable,draggable,spellcheck 三者之一
  } else if (isEnumeratedAttr(key)) {
    el.setAttribute(key, isFalsyAttrValue(value) || value === 'false' ? 'false' : 'true');
  // key 以 'xlink:' 开头
  } else if (isXlink(key)) {
    if (isFalsyAttrValue(value)) {
      el.removeAttributeNS(xlinkNS, getXlinkProp(key));
    } else {
      el.setAttributeNS(xlinkNS, key, value);
    }
  } else {
    // value 为 null、undefined 或 false
    if (isFalsyAttrValue(value)) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, value);
    }
  }
}

// 属性的生命周期：create -> update
var attrs = {
  create: updateAttrs,
  update: updateAttrs
};

// 更新 class
function updateClass (oldVnode, vnode) {
  // 真实 dom 节点
  var el = vnode.elm;
  var data = vnode.data;
  var oldData = oldVnode.data;

  // 如果新旧数据都没有 staticClass 和 class，那就在此返回
  if (
    isUndef(data.staticClass) &&
    isUndef(data.class) && (
      isUndef(oldData) || (
        isUndef(oldData.staticClass) &&
        isUndef(oldData.class)
      )
    )
  ) {
    return
  }

  // 生成字符串形式的 class 属性值，各个 class 之间用空格分开
  var cls = genClassForVnode(vnode);

  // handle transition classes
  var transitionClass = el._transitionClasses;
  if (isDef(transitionClass)) {
    // 过渡的 class 也加上
    cls = concat(cls, stringifyClass(transitionClass));
  }

  // set the class
  // 新旧 class 不一样，那就更新
  if (cls !== el._prevClass) {
    el.setAttribute('class', cls);
    el._prevClass = cls;
  }
}

var klass = {
  create: updateClass,
  update: updateClass
};

// 匹配 ).+-_$] word 之一
var validDivisionCharRE = /[\w).+\-_$\]]/;


/*
解析过滤器，例如：
parseFilters("message | filterA('arg1', arg2)")
-> "_f("filterA")(message,'arg1', arg2)"

parseFilters("message | filterA | filterB")
-> "_f("filterB")(_f("filterA")(message))"
 */
function parseFilters (exp) {
  var inSingle = false;
  var inDouble = false;
  var inTemplateString = false;
  var inRegex = false;
  // 花括号
  var curly = 0;
  // 方括号
  var square = 0;
  // 括号
  var paren = 0;
  var lastFilterIndex = 0;
  var c, prev, i, expression, filters;

  for (i = 0; i < exp.length; i++) {
    // 上一个字符
    prev = c;
    /*
    charCodeAt() 方法可返回指定位置的字符的 Unicode 编码。这个返回值是 0 - 65535 之间的整数。
    charCodeAt() 与 charAt() 方法执行的操作相似，只不过前者返回的是位于指定位置的字符的编码，而后者返回的是字符子串。
     */
    c = exp.charCodeAt(i);

    // 如果已经有一个 ' 就会走这个分支，来闭合 ''
    if (inSingle) {
      // 0x27 -> '  0x5C -> \
      if (c === 0x27 && prev !== 0x5C) { inSingle = false; }
    // 如果已经有一个 " 就会走这个分支，来闭合 ""
    } else if (inDouble) {
      // 0x22 -> "
      if (c === 0x22 && prev !== 0x5C) { inDouble = false; }
    // 如果已经有一个 ` 就会走这个分支，来闭合 ``
    } else if (inTemplateString) {
      // 0x60 -> `
      if (c === 0x60 && prev !== 0x5C) { inTemplateString = false; }
    // 如果已经有一个 / 就会走这个分支，来闭合 //
    } else if (inRegex) {
      // 0x2f -> /
      if (c === 0x2f && prev !== 0x5C) { inRegex = false; }
    } else if (
      // 0x7C -> |
      c === 0x7C && // pipe
      exp.charCodeAt(i + 1) !== 0x7C &&
      exp.charCodeAt(i - 1) !== 0x7C &&
      // curly、square、paren 必须同时为 0，表示花括号、方括号、括号都是闭合的
      !curly && !square && !paren
    ) {
      /*
          第一个管道符 | 之前的是"待处理的参数"，之后的才是 filter

          以 parseFilters("message | filterA | filterB") 为例：
          即，message 是"待处理的参数"，filterA 和 filterB 才是 filter
       */
      if (expression === undefined) {
        // first filter, end of expression
        lastFilterIndex = i + 1;
        expression = exp.slice(0, i).trim();
      } else {
        pushFilter();
      }
    } else {
      switch (c) {
        case 0x22: inDouble = true; break         // "
        case 0x27: inSingle = true; break         // '
        case 0x60: inTemplateString = true; break // `
        // 括号
        case 0x28: paren++; break                 // (
        case 0x29: paren--; break                 // )
        // 方括号
        case 0x5B: square++; break                // [
        case 0x5D: square--; break                // ]
        // 花括号
        case 0x7B: curly++; break                 // {
        case 0x7D: curly--; break                 // }
      }
      if (c === 0x2f) { // /
        var j = i - 1;
        var p = (void 0);
        // find first non-whitespace prev char
        // 找出之前第一个非空白字符
        for (; j >= 0; j--) {
          p = exp.charAt(j);
          if (p !== ' ') { break }
        }
        if (!p || !validDivisionCharRE.test(p)) {
          inRegex = true;
        }
      }
    }
  }

  
  if (expression === undefined) {
    expression = exp.slice(0, i).trim();
  } else if (lastFilterIndex !== 0) {
    pushFilter();
  }

  // 把 filter 加入到数组 filters 中
  function pushFilter () {
    // 从 exp 中取出 filter，并加入到数组 filters
    (filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim());
    // filter 直接用 | 隔开，所以下一个 filter 起始字符为 i + 1，而不是 i
    lastFilterIndex = i + 1;
  }

  /*
  执行到这里，看着变量 filters 和 expression 分别是什么：
  ① parseFilters("message | filterA('arg1', arg2)")

     filters -> ["filterA('arg1', arg2)"]
     expression -> message

  ② parseFilters("message | filterA | filterB")

     filters -> ["filterA", "filterB"]
     expression -> message
   */


  if (filters) {
    for (i = 0; i < filters.length; i++) {
      /*
        对于 parseFilters("message | filterA | filterB")
        i = 0, expression -> message
        i = 1, expression -> _f("filterA")(message)
        i = 2, expression -> _f("filterB")(_f("filterA")(message))
       */
      expression = wrapFilter(expression, filters[i]);
    }
  }

  return expression
}

// 返回 exp 和 filter 构成的字符串形式函数调用
function wrapFilter (exp, filter) {
  var i = filter.indexOf('(');
  // 不带括号，也就是不带参数，如 wrapFilter('message','filterA') -> "_f("filterA")(message)"
  if (i < 0) {
    // _f: resolveFilter
    return ("_f(\"" + filter + "\")(" + exp + ")")
  // 带括号，也就是带参数
  } else {
    /*
      例如： filter 为 "filterA('arg1', arg2)"
            name 为 "filterA"，
            args 为 "'arg1', arg2)"

     于是，wrapFilter('message',"filterA('arg1', arg2)") -> "_f("filterA")(message,'arg1', arg2)"
     */
    var name = filter.slice(0, i);
    var args = filter.slice(i + 1);
    return ("_f(\"" + name + "\")(" + exp + "," + args)
  }
}

// 基本的警告函数
function baseWarn (msg) {
  console.error(("[Vue compiler]: " + msg));
}

// 返回一个 module[key] 组成的数组，即 [ module1.key,  module2.key,  module2.key, ...]
function pluckModuleFunction (modules,key) {
  return modules
    ? modules.map(function (m) { return m[key]; }).filter(function (_) { 
        // 既然返回参数自身，那么还要这个函数干嘛
        return _; 
      })
    : []
}

// 添加 prop
function addProp (el, name, value) {
  (el.props || (el.props = [])).push({ name: name, value: value });
}

// 添加 attr
function addAttr (el, name, value) {
  (el.attrs || (el.attrs = [])).push({ name: name, value: value });
}

// 添加指令
/*
    例如：<input type="text" v-show="isShow" value="" v-model="someText"/>
    el.directives : [
         {
             name: "show",
             rawName: "v-show",
             value: "isShow",
             arg: null,
             modifiers: undefined
         },
         {
             name: "model",
             rawName: "v-model",
             value: "someText",
             arg: null,
             modifiers: undefined
         }
    ]
 */
function addDirective (el, name, rawName, value, arg, modifiers) {
  (el.directives || (el.directives = [])).push({ 
    name: name, 
    rawName: rawName, 
    value: value, 
    arg: arg, 
    modifiers: modifiers 
  });
}

// 其实就是 el.events[name] = el.events[name].push({ value: value, modifiers: modifiers })
function addHandler (el, name, value, modifiers, important, warn) {
  // warn prevent and passive modifier
  /* istanbul ignore if */
  if ("development" !== 'production' && warn && modifiers && modifiers.prevent && modifiers.passive) {
    // passive 和 prevent 不能一起用。passive 处理函数不能阻止默认事件。
    warn(
      'passive and prevent can\'t be used together. ' +
      'Passive handler can\'t prevent default event.'
    );
  }

  /*
    dom 新的规范规定，addEventListener() 的第三个参数可以是个对象值了，该对象可用的属性有三个：
    addEventListener(type, listener, {
        capture: false,   // 等价于以前的 useCapture 参数
        passive: false,   // true 表明该监听器是一次性的
        once: false       // true 表明不会调用 preventDefault 函数来阻止默认滑动行为
    })

    当属性 passive 的值为 true 的时候，代表该监听器内部不会调用 preventDefault 函数来阻止默认滑动行为，
    Chrome 浏览器称这类型的监听器为顺从(passive)监听器。目前 Chrome 主要利用该特性来优化页面的滑动性能，
    所以 Passive Event Listeners 特性当前仅支持 mousewheel/touch 相关事件。
  */

  // 第①步: 修正 name 和 modifiers
  // check capture modifier
  if (modifiers && modifiers.capture) {
    delete modifiers.capture;
    // mark the event as captured 该事件为事件捕获模式
    name = '!' + name; 
  }
  if (modifiers && modifiers.once) {
    delete modifiers.once;
    // mark the event as once 该事件只会触发一次
    name = '~' + name; 
  }
  /* istanbul ignore if */
  if (modifiers && modifiers.passive) {
    delete modifiers.passive;
    // mark the event as passive 该事件是顺从的
    name = '&' + name; 
  }

  // 第②步: 获取 events
  var events;
  if (modifiers && modifiers.native) {
    delete modifiers.native;
    events = el.nativeEvents || (el.nativeEvents = {});
  } else {
    events = el.events || (el.events = {});
  }

  var newHandler = { value: value, modifiers: modifiers };
  var handlers = events[name];
  
  // 第③步: 往 events 中添加 { value: value, modifiers: modifiers }
  // handlers 是数组。如果 important 为 true 那就把 newHandler 加到数组 handlers 前边，否则加到数组 handlers 后边
  if (Array.isArray(handlers)) {
    important ? handlers.unshift(newHandler) : handlers.push(newHandler);
  // handlers 存在，但不是数组，那就强制把 events[name] 改成数组。newHandler 和 handlers 的顺序由 important 决定
  } else if (handlers) {
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler];
  // handlers 不存在
  } else {
    events[name] = newHandler;
  }
}

// 首先获取动态值，获取失败再获取静态值（第三个参数设为 false 表示取不到动态属性就也不取静态的（默认情况下会取静态的））
function getBindingAttr (el, name, getStatic) {
  /*
    ① 获取 el 元素的 :name 属性，并删除该属性
    ② 若 ① 中获取的属性为假，就获取 v-bind:name 属性，然后删除该属性
  */
  var dynamicValue = getAndRemoveAttr(el, ':' + name) || getAndRemoveAttr(el, 'v-bind:' + name);

  if (dynamicValue != null) {
    // 例如：parseFilters("message | filterA | filterB") -> "_f("filterB")(_f("filterA")(message))"
    return parseFilters(dynamicValue)
  // 动态值获取失败，再获取静态值
  } else if (getStatic !== false) {
    var staticValue = getAndRemoveAttr(el, name);
    if (staticValue != null) {
      return JSON.stringify(staticValue)
    }
  }
}

// 删除一个 attr，并返回对应的值
function getAndRemoveAttr (el, name) {
  var val;
  /*
    ① el.attrsMap 是一个 json 对象，结构大概是：
    {
        name1 : value1,
        name2 : value2,
        name3 : value3,
        ...
    }

    ② el.attrsList 是一个数组，结构大概是：
    [
        {
            name : name1,
            value : value1
        },
        {
            name : name2,
            value : value2
        }
        ...
    ]
  */
  if ((val = el.attrsMap[name]) != null) {
    var list = el.attrsList;
    for (var i = 0, l = list.length; i < l; i++) {
        // 从 list 删除一项
      if (list[i].name === name) {
        list.splice(i, 1);
        break
      }
    }
  }
  // 最终返回值
  return val
}

/*  */

/**
 * Cross-platform code generation for component v-model
 */
 // 对于组件，给 el.model 对象赋值
function genComponentModel ( el, value, modifiers) {
  var ref = modifiers || {};
  var number = ref.number;
  var trim = ref.trim;

  var baseValueExpression = '$$v';
  var valueExpression = baseValueExpression;
  // 去掉左右两端空格
  if (trim) {
    valueExpression =
      "(typeof " + baseValueExpression + " === 'string'" +
        "? " + baseValueExpression + ".trim()" +
        ": " + baseValueExpression + ")";
  }
  // 转为数值
  if (number) {
    valueExpression = "_n(" + valueExpression + ")";
  }
  // 字符串形式的执行语句
  var assignment = genAssignmentCode(value, valueExpression);

  // 最终生成这个对象
  el.model = {
    value: ("(" + value + ")"),
    expression: ("\"" + value + "\""),
    callback: ("function (" + baseValueExpression + ") {" + assignment + "}")
  };
}

/**
 * Cross-platform codegen helper for generating v-model value assignment code.
 */
// 返回一个字符串形式的执行语句，其实就是一个 set 操作
function genAssignmentCode (value, assignment) {
  /*
    parseModel(value) 返回一个 json 对象
    {
      exp: expValue,
      idx: idxValue
    }
  */
  var modelRs = parseModel(value);
  if (modelRs.idx === null) {
    return (value + "=" + assignment)
  } else {
    return ("$set(" + (modelRs.exp) + ", " + (modelRs.idx) + ", " + assignment + ")")
  }
}

/**
 * parse directive model to do the array update transform. a[idx] = val => $$a.splice($$idx, 1, val)
 *
 * for loop possible cases:
 *
 * - test
 * - test[idx]
 * - test[test1[idx]]
 * - test["a"][idx]
 * - xxx.test[a[a].test1[idx]]
 * - test.xxx.a["asa"][test1[idx]]
 *
 */

var len;
var str;
var chr;
var index$1;
var expressionPos;
var expressionEndPos;

// 返回一个 json 对象
function parseModel (val) {
  str = val;
  len = str.length;
  index$1 = expressionPos = expressionEndPos = 0;
 
  /*
    lastIndexOf() 方法可返回一个指定的字符串值最后出现的位置

    没有方括号，或方括号完整关闭，直接返回一个 json
  */
  if (val.indexOf('[') < 0 || val.lastIndexOf(']') < len - 1) {
    return {
      exp: val,
      idx: null
    }
  }

  while (!eof()) {
    chr = next();
    // 遇到左引号，就向后走，直至关闭该引号
    if (isStringStart(chr)) {
      parseString(chr);
    // '\x5B' -> "["，遇到左括号，就向后走，直至关闭该括号
    } else if (chr === 0x5B) {
      parseBracket(chr);
    }
  }

  // expressionPos 是方括号开始的位置，expressionEndPos 是方括号结束的位置
  return {
    // [] 之前的内容
    exp: val.substring(0, expressionPos),
    // [] 里的内容
    idx: val.substring(expressionPos + 1, expressionEndPos)
  }
}

/*
    charCodeAt() 方法可返回指定位置的字符的 Unicode 编码。这个返回值是 0 - 65535 之间的整数。
    charCodeAt() 与 charAt() 方法执行的操作相似，只不过前者返回的是位于指定位置的字符的编码，而后者返回的是字符子串。
*/
function next () {
  return str.charCodeAt(++index$1)
}

// eof -> end of file ?
function eof () {
  return index$1 >= len
}

// 字符串起始
function isStringStart (chr) {
  // '\x22' -> "  '\x27' -> '
  return chr === 0x22 || chr === 0x27
}

// 解析括弧
function parseBracket (chr) {
  var inBracket = 1;
  expressionPos = index$1;
  // 没超过结束字符
  while (!eof()) {
    chr = next();
    // 如果遇到引号（单引号或双引号），就一直向后走，直到引号关闭
    if (isStringStart(chr)) {
      parseString(chr);
      continue
    }
    // '\x5B' -> [
    if (chr === 0x5B) { inBracket++; }
    // '\x5B' -> ]
    if (chr === 0x5D) { inBracket--; }
    // 方括号关闭
    if (inBracket === 0) {
      expressionEndPos = index$1;
      break
    }
  }
}

// 解析字符串，从引号开始到引号结束
function parseString (chr) {
  var stringQuote = chr;
  while (!eof()) {
    chr = next();
    if (chr === stringQuote) {
      break
    }
  }
}

/*  */

var warn$1;

// in some cases, the event used has to be determined at runtime
// so we used some reserved tokens during compile.
// 在某些情况下，事件必须在运行时才能确定，所以在编译期间我们使用一些保留 token
var RANGE_TOKEN = '__r';
var CHECKBOX_RADIO_TOKEN = '__c';

// 给表单元素 el 添加属性并监听属性 
function model (el,dir,_warn) {
  warn$1 = _warn;
  var value = dir.value;
  var modifiers = dir.modifiers;
  var tag = el.tag;
  /*
    el.attrsMap 是一个 json 对象，结构大概是：
    {
        name1 : value1,
        name2 : value2,
        name3 : value3,
        ...
    }
  */
  var type = el.attrsMap.type;

  {
    // 动态 type
    var dynamicType = el.attrsMap['v-bind:type'] || el.attrsMap[':type'];
    if (tag === 'input' && dynamicType) {
      // v-model 不支持动态的 input 类型。建议用 v-if 分支来代替
      warn$1(
        "<input :type=\"" + dynamicType + "\" v-model=\"" + value + "\">:\n" +
        "v-model does not support dynamic input types. Use v-if branches instead."
      );
    }
    // inputs with type="file" are read only and setting the input's
    // value will throw an error.
    // 当 input 的 type="file" 时，是只读的，如果设置其 value 值是会报错的
    if (tag === 'input' && type === 'file') {
      warn$1(
        "<" + (el.tag) + " v-model=\"" + value + "\" type=\"file\">:\n" +
        "File inputs are read only. Use a v-on:change listener instead."
      );
    }
  }

  if (el.component) {
    // 生成 el.model 对象
    genComponentModel(el, value, modifiers);
    // component v-model doesn't need extra runtime
    return false
  // 下拉列表
  } else if (tag === 'select') {
    genSelect(el, value, modifiers);
  // 多选框
  } else if (tag === 'input' && type === 'checkbox') {
    genCheckboxModel(el, value, modifiers);
  // 单选框
  } else if (tag === 'input' && type === 'radio') {
    genRadioModel(el, value, modifiers);
  // 一般的 input/textarea
  } else if (tag === 'input' || tag === 'textarea') {
    genDefaultModel(el, value, modifiers);
  // 组件
  } else if (!config.isReservedTag(tag)) {
    genComponentModel(el, value, modifiers);
    // component v-model doesn't need extra runtime
    return false
  } else {
    // 并不是所有的元素标签都支持 v-model
    warn$1(
      "<" + (el.tag) + " v-model=\"" + value + "\">: " +
      "v-model is not supported on this element type. " +
      'If you are working with contenteditable, it\'s recommended to ' +
      'wrap a library dedicated for that purpose inside a custom component.'
    );
  }

  // ensure runtime directive metadata
  return true
}

// 为 tag === 'input' && type === 'checkbox' 的元素生成 model
function genCheckboxModel (el,value,modifiers) {
  var number = modifiers && modifiers.number;
  // :value 或 v-bind:value 的值
  var valueBinding = getBindingAttr(el, 'value') || 'null';
  // :true-value 或 v-bind:true-value 的值
  var trueValueBinding = getBindingAttr(el, 'true-value') || 'true';
  // :true-value 或 v-bind:true-value 的值
  var falseValueBinding = getBindingAttr(el, 'false-value') || 'false';
 
  // addProp (el, name, value) -> (el.props || (el.props = [])).push({ name: name, value: value })
  addProp(el, 'checked',
    "Array.isArray(" + value + ")" +
      "?_i(" + value + "," + valueBinding + ")>-1" + 
      (
        trueValueBinding === 'true'
          ? (":(" + value + ")")
          : (":_q(" + value + "," + trueValueBinding + ")")
      )
      /*
        简化一下 addProp 的第三个参数，value 值如下：
        ① trueValueBinding === 'true'
           Array.isArray( value ) ? _i(value , valueBinding) > -1 : value
        ② trueValueBinding !== 'true' 
           Array.isArray( value ) ? _i(value , valueBinding) > -1 : _q(value , trueValueBinding)
      */
  );
  /*
    CHECKBOX_RADIO_TOKEN = '__c'
    
    addHandler 函数的大致作用为：
    addHandler (el,name,value,modifiers,important,warn) 
    -> el.events[name] = el.events[name].push({ value: value, modifiers: modifiers })

    这的 value 为:
    var $$a = value,
        $$el = $event.target,
        $$c = $$el.checked ? trueValueBinding : falseValueBinding;

    if(Array.isArray($$a)){
        var $$v = number ? _n(valueBinding): valueBinding,
            $$i = _i($$a,$$v);
        
        if($$c){
            $$i < 0 && (value = $$a.concat($$v))
        } else {
            $$i > -1 && (value = $$a.slice(0,$$i).concat($$a.slice($$i+1)))
        }
    } else {
        genAssignmentCode(value, '$$c');
    }
  */
  addHandler(el, CHECKBOX_RADIO_TOKEN,
    "var $$a=" + value + "," +
        '$$el=$event.target,' +
        "$$c=$$el.checked?(" + trueValueBinding + "):(" + falseValueBinding + ");" +
    'if(Array.isArray($$a)){' +
      "var $$v=" + (number ? '_n(' + valueBinding + ')' : valueBinding) + "," +
          '$$i=_i($$a,$$v);' +
      "if($$c){$$i<0&&(" + value + "=$$a.concat($$v))}" +
      "else{$$i>-1&&(" + value + "=$$a.slice(0,$$i).concat($$a.slice($$i+1)))}" +
    "}else{" + (genAssignmentCode(value, '$$c')) + "}",
    null, true
  );
}

// 为 tag === 'input' && type === 'radio' 的元素生成 model
function genRadioModel (el,value,modifiers) {
  var number = modifiers && modifiers.number;
  // :value 或 v-bind:value 的值
  var valueBinding = getBindingAttr(el, 'value') || 'null';

  // 如果有 number 修饰符，就转为数值
  valueBinding = number ? ("_n(" + valueBinding + ")") : valueBinding;

  // 向数组 el.props 中添加 { name: 'checked', value: ("_q(" + value + "," + valueBinding + ")") }
  addProp(el, 'checked', ("_q(" + value + "," + valueBinding + ")"));

  /*
    CHECKBOX_RADIO_TOKEN = '__c'
    
    addHandler 函数的大致作用为：
    addHandler (el,name,value,modifiers,important,warn) 
    -> el.events[name] = el.events[name].push({ value: value, modifiers: modifiers })
  */
  addHandler(el, CHECKBOX_RADIO_TOKEN, genAssignmentCode(value, valueBinding), null, true);
}

// 为 tag === 'select' 的元素生成 model
function genSelect (el,value,modifiers) {
  var number = modifiers && modifiers.number;
  /*
    var selectedVal = Array.prototype.filter
                      .call($event.target.options , function(o){return o.selected})
                      .map(function(o){
                         var val = "_value" in o ? o._value : o.value;
                         return (number ? _n(val) : val) 
                      });
    可以看到，selectedVal 是一个数组
  */
  var selectedVal = "Array.prototype.filter" +
    ".call($event.target.options,function(o){return o.selected})" +
    ".map(function(o){var val = \"_value\" in o ? o._value : o.value;" +
    "return " + (number ? '_n(val)' : 'val') + "})";

  var assignment = '$event.target.multiple ? $$selectedVal : $$selectedVal[0]';
  var code = "var $$selectedVal = " + selectedVal + ";";
  // genAssignmentCode 其实就是一个 set 操作，value = $event.target.multiple ? $$selectedVal : $$selectedVal[0]
  code = code + " " + (genAssignmentCode(value, assignment));
  // el 的 change 事件发送会执行 code
  addHandler(el, 'change', code, null, true);
}

// 为 tag === 'input' || tag === 'textarea' 的元素生成 model
function genDefaultModel (el,value,modifiers) {
  var type = el.attrsMap.type;
  var ref = modifiers || {};
  // 在默认情况下，v-model 在 input 事件中同步输入框的值与数据，有了修饰符 lazy，从而转变为在 change 事件中同步
  var lazy = ref.lazy;
  // 如果想自动将用户的输入值转为 Number 类型 (如果原值的转换结果为 NaN 则返回原值)，可以添加一个修饰符 number 给 v-model 来处理输入值
  var number = ref.number;
  // 如果要自动过滤用户输入的首尾空格，可以添加 trim 修饰符到 v-model 上过滤输入
  var trim = ref.trim;
  var needCompositionGuard = !lazy && type !== 'range';

  /*
    RANGE_TOKEN = '__r'

    ① 有 lazy 修饰符，监听 change 事件
    ② 没有 lazy 修饰符
       a. type === 'range'，监听 __r 事件
       a. type !== 'range'，监听 input 事件 
  */
  var event = lazy
    ? 'change'
    : type === 'range'
      ? RANGE_TOKEN
      : 'input';

  var valueExpression = '$event.target.value';
  if (trim) {
    valueExpression = "$event.target.value.trim()";
  }
  if (number) {
    valueExpression = "_n(" + valueExpression + ")";
  }
  // 赋值语句，code = "value = valueExpression"
  var code = genAssignmentCode(value, valueExpression);

  // 如果 !lazy && type !== 'range'，多加个判断条件
  if (needCompositionGuard) {
    code = "if($event.target.composing)return;" + code;
  }
  // 给 el 添加 value 属性
  addProp(el, 'value', ("(" + value + ")"));
  // 监听 el 的 event 事件
  addHandler(el, event, code, null, true);

  // 监听失去焦点事件
  if (trim || number) {
    addHandler(el, 'blur', '$forceUpdate()');
  }
}

/*  */

// normalize v-model event tokens that can only be determined at runtime.
// it's important to place the event as the first in the array because
// the whole point is ensuring the v-model callback gets called before
// user-attached handlers.
// 把 v-model 事件放在事件数组的最前面是很有必要的。这样才能保证 v-model 的回调函数可以在用户自定义的监听函数前执行。
function normalizeEvents (on) {
  var event;

  // RANGE_TOKEN = '__r'
  if (isDef(on[RANGE_TOKEN])) {
    // IE input[type=range] only supports `change` event。在 ie 下，input[type=range] 只支持 change 事件
    event = isIE ? 'change' : 'input';
    /*
        concat() 方法用于连接两个或多个数组。
        arrayObject.concat(arrayX,arrayX,......,arrayX)

        例如：
        [].concat([1,2],[3,4,5]) -> [1, 2, 3, 4, 5]

        所以，以下操作是将 on[RANGE_TOKEN] 这个处理函数放在 on[event] 数组的最前边
    */
    on[event] = [].concat(on[RANGE_TOKEN], on[event] || []);
    delete on[RANGE_TOKEN];
  }

  // CHECKBOX_RADIO_TOKEN = '__c'
  if (isDef(on[CHECKBOX_RADIO_TOKEN])) {
    // Chrome fires microtasks in between click/change, leads to #4521
    event = isChrome ? 'click' : 'change';
    // 同理，将 on[CHECKBOX_RADIO_TOKEN] 这个处理函数放在 on[event] 数组的最前边
    on[event] = [].concat(on[CHECKBOX_RADIO_TOKEN], on[event] || []);
    delete on[CHECKBOX_RADIO_TOKEN];
  }
}

var target$1;

// 调用原生 api 事件绑定
function add$1 (event,handler,once$$1,capture,passive) {
  // 如果规定事件回调只执行一次，那就修正 handler
  if (once$$1) {
    var oldHandler = handler;
    var _target = target$1; // save current target element in closure
    // 修正 handler
    handler = function (ev) {
      var res = arguments.length === 1
        ? oldHandler(ev)
        : oldHandler.apply(null, arguments);
      // 执行一次就解除监听
      if (res !== null) {
        remove$2(event, handler, capture, _target);
      }
    };
  }
  /*
    dom 新规范规定，addEventListener() 的第三个参数可以是个对象值了：
    addEventListener(type, listener, {
        capture: false,
        passive: false,
        once: false
    })
  */
  target$1.addEventListener(
    event,
    handler,
    // 全局变量，标志是否支持 passive
    supportsPassive
      ? { capture: capture, passive: passive }
      : capture
  );
}

// 解除事件绑定
function remove$2 (
  event,
  handler,
  capture,
  _target
) {
  (_target || target$1).removeEventListener(event, handler, capture);
}

// 更新节点事件监听
function updateDOMListeners (oldVnode, vnode) {
  var isComponentRoot = isDef(vnode.componentOptions);
  // 绑定的事件
  var oldOn = isComponentRoot ? oldVnode.data.nativeOn : oldVnode.data.on;
  var on = isComponentRoot ? vnode.data.nativeOn : vnode.data.on;
  // 如果新旧节点都没绑定过事件，那就直接返回
  if (isUndef(oldOn) && isUndef(on)) {
    return
  }

  // 只要 oldOn 和 on 有一个不是 undefined 就会走到这，初始化 on 和 oldOn 为 {}
  on = on || {};
  oldOn = oldOn || {};

  target$1 = vnode.elm;
  // 将 v-model 回调函数放到回调函数队列最前面
  normalizeEvents(on);
  // 更新事件监听
  updateListeners(on, oldOn, add$1, remove$2, vnode.context);
}

// event 生命周期 create -> update
var events = {
  create: updateDOMListeners,
  update: updateDOMListeners
};

// 更新 props
function updateDOMProps (oldVnode, vnode) {
  // 如果新旧节点都没 props，那就谈不上更新了，返回吧
  if (isUndef(oldVnode.data.domProps) && isUndef(vnode.data.domProps)) {
    return
  }
  var key, cur;
  var elm = vnode.elm;
  var oldProps = oldVnode.data.domProps || {};
  var props = vnode.data.domProps || {};


  // clone observed objects, as the user probably wants to mutate it
  if (isDef(props.__ob__)) {
    // 复制一份 props，以免被改变了？
    props = vnode.data.domProps = extend({}, props);
  }

  // 新的属性不存在，则将对应的属性值置为 ''
  for (key in oldProps) {
    if (isUndef(props[key])) {
      elm[key] = '';
    }
  }

  for (key in props) {
    cur = props[key];
    // ignore children if the node has textContent or innerHTML,
    // as these will throw away existing DOM nodes and cause removal errors
    // on subsequent patches (#3360)
    // 如果有 textContent/innerHTML 属性，就强制清除子元素
    if (key === 'textContent' || key === 'innerHTML') {
      if (vnode.children) { vnode.children.length = 0; }
      // 和旧值相等，那就不操作了
      if (cur === oldProps[key]) { continue }
    }

    if (key === 'value') {
      // store value as _value as well since
      // non-string values will be stringified
      // 保留原始值，后面会将不是字符串的值会强制改为字符串
      elm._value = cur;
      // avoid resetting cursor position when value is the same
      // 将值强制改为字符串
      var strCur = isUndef(cur) ? '' : String(cur);
      // 判断是否应该更新 value
      if (shouldUpdateValue(elm, vnode, strCur)) {
        elm.value = strCur;
      }
    } else {
      elm[key] = cur;
    }
  }
}

// check platforms/web/util/attrs.js acceptValue

// 是否应该更新 value
function shouldUpdateValue (elm, vnode, checkVal) {
  return (!elm.composing && (
    vnode.tag === 'option' ||
    isDirty(elm, checkVal) ||
    isInputChanged(elm, checkVal)
  ))
}

// 当 elm 失去焦点，并且 checkVal 不等于 elm 当前的值，返回 true
function isDirty (elm, checkVal) {
  // return true when textbox (.number and .trim) loses focus and its value is
  // not equal to the updated value
  return document.activeElement !== elm && elm.value !== checkVal
}

// elm 的旧值和 newVal 是否相等
function isInputChanged (elm, newVal) {
  var value = elm.value;
  var modifiers = elm._vModifiers; // injected by v-model runtime
  // 数值化
  if (isDef(modifiers) && modifiers.number) {
    return toNumber(value) !== toNumber(newVal)
  }
  // 去掉前后空格
  if (isDef(modifiers) && modifiers.trim) {
    return value.trim() !== newVal.trim()
  }
  return value !== newVal
}

// props 生命周期 create -> update
var domProps = {
  create: updateDOMProps,
  update: updateDOMProps
};


// 将一段 css 文本转为 json 对象形式的 css（就像写在样式表里一样）
var parseStyleText = cached(function (cssText) {
  var res = {};
  /*
    /;(?![^(]*\))/
    ; 后面跟的不是（若干个非左括号加一个右括号）

    /:(.+)/
    : 后跟一个或多个不是换行符的字符
  */
  var listDelimiter = /;(?![^(]*\))/g;
  var propertyDelimiter = /:(.+)/;
  cssText.split(listDelimiter).forEach(function (item) {
    if (item) {
      var tmp = item.split(propertyDelimiter);
      /*
        res 结构为：
        {
            p1 : val1,
            p1 : val1,
            p1 : val1,
            ...
        }
      */
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim());
    }
  });
  return res
});

// merge static and dynamic style data on the same vnode
// 合并静态的和动态的 style 数据
function normalizeStyleData (data) {
  var style = normalizeStyleBinding(data.style);
  // static style is pre-processed into an object during compilation
  // and is always a fresh object, so it's safe to merge into it
  // 静态 style 在编译过程中会预处理到一个对象里，而这个对象总是一个新对象，所以把动态 style 合并到这个对象里是安全的
  return data.staticStyle
    ? extend(data.staticStyle, style)
    : style
}

// normalize possible array / string values into Object
// 将数组/字符串形式的数据转成 json 对象形式
function normalizeStyleBinding (bindingStyle) {
  if (Array.isArray(bindingStyle)) {
    /*
        arr = [
            { book : 'js' },
            { edition : 3 },
            { author : 'nanc' }
        ];
        toObject(arr)
        -> { book: "js", edition: 3, author: "nanc" }    
    */
    return toObject(bindingStyle)
  }
  // 将 css 文本转为 json 对象形式的 css（就像写在样式表里一样）
  if (typeof bindingStyle === 'string') {
    return parseStyleText(bindingStyle)
  }
  return bindingStyle
}

/**
 * parent component style should be after child's
 * so that parent component's style could override it
 */
// 返回一个 json 对象。父组件的 style 应该在子组件的后面。这样父组件的 style 就可以覆盖前面的。
function getStyle (vnode, checkChild) {
  var res = {};
  var styleData;

  if (checkChild) {
    var childNode = vnode;
    // 遍历子节点，将子节点的 styleData 都合并到 res 中
    while (childNode.componentInstance) {
      childNode = childNode.componentInstance._vnode;
      if (childNode.data && (styleData = normalizeStyleData(childNode.data))) {
        extend(res, styleData);
      }
    }
  }

  // 当前组件 styleData，这样就可以覆盖子组件的样式
  if ((styleData = normalizeStyleData(vnode.data))) {
    extend(res, styleData);
  }

  // 遍历祖先组件，后面的覆盖前面的
  var parentNode = vnode;
  while ((parentNode = parentNode.parent)) {
    if (parentNode.data && (styleData = normalizeStyleData(parentNode.data))) {
      extend(res, styleData);
    }
  }
  return res
}


var cssVarRE = /^--/;
var importantRE = /\s*!important$/;
// 设置 style 属性
var setProp = function (el, name, val) {
  // name 以 -- 开头
  if (cssVarRE.test(name)) {
    // 调用原生的 setProperty 方法设置样式
    el.style.setProperty(name, val);
  } else if (importantRE.test(val)) {
    // setProperty 可接受第三个参数为 'important'
    el.style.setProperty(name, val.replace(importantRE, ''), 'important');
  } else {
    // 属性名转为 style 对象接受的驼峰化
    var normalizedName = normalize(name);
    if (Array.isArray(val)) {
      // Support values array created by autoprefixer, e.g.
      // {display: ["-webkit-box", "-ms-flexbox", "flex"]}
      // Set them one by one, and the browser will only set those it can recognize
      /*
        例如 {display: ["-webkit-box", "-ms-flexbox", "flex"]}
        会依次设置：
        el.style["display"] = "-webkit-box";
        el.style["display"] = "-ms-flexbox";
        el.style["display"] = "flex";
        虽然是连续设置了 3 次，但是浏览器只会真正执行它“认识”的属性值
      */
      for (var i = 0, len = val.length; i < len; i++) {
        el.style[normalizedName] = val[i];
      }
    } else {
      el.style[normalizedName] = val;
    }
  }
};

var vendorNames = ['Webkit', 'Moz', 'ms'];
var emptyStyle;
// 将普通的 css 属性名转为 style 对象中合法的属性名
var normalize = cached(function (prop) {
  // 初始化一个 style 对象
  emptyStyle = emptyStyle || document.createElement('div').style;
  // 将连字符分隔的字符串驼峰化，例如：a-b-c -> aBC
  prop = camelize(prop);
  // 合法的 prop
  if (prop !== 'filter' && (prop in emptyStyle)) {
    return prop
  }
  var capName = prop.charAt(0).toUpperCase() + prop.slice(1);
  // 以 prop 为 margin-top 为例，依次用 WebkitMarginTop、MozMarginTop、msMarginTop 类匹配 emptyStyle 里的属性名，匹配上了就是合法的
  for (var i = 0; i < vendorNames.length; i++) {
    var name = vendorNames[i] + capName;
    if (name in emptyStyle) {
      return name
    }
  }
});

// 更新 style
function updateStyle (oldVnode, vnode) {
  var data = vnode.data;
  var oldData = oldVnode.data;

  // 如果没有 style 数据，就谈不上更新了
  if (isUndef(data.staticStyle) && isUndef(data.style) && isUndef(oldData.staticStyle) && isUndef(oldData.style)) {
    return
  }

  var cur, name;
  var el = vnode.elm;
  // 旧的 style
  var oldStaticStyle = oldData.staticStyle;
  var oldStyleBinding = oldData.normalizedStyle || oldData.style || {};

  // if static style exists, stylebinding already merged into it when doing normalizeStyleData
  // normalizeStyleData 函数已经把动态 style 合并到静态 style 中了，所以这里取 oldStaticStyle 就够了
  var oldStyle = oldStaticStyle || oldStyleBinding;

  var style = normalizeStyleBinding(vnode.data.style) || {};

  // store normalized style under a different key for next diff
  // make sure to clone it if it's reactive, since the user likley wants
  // to mutate it.
  // 如果 style 对象被观察，那就克隆一份
  vnode.data.normalizedStyle = isDef(style.__ob__)
    ? extend({}, style)
    : style;

  // 返回静态 style 和动态 style 的集合
  var newStyle = getStyle(vnode, true);

  // newStyle 不存在的属性，属性值置为 ''
  for (name in oldStyle) {
    if (isUndef(newStyle[name])) {
      setProp(el, name, '');
    }
  }
  // 新旧属性不一样，更新之
  for (name in newStyle) {
    cur = newStyle[name];
    if (cur !== oldStyle[name]) {
      // ie9 setting to null has no effect, must use empty string
      setProp(el, name, cur == null ? '' : cur);
    }
  }
}

// style 生命周期 create -> update
var style = {
  create: updateStyle,
  update: updateStyle
};

/*
说一说 classList 属性：

 ① 传统方法
    在操作类名的时候，需要通过className属性添加、删除和替换类名。如下面例子：
    <p class="bd user disabled">...</p>

    这个p中一共有三个类名，要从中删掉一个类名，需要把这三个类分别拆开，然后进行处理，处理过程如下：
    
    <script>
       var className=p.className.split(/\s+/);
       //找到要删掉的类名
       var pos=-1,i,len;

       for (var i = 0; i < className.length; i++) {
           if(className[i]=="user"){
              pos=i;
              break;
           }
       };
       className.splice(i,1);
       //将余下的类名重新拼装
       p.className=className.join(" ");
    </script>

 ② html5 新增方法 classList()，可以完全摆脱 className 属性

    <p id="myDiv" class="init">Hello world!</p>
    <input type="button" value="Add class" onclick="addClass()">
    <input type="button" value="Remove class" onclick="removeClass()">
    <input type="button" value="Toggle class" onclick="toggleClass()">
    <input type="button" value="Contains class?" onclick="containsClass()">
    <p>This demo works in Firefox 3.6 and Chrome 8.</p>
     
    <script type="text/javascript">
        function addClass(){
            var myDiv = document.getElementById("myDiv");
            myDiv.classList.add("highlight");
        }
     
        function removeClass(){
            var myDiv = document.getElementById("myDiv");
            myDiv.classList.remove("highlight");
        }
     
        function toggleClass(){
            var myDiv = document.getElementById("myDiv");
            myDiv.classList.toggle("highlight");
        }
     
        function containsClass(){
            var myDiv = document.getElementById("myDiv");
            alert(myDiv.classList.contains("highlight"));
        }
    </script>

    可以看到，使用 classList 来修改 class 是多么便捷
*/

/**
 * Add class with compatibility for SVG since classList is not supported on
 * SVG elements in IE
 */
// 把 cls 添加到 el 的 class 属性里
function addClass (el, cls) {
  // cls 必须存在
  if (!cls || !(cls = cls.trim())) {
    return
  }

  if (el.classList) {
    // cls 是空格分开的多个 class 构成，逐个添加
    if (cls.indexOf(' ') > -1) {
      cls.split(/\s+/).forEach(function (c) { return el.classList.add(c); });
    } else {
      el.classList.add(cls);
    }
  } else {
    var cur = " " + (el.getAttribute('class') || '') + " ";
    // 如果当前 class 属性不包括 cls，那就加上
    if (cur.indexOf(' ' + cls + ' ') < 0) {
      el.setAttribute('class', (cur + cls).trim());
    }
  }
}

/**
 * Remove class with compatibility for SVG since classList is not supported on
 * SVG elements in IE
 */
function removeClass (el, cls) {
  // cls 必须存在
  if (!cls || !(cls = cls.trim())) {
    return
  }

  /* istanbul ignore else */
  if (el.classList) {
    // cls 是空格分开的多个 class 构成，逐个删除
    if (cls.indexOf(' ') > -1) {
      cls.split(/\s+/).forEach(function (c) { return el.classList.remove(c); });
    } else {
      el.classList.remove(cls);
    }
    // 如果 classList 长度为 0，那就移除 class 属性
    if (!el.classList.length) {
      el.removeAttribute('class');
    }
  } else {
    var cur = " " + (el.getAttribute('class') || '') + " ";
    var tar = ' ' + cls + ' ';
    // 把 cls 从 class 中移除
    while (cur.indexOf(tar) >= 0) {
      cur = cur.replace(tar, ' ');
    }
    cur = cur.trim();
    // 如果移除 cls 后 class 还有值，那就重新设置 class。否则把 class 属性移除掉。
    if (cur) {
      el.setAttribute('class', cur);
    } else {
      el.removeAttribute('class');
    }
  }
}

// 返回一个 json 对象
function resolveTransition (def$$1) {
  if (!def$$1) {
    return
  }
  // def$$1 是对象，也是返回一个 json 对象，除了 6 个 class，还有包括 def$$1 的所有可枚举属性
  if (typeof def$$1 === 'object') {
    var res = {};
    if (def$$1.css !== false) {
      extend(res, autoCssTransition(def$$1.name || 'v'));
    }
    extend(res, def$$1);
    return res
  // def$$1 是字符串，那就返回 6 个 class 组成的 json 对象
  } else if (typeof def$$1 === 'string') {
    return autoCssTransition(def$$1)
  }
}

// 返回 transition 所需的 6 个 class 组成的 json 对象
var autoCssTransition = cached(function (name) {
  return {
    enterClass: (name + "-enter"),
    enterToClass: (name + "-enter-to"),
    enterActiveClass: (name + "-enter-active"),
    leaveClass: (name + "-leave"),
    leaveToClass: (name + "-leave-to"),
    leaveActiveClass: (name + "-leave-active")
  }
});

var hasTransition = inBrowser && !isIE9;
var TRANSITION = 'transition';
var ANIMATION = 'animation';

// Transition property/event sniffing
var transitionProp = 'transition';
var transitionEndEvent = 'transitionend';
var animationProp = 'animation';
var animationEndEvent = 'animationend';

// 浏览器环境，并且非 ie9
if (hasTransition) {
  /* istanbul ignore if */
  // 修正 transitionProp 和 transitionEndEvent
  if (window.ontransitionend === undefined && window.onwebkittransitionend !== undefined) {
    transitionProp = 'WebkitTransition';
    transitionEndEvent = 'webkitTransitionEnd';
  }

  // 修正 animationProp 和 animationEndEvent
  if (window.onanimationend === undefined && window.onwebkitanimationend !== undefined) {
    animationProp = 'WebkitAnimation';
    animationEndEvent = 'webkitAnimationEnd';
  }
}

// binding to window is necessary to make hot reload work in IE in strict mode
// 对于严格模式下的 ie 进行热更新，把 window.requestAnimationFrame 方法的 this 绑定到 window 对象是必要的
var raf = inBrowser && window.requestAnimationFrame
  ? window.requestAnimationFrame.bind(window)
  : setTimeout;

/*
看一下 window.requestAnimationFrame 方法的基本用法：

requestAnimationFrame 的用法与 settimeout 很相似，只是不需要设置时间间隔而已。
requestAnimationFrame 使用一个回调函数作为参数，这个回调函数会在浏览器重绘之前调用。
它返回一个整数，表示定时器的编号，这个值可以传递给 cancelAnimationFrame 用于取消这个函数的执行

用法：requestID = requestAnimationFrame(callback); 
callback 方法在执行动画之前调用 1 次。

例1，小红块自下向上运动 5 秒：
<div id="app"></div>
<style>
    #app{
        position: absolute;
        width:20px;
        height:20px;
        background: red;
    }

    .animate-on-transforms{
        transition: all 5s;
    }
</style>
<script>
    var app = document.getElementById('app');

    app.style.transform = `translateY(30px)`;

    var timer = requestAnimationFrame(function() {
        app.classList.add('animate-on-transforms');
        app.style.transform = '';
        console.log('动画开始前执行该函数');
    });
</script>

以上几句简单的代码就可以实现一个小红块从下到上移动 30px 的动画。

注意，这里的 requestAnimationFrame 函数执行 1 次，callback 函数也是执行 1 次，就可以让动画动起来。

问题来了，动画产生的原因是什么？
① 首先给 app 添加了一个 transform 属性： translateY(30px)，那么 app 会突变到相对原位置向下 30px 的位置；
② 然后，执行 requestAnimationFrame 方法，会调用 callback 方法；
③ 在 callback 方法中，将 app 的 transform 属性置空，那么意味着 app 会移动回到它最开始的位置，即 top 属性由 30px 变为 0;
④ 除此之外，callback 方法中还给 app 添加了一个新的 class: animate-on-transforms，这个属性 class 限定所有的属性变化时长为 5s;
⑤ 于是，我们就可以看到一个时长 5s 的动画了

另外，我们可以用 cancelAnimationFrame(timer) 来取消定时器


例2，小红块自左向右运动 2 秒 ：
<div id="app"></div>
<style>
    #app{
        position: absolute;
        width:20px;
        height:20px;
        background: red;
    }

    .animate-on-transforms{
        transition: all 5s;
    }
</style>
<script>
var start = null;
var element = document.getElementById('app');
element.style.position = 'absolute';

function step(timestamp) {
  if (!start) start = timestamp;
  var progress = timestamp - start;
  element.style.left = Math.min(progress / 10, 200) + 'px';
  if (progress < 2000) {
    window.requestAnimationFrame(step);
  }
}

window.requestAnimationFrame(step);
</script>

这个例子中涉及到多次递归调用 requestAnimationFrame 方法，好像比例子 1 更复杂一些。为什么需要多次调用呢？

这就有点像 setTimeout 函数的用法了。 
① 首先执行 window.requestAnimationFrame(step) 方法，会执行 1 次 step 方法；
② step 方法使得 element 位置突变到 Math.min(progress / 10, 200) + 'px'，如果不再调用 requestAnimationFrame 方法，就会停止在这个位置；
③ 于是，在 step 方法里又调用 requestAnimationFrame 方法，requestAnimationFrame 方法又调用 step 方法来突变位置；
④ 由于位置突变频率很高，所以看起来就是一个连贯的动画了；
⑤ 2 秒后，step 方法不再调用 requestAnimationFrame 方法，动画终止。

另外，回调函数 step 有一个传参 timestamp，它表示 step 回调函数第一次执行到现在的时间（单位毫秒）。
 */

// raf 是 requestAnimationFrame 的简称
function nextFrame (fn) {
  raf(function () {
    raf(fn);
  });
}

// 添加动画 class
function addTransitionClass (el, cls) {
  var transitionClasses = el._transitionClasses || (el._transitionClasses = []);
  // 一方面把 cls 加入到数组 el._transitionClasse 里，另一方面把 cls 应用到 class 属性里
  if (transitionClasses.indexOf(cls) < 0) {
    transitionClasses.push(cls);
    addClass(el, cls);
  }
}

// 移除动画 class
function removeTransitionClass (el, cls) {
  if (el._transitionClasses) {
    // 从数组 el._transitionClasses 里删除 cls
    remove(el._transitionClasses, cls);
  }
  // 把 cls 从 class 属性里删除
  removeClass(el, cls);
}

// 过渡/动画结束处理
function whenTransitionEnds (el,expectedType,cb) {
  // 包含过渡信息的 json 对象
  var ref = getTransitionInfo(el, expectedType);
  var type = ref.type;
  var timeout = ref.timeout;
  var propCount = ref.propCount;

  // 没有 type，直接执行回调函数 cb
  if (!type) { return cb() }

  // transitionEndEvent = 'transitionend'; animationEndEvent = 'animationend';
  var event = type === TRANSITION ? transitionEndEvent : animationEndEvent;
  var ended = 0;

  var end = function () {
    el.removeEventListener(event, onEnd);
    cb();
  };
  var onEnd = function (e) {
    if (e.target === el) {
      // 动画属性执行完毕，那就解除监听
      if (++ended >= propCount) {
        end();
      }
    }
  };
  // 过渡/动画设定的最长时间结束后，如果 ended 还是小于 propCount，那还是解除监听，并执行回调函数 cb
  setTimeout(function () {
    if (ended < propCount) {
      end();
    }
  }, timeout + 1);
  // 监听过渡/动画结束事件
  el.addEventListener(event, onEnd);
}

var transformRE = /\b(transform|all)(,|$)/;

// 获取过渡相关信息
function getTransitionInfo (el, expectedType) {
  var styles = window.getComputedStyle(el);

  // transitionProp = 'transition';
  var transitionDelays = styles[transitionProp + 'Delay'].split(', ');
  var transitionDurations = styles[transitionProp + 'Duration'].split(', ');
  // 获得 [过渡延迟时间] + [过渡持续时间] 的最大值
  var transitionTimeout = getTimeout(transitionDelays, transitionDurations);

  // var animationProp = 'animation';
  var animationDelays = styles[animationProp + 'Delay'].split(', ');
  var animationDurations = styles[animationProp + 'Duration'].split(', ');
  // 获得 [动画延迟时间] + [动画持续时间] 的最大值
  var animationTimeout = getTimeout(animationDelays, animationDurations);

  var type;
  var timeout = 0;
  var propCount = 0;
  
  // TRANSITION = 'transition'，过渡
  if (expectedType === TRANSITION) {
    if (transitionTimeout > 0) {
      type = TRANSITION;
      timeout = transitionTimeout;
      propCount = transitionDurations.length;
    }
  // ANIMATION = 'animation'，动画
  } else if (expectedType === ANIMATION) {
    if (animationTimeout > 0) {
      type = ANIMATION;
      timeout = animationTimeout;
      propCount = animationDurations.length;
    }
  } else {
    // 过渡耗时和动画耗时之间的最大值
    timeout = Math.max(transitionTimeout, animationTimeout);
    // type 取决于哪个耗时更大
    type = timeout > 0
      ? transitionTimeout > animationTimeout
        ? TRANSITION
        : ANIMATION
      : null;
    propCount = type
      ? type === TRANSITION
        ? transitionDurations.length
        : animationDurations.length
      : 0;
  }
  // transformRE = /\b(transform|all)(,|$)/
  var hasTransform = type === TRANSITION && transformRE.test(styles[transitionProp + 'Property']);
  return {
    type: type,
    timeout: timeout,
    propCount: propCount,
    hasTransform: hasTransform
  }
}

/*
取出 [延迟时间] + [持续时间] 的最大值
例如：
getTimeout(['10s','30s','50s'],['20s','40s']) -> 70000
getTimeout(['10s','30s','50s'],['20s','40s','60s']) -> 110000
 */
function getTimeout (delays, durations) {
  /* istanbul ignore next */

  // 这个操作使得数组 delays 长度大于等于 durations 的长度
  while (delays.length < durations.length) {
    delays = delays.concat(delays);
  }

  /*
    array.map(callback[, thisArg])

    参数
    callback : 原数组中的元素经过该方法后返回一个新的元素。
    currentValue : callback 的第一个参数，数组中当前被传递的元素。
    index : callback 的第二个参数，数组中当前被传递的元素的索引。
    array : callback 的第三个参数，调用 map 方法的数组。
    thisArg : 执行 callback 函数时 this 指向的对象。
   */

  // 遍历数组 durations，获取 toMs(d) + toMs(delays[i]) 的最大值
  return Math.max.apply(null, durations.map(function (d, i) {
    return toMs(d) + toMs(delays[i])
  }))
}

// toMs('123s') -> 123000
function toMs (s) {
  // 'abc'.slice(0, -1) -> 'ab'
  return Number(s.slice(0, -1)) * 1000
}

// 过渡/动画进入
function enter (vnode, toggleDisplay) {
  var el = vnode.elm;

  // call leave callback now，调用离开的回调函数
  if (isDef(el._leaveCb)) {
    el._leaveCb.cancelled = true;
    el._leaveCb();
  }

  // 6 个 class 、css、type 等组成的 json 对象
  var data = resolveTransition(vnode.data.transition);
  if (isUndef(data)) {
    return
  }

  // 如果存在 el._enterCb 或节点类型为 Element，返回
  if (isDef(el._enterCb) || el.nodeType !== 1) {
    return
  }

  var css = data.css;
  var type = data.type;

  // enter 相关 class
  var enterClass = data.enterClass;
  var enterToClass = data.enterToClass;
  var enterActiveClass = data.enterActiveClass;

  // appear 相关 class
  var appearClass = data.appearClass;
  var appearToClass = data.appearToClass;
  var appearActiveClass = data.appearActiveClass;

  // enter 相关钩子
  var beforeEnter = data.beforeEnter;
  var enter = data.enter;
  var afterEnter = data.afterEnter;
  var enterCancelled = data.enterCancelled;

  // appear 相关钩子
  var beforeAppear = data.beforeAppear;
  var appear = data.appear;
  var afterAppear = data.afterAppear;
  var appearCancelled = data.appearCancelled;

  // 持续时间
  var duration = data.duration;

  // activeInstance will always be the <transition> component managing this
  // transition. One edge case to check is when the <transition> is placed
  // as the root node of a child component. In that case we need to check
  // <transition>'s parent for appear check.

  /*
    当前被激活的实例将会是管理着过渡的 <transition> 组件。
    不过，当 <transition> 作为子组件的根节点时，我们需要去检查 <transition> 的父节点
  */


  var context = activeInstance;
  var transitionNode = activeInstance.$vnode;
  while (transitionNode && transitionNode.parent) {
    transitionNode = transitionNode.parent;
    context = transitionNode.context;
  }

  // 没有被插入过文档？
  var isAppear = !context._isMounted || !vnode.isRootInsert;

  // 返回
  if (isAppear && !appear && appear !== '') {
    return
  }

  // 元素被插入时生效，下一帧移除
  var startClass = isAppear && appearClass
    ? appearClass
    : enterClass;

  // 在过渡过程中生效，比如定义过渡时间，延迟和曲线函数等
  var activeClass = isAppear && appearActiveClass
    ? appearActiveClass
    : enterActiveClass;
  
  // 在元素被插入一帧后生效，在 transition/animation 完成之后移除
  var toClass = isAppear && appearToClass
    ? appearToClass
    : enterToClass;

  // 进入之前钩子
  var beforeEnterHook = isAppear
    ? (beforeAppear || beforeEnter)
    : beforeEnter;

  // 进入钩子
  var enterHook = isAppear
    ? (typeof appear === 'function' ? appear : enter)
    : enter;

  // 进入之后钩子
  var afterEnterHook = isAppear
    ? (afterAppear || afterEnter)
    : afterEnter;

  // 进入取消钩子
  var enterCancelledHook = isAppear
    ? (appearCancelled || enterCancelled)
    : enterCancelled;

  // 进入持续时间，数值
  var explicitEnterDuration = toNumber(
    isObject(duration)
      ? duration.enter
      : duration
  );

  // 开发模式下，检验 explicitEnterDuration 是否是有效的数值（类型为 number，并且不为 NaN）
  if ("development" !== 'production' && explicitEnterDuration != null) {
    checkDuration(explicitEnterDuration, 'enter', vnode);
  }

  /*
    推荐对于仅使用 JavaScript 过渡的元素添加 v-bind:css="false"，Vue 会跳过 CSS 的检测。这也可以避免过渡过程中 CSS 的影响。

    当 css 不为 false，并且不为 ie9 时，expectsCSS 为 true
  */
  var expectsCSS = css !== false && !isIE9;
  // enterHook 函数形参个数是否大于 1
  var userWantsControl = getHookArgumentsLength(enterHook);

  // once(fn) 确保 fn 只被执行 1 次
  var cb = el._enterCb = once(function () {
    if (expectsCSS) {
      // 移除 toClass、activeClass
      removeTransitionClass(el, toClass);
      removeTransitionClass(el, activeClass);
    }
    // 进入取消
    if (cb.cancelled) {
      if (expectsCSS) {
        // 移除 startClass
        removeTransitionClass(el, startClass);
      }
      // 进入取消钩子
      enterCancelledHook && enterCancelledHook(el);
    // 进入之后钩子
    } else {
      afterEnterHook && afterEnterHook(el);
    }
    el._enterCb = null;
  });

  if (!vnode.data.show) {
    // remove pending leave element on enter by injecting an insert hook
    // mergeVNodeHook (def, hookKey, hook) 的作用是将钩子方法 hook 加入到 def[hookKey] 中，也就是添加一个钩子方法，以后执行 def[hookKey] 也就会执行 hook 方法了
    mergeVNodeHook(vnode.data.hook || (vnode.data.hook = {}), 'insert', function () {
      var parent = el.parentNode;
      var pendingNode = parent && parent._pending && parent._pending[vnode.key];

      if (pendingNode && pendingNode.tag === vnode.tag && pendingNode.elm._leaveCb) {
        pendingNode.elm._leaveCb();
      }
      // 进入钩子
      enterHook && enterHook(el, cb);
    });
  }

  // start enter transition，开始进入过渡，调用进入前钩子
  beforeEnterHook && beforeEnterHook(el);

  if (expectsCSS) {
    // 添加 startClass、activeClass
    addTransitionClass(el, startClass);
    addTransitionClass(el, activeClass);
    
    // 下一帧，添加 toClass，移除 startClass
    nextFrame(function () {
      addTransitionClass(el, toClass);
      removeTransitionClass(el, startClass);
      if (!cb.cancelled && !userWantsControl) {
        // isValidDuration (explicitEnterDuration)，判断 explicitEnterDuration 是否为有效的数组（类型为 number，且不为 NaN）
        if (isValidDuration(explicitEnterDuration)) {
          // 过渡结束后调用回调
          setTimeout(cb, explicitEnterDuration);
        } else {
          // 过渡结束处理
          whenTransitionEnds(el, type, cb);
        }
      }
    });
  }

  if (vnode.data.show) {
    // toggleDisplay 为 enter 方法的第二个形参
    toggleDisplay && toggleDisplay();
    // 进入钩子
    enterHook && enterHook(el, cb);
  }
  
  /*
  ① 如果过渡的元素有属性 v-bind:css="false"，那么 expectsCSS 就是 false
  ② userWantsControl 为 true 表示 enterHook 函数形参个数大于 1
  */
  if (!expectsCSS && !userWantsControl) {
    cb();
  }
}

// 过渡/动画离开
function leave (vnode, rm) {
  var el = vnode.elm;

  // call enter callback now，调用进入的回调函数
  if (isDef(el._enterCb)) {
    el._enterCb.cancelled = true;
    el._enterCb();
  }

  // 6 个 class 、css、type 等组成的 json 对象
  var data = resolveTransition(vnode.data.transition);
  if (isUndef(data)) {
    return rm()
  }

  // 如果存在 el._enterCb 或节点类型为 Element，返回
  if (isDef(el._leaveCb) || el.nodeType !== 1) {
    return
  }

  var css = data.css;
  var type = data.type;
  
  // leave 相关 class
  var leaveClass = data.leaveClass;
  var leaveToClass = data.leaveToClass;
  var leaveActiveClass = data.leaveActiveClass;

  // leave 相关钩子
  var beforeLeave = data.beforeLeave;
  var leave = data.leave;
  var afterLeave = data.afterLeave;
  var leaveCancelled = data.leaveCancelled;

  // 延迟时间和持续时间
  var delayLeave = data.delayLeave;
  var duration = data.duration;

  /*
    推荐对于仅使用 JavaScript 过渡的元素添加 v-bind:css="false"，Vue 会跳过 CSS 的检测。这也可以避免过渡过程中 CSS 的影响。

    当 css 不为 false，并且不为 ie9 时，expectsCSS 为 true
  */
  var expectsCSS = css !== false && !isIE9;
  // leave 函数形参个数是否大于 1
  var userWantsControl = getHookArgumentsLength(leave);

  // 离开持续时间，数值
  var explicitLeaveDuration = toNumber(
    isObject(duration)
      ? duration.leave
      : duration
  );

  // 开发模式下，检验 explicitLeaveDuration 是否是有效的数值（类型为 number，并且不为 NaN）
  if ("development" !== 'production' && isDef(explicitLeaveDuration)) {
    checkDuration(explicitLeaveDuration, 'leave', vnode);
  }

  // once(fn) 确保 fn 只被执行 1 次
  var cb = el._leaveCb = once(function () {
    if (el.parentNode && el.parentNode._pending) {
      el.parentNode._pending[vnode.key] = null;
    }
    if (expectsCSS) {
      // 移除 leaveToClass、leaveActiveClass
      removeTransitionClass(el, leaveToClass);
      removeTransitionClass(el, leaveActiveClass);
    }
    // 离开取消
    if (cb.cancelled) {
      if (expectsCSS) {
        // 移除 leaveClass
        removeTransitionClass(el, leaveClass);
      }
      // 离开取消钩子
      leaveCancelled && leaveCancelled(el);
    // 离开之后钩子
    } else {
      rm();
      afterLeave && afterLeave(el);
    }
    el._leaveCb = null;
  });

  // 延迟
  if (delayLeave) {
    delayLeave(performLeave);
  } else {
    performLeave();
  }
  
  // 执行离开过渡
  function performLeave () {
    // the delayed leave may have already been cancelled
    if (cb.cancelled) {
      return
    }
    // record leaving element，记录正在离开的元素
    if (!vnode.data.show) {
      (el.parentNode._pending || (el.parentNode._pending = {}))[(vnode.key)] = vnode;
    }
    // 离开前钩子
    beforeLeave && beforeLeave(el);
    if (expectsCSS) {
      // 添加 leaveClass、leaveActiveClass
      addTransitionClass(el, leaveClass);
      addTransitionClass(el, leaveActiveClass);

      // 下一帧，添加 leaveToClass，移除 leaveClass
      nextFrame(function () {
        addTransitionClass(el, leaveToClass);
        removeTransitionClass(el, leaveClass);
        if (!cb.cancelled && !userWantsControl) {
          // isValidDuration (explicitLeaveDuration)，判断 explicitLeaveDuration 是否为有效的数组（类型为 number，且不为 NaN）
          if (isValidDuration(explicitLeaveDuration)) {
            // 过渡结束后调用回调
            setTimeout(cb, explicitLeaveDuration);
          } else {
            // 过渡结束处理
            whenTransitionEnds(el, type, cb);
          }
        }
      });
    }
    // 离开钩子
    leave && leave(el, cb);
    /*
     ① 如果过渡的元素有属性 v-bind:css="false"，那么 expectsCSS 就是 false
     ② userWantsControl 为 true 表示 leave 函数形参个数大于 1
    */
    if (!expectsCSS && !userWantsControl) {
      cb();
    }
  }
}

// only used in dev mode
// 只在开发模式下会用到
function checkDuration (val, name, vnode) {
  // val 必须是 number 类型
  if (typeof val !== 'number') {
    warn(
      "<transition> explicit " + name + " duration is not a valid number - " +
      "got " + (JSON.stringify(val)) + ".",
      vnode.context
    );
  // val 还不能是 NaN
  } else if (isNaN(val)) {
    warn(
      "<transition> explicit " + name + " duration is NaN - " +
      'the duration expression might be incorrect.',
      vnode.context
    );
  }
}

// 有效的持续时间，也就是 val 是有效的数值
function isValidDuration (val) {
  return typeof val === 'number' && !isNaN(val)
}

/**
 * Normalize a transition hook's argument length. The hook may be:
 * - a merged hook (invoker) with the original in .fns
 * - a wrapped component method (check ._length)
 * - a plain function (.length)
 */
 // 判断钩子函数形参个数是否大于 1
function getHookArgumentsLength (fn) {
  if (isUndef(fn)) {
    return false
  }
  var invokerFns = fn.fns;
  if (isDef(invokerFns)) {
    // invoker
    return getHookArgumentsLength(
      Array.isArray(invokerFns)
        ? invokerFns[0]
        : invokerFns
    )
  } else {
    // 实质就这一句
    return (fn._length || fn.length) > 1
  }
}

// 过渡/动画进入
function _enter (_, vnode) {
  if (vnode.data.show !== true) {
    enter(vnode);
  }
}

// transition 生命周期 create -> activate -> remove。仅仅在浏览器环境下存在。
var transition = inBrowser ? {
  create: _enter,   // 进入
  activate: _enter, // 进入
  remove: function remove$$1 (vnode, rm) {
    /* istanbul ignore else */
    if (vnode.data.show !== true) {
      // 离开
      leave(vnode, rm);
    } else {
      rm();
    }
  }
} : {};

// 模块
var platformModules = [
  attrs,
  klass,
  events,
  domProps,
  style,
  transition
];

/*  */

// the directive module should be applied last, after all
// built-in modules have been applied.
/*
var baseModules = [
  ref,
  directives
];

modules -> [
  attrs,
  klass,
  events,
  domProps,
  style,
  transition,
  ref,
  directives
]

其中：
var attrs = {
  create: updateAttrs,
  update: updateAttrs
}
var klass = {
  create: updateClass,
  update: updateClass
}
...

于是，modules 为：
modules -> [
  {
      create: updateAttrs,
      update: updateAttrs
  },
  {
      create: updateClass,
      update: updateClass
  },
  {
      create: updateDOMListeners,
      update: updateDOMListeners
  },
  {
      create: updateDOMProps,
      update: updateDOMProps
  },
  {
      create: updateStyle,
      update: updateStyle
  },
  {
      create: _enter,
      activate: _enter,
      remove: function remove$$1 (vnode, rm) {}
  },
  {
      // 添加引用 ref
      create: function create (_, vnode) {},
      // 更新引用 ref
      update: function update (oldVnode, vnode) {},
      // 删除引用 ref
      destroy: function destroy (vnode) {}
  },
  {
      create: updateDirectives,
      update: updateDirectives,
      destroy: function unbindDirectives (vnode) {
        updateDirectives(vnode, emptyNode);
      }
  }
]

另外，
var nodeOps = Object.freeze({
    createElement: createElement$1,
    createElementNS: createElementNS,
    createTextNode: createTextNode,
    createComment: createComment,
    insertBefore: insertBefore,
    removeChild: removeChild,
    appendChild: appendChild,
    parentNode: parentNode,
    nextSibling: nextSibling,
    tagName: tagName,
    setTextContent: setTextContent,
    setAttribute: setAttribute
});
*/
var modules = platformModules.concat(baseModules);

/*
    patch 函数由 createPatchFunction 函数返回，格式为：function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {...}
    ① nodeOps 对象封装了 dom 操作相关方法
    ② modules 为属性、指令等相关的生命周期方法
*/
var patch = createPatchFunction({ nodeOps: nodeOps, modules: modules });

/**
 * Not type checking this file because flow doesn't like attaching
 * properties to Elements.
 */

// <input> 的 type 类型为下列值之一
var isTextInputType = makeMap('text,number,password,search,email,tel,url');

/* istanbul ignore if */
if (isIE9) {
  // http://www.matts411.com/post/internet-explorer-9-oninput/
  // ie9 下，如果一个元素有 v-model 属性，那这个元素的 selectionchange 事件就转交给 input 事件
  document.addEventListener('selectionchange', function () {
    var el = document.activeElement;
    if (el && el.vmodel) {
      // 触发 input 方法
      trigger(el, 'input');
    }
  });
}

/*
指令定义函数提供了几个钩子函数 (可选)：

bind：只调用一次，指令第一次绑定到元素时调用，用这个钩子函数可以定义一个在绑定时执行一次的初始化动作。
inserted：被绑定元素插入父节点时调用 (父节点存在即可调用，不必存在于 document 中)。
update：所在组件的 VNode 更新时调用，但是可能发生在其孩子的 VNode 更新之前。指令的值可能发生了改变也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新 (详细的钩子函数参数见下)。
componentUpdated：所在组件的 VNode 及其孩子的 VNode 全部更新时调用。
unbind：只调用一次，指令与元素解绑时调用。
*/
// 这里其实就是定义 model 指令
var model$1 = {
  // 被绑定元素插入父节点时调用
  inserted: function inserted (el, binding, vnode) {
    // <select> 标签
    if (vnode.tag === 'select') {
      var cb = function () {
        // 设置下拉列表选项
        setSelected(el, binding, vnode.context);
      };
      cb();
      // 为什么要再执行一遍呢？
      if (isIE || isEdge) {
        setTimeout(cb, 0);
      }
    // <textarea> 标签或者 <input> 标签，并且 type 为 text,number,password,search,email,tel,url 之一
    } else if (vnode.tag === 'textarea' || isTextInputType(el.type)) {
      // binding.modifiers ：一个包含修饰符的对象。例如：v-my-directive.foo.bar, 修饰符对象 modifiers 的值是 { foo: true, bar: true }
      el._vModifiers = binding.modifiers;
      // 触发 input 事件
      if (!binding.modifiers.lazy) {
        // Safari < 10.2 & UIWebView doesn't fire compositionend when
        // switching focus before confirming composition choice
        // this also fixes the issue where some browsers e.g. iOS Chrome
        // fires "change" instead of "input" on autocomplete.

        // onCompositionEnd 函数会触发 input 事件
        el.addEventListener('change', onCompositionEnd);
        // 非 Android
        if (!isAndroid) {
          // compositionstart 事件触发于一段文字的输入之前
          el.addEventListener('compositionstart', onCompositionStart);
          // 当文本段落的组成完成或取消时, compositionend 事件将被激发。onCompositionEnd 函数会触发 input 事件
          el.addEventListener('compositionend', onCompositionEnd);
        }
        /* istanbul ignore if */
        if (isIE9) {
          el.vmodel = true;
        }
      }
    }
  },
  // 所在组件的 VNode 及其孩子的 VNode 全部更新时调用
  componentUpdated: function componentUpdated (el, binding, vnode) {
    // <select> 标签
    if (vnode.tag === 'select') {
      // 设置下拉列表选项
      setSelected(el, binding, vnode.context);
      // in case the options rendered by v-for have changed,
      // it's possible that the value is out-of-sync with the rendered options.
      // detect such cases and filter out values that no longer has a matching
      // option in the DOM.

      /*
         ① select 为多选列表：
            binding.value 为数组，只要这个数组中有一个没有匹配的 option，那就需要重置了
         ② select 为单选列表：
            a. 新值不等于旧值
            b. 新值没有匹配的 option

            只有 a 和 b 两个条件同时满足时就需要重置了。

            1. 假设只有 a 满足，新值虽然不等于旧值，而新值和 option 匹配上了，这就是“歪打正着”吧，不需要重置。
            2. 假设只有 b 满足，虽然没有和新值匹配的 option，但是旧值也不匹配啊，所以就维持一个都没选中的状态好了，不需要重置。
      */
      var needReset = el.multiple
        ? binding.value.some(function (v) { return hasNoMatchingOption(v, el.options); })
        : binding.value !== binding.oldValue && hasNoMatchingOption(binding.value, el.options);
      
      // 需要重置，触发 change 事件
      if (needReset) {
        trigger(el, 'change');
      }
    }
  }
};

// 设置下拉列表选项
function setSelected (el, binding, vm) {
  // binding.value ：指令的绑定值，例如：v-my-directive="1 + 1", value 的值是 2
  var value = binding.value;
  // 是否是多选下拉
  var isMultiple = el.multiple;
  if (isMultiple && !Array.isArray(value)) {
    // 多选下拉的值应该是一个数组
    "development" !== 'production' && warn(
      // binding.expression ：绑定值的字符串形式。例如 v-my-directive="1 + 1" ，expression 的值是 "1 + 1"
      "<select multiple v-model=\"" + (binding.expression) + "\"> " +
      "expects an Array value for its binding, but got " + (Object.prototype.toString.call(value).slice(8, -1)),
      vm
    );
    return
  }
  var selected, option;
  for (var i = 0, l = el.options.length; i < l; i++) {
    option = el.options[i];
    // 多选列表
    if (isMultiple) {
      // 这里 value 是一个数组，getValue(option) 是 option 的值。也就是说，若 option 的值在数组 value 中，selected 就为 true
      selected = looseIndexOf(value, getValue(option)) > -1;
      // 如果和旧值不相等，就更新值
      if (option.selected !== selected) {
        option.selected = selected;
      }
    // 单选列表
    } else {
      // 匹配到了第一个选项，并且和之前的不一样，就更新，并结束循环
      if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) {
          el.selectedIndex = i;
        }
        return
      }
    }
  }
  // 单选列表，一个都没匹配到，那就将 selectedIndex 强制写为 -1
  if (!isMultiple) {
    el.selectedIndex = -1;
  }
}

// select 的 option 中没有与 value 对应的匹配项
function hasNoMatchingOption (value, options) {
  for (var i = 0, l = options.length; i < l; i++) {
    // 只要有一个匹配上了，就返回 false
    if (looseEqual(getValue(options[i]), value)) {
      return false
    }
  }
  return true
}

// 获取 option 的值
function getValue (option) {
  return '_value' in option
    ? option._value
    : option.value
}

// 标记 e.target.composing 为 true
function onCompositionStart (e) {
  e.target.composing = true;
}

// 标记 e.target.composing 为 false，并触发 input 事件。所以，我们看到，凡是调用 onCompositionEnd 函数都会触发 input 事件
function onCompositionEnd (e) {
  // prevent triggering an input event for no reason
  if (!e.target.composing) { return }
  e.target.composing = false;
  trigger(e.target, 'input');
}

// 老式写法，自定义事件
function trigger (el, type) {
  // 新建 HTMLEvents 实例
  var e = document.createEvent('HTMLEvents');
  // 事件初始化，type 为事件名称
  e.initEvent(type, true, true);
  // 触发事件
  el.dispatchEvent(e);
}

/*  */

// recursively search for possible transition defined inside the component root
// 从当前 vnode 递归查找组件根节点里定义 transition 的 vnode。找到了就返回那个 vnode
function locateNode (vnode) {
  return vnode.componentInstance && (!vnode.data || !vnode.data.transition)
      // 递归
    ? locateNode(vnode.componentInstance._vnode)
    : vnode
}

// v-show 指令
var show = {
  // bind：只调用一次，指令第一次绑定到元素时调用，用这个钩子函数可以定义一个在绑定时执行一次的初始化动作。
  bind: function bind (el, ref, vnode) {
    // value：指令的绑定值，例如：v-my-directive="1 + 1", value 的值是 2
    var value = ref.value;

    // 找到定义了 transition 的 vnode
    vnode = locateNode(vnode);

    var transition$$1 = vnode.data && vnode.data.transition;

    /*
        ① el.style.display === 'none'，originalDisplay 为 ''，也就是默认值
        ② el.style.display !== 'none'，originalDisplay 为 el.style.display
    */
    var originalDisplay = el.__vOriginalDisplay = el.style.display === 'none' ? '' : el.style.display;

    // 过渡
    if (value && transition$$1 && !isIE9) {
      vnode.data.show = true;
      // 动画/过渡进入
      enter(vnode, function () {
        el.style.display = originalDisplay;
      });
    // 直接显示/隐藏
    } else {
      el.style.display = value ? originalDisplay : 'none';
    }
  },

  // 所在组件的 VNode 更新时调用，但是可能发生在其孩子的 VNode 更新之前。指令的值可能发生了改变也可能没有。但是你可以通过比较更新前后的值来忽略不必要的模板更新
  update: function update (el, ref, vnode) {
    var value = ref.value;
    // oldVnode：上一个虚拟节点，仅在 update 和 componentUpdated 钩子中可用
    var oldValue = ref.oldValue;

    // 新旧虚拟节点相同，那就不更新了，在此返回
    if (value === oldValue) { 
        return 
    }

    // 找到定义了 transition 的 vnode
    vnode = locateNode(vnode);
    var transition$$1 = vnode.data && vnode.data.transition;
    // 过渡
    if (transition$$1 && !isIE9) {
      vnode.data.show = true;
      if (value) {
        // 进入过渡
        enter(vnode, function () {
          el.style.display = el.__vOriginalDisplay;
        });
      } else {
        // 离开过渡
        leave(vnode, function () {
          el.style.display = 'none';
        });
      }
    // 直接显示/隐藏
    } else {
      el.style.display = value ? el.__vOriginalDisplay : 'none';
    }
  },

  // unbind：只调用一次，指令与元素解绑时调用。
  unbind: function unbind (el, binding, vnode, oldVnode, isDestroy) {
    // 恢复之前的 display 属性
    if (!isDestroy) {
      el.style.display = el.__vOriginalDisplay;
    }
  }
};

// 系统给我们定义好的指令
var platformDirectives = {
  model: model$1,
  show: show
};

/*  */

// Provides transition support for a single element/component.
// supports transition mode (out-in / in-out)

// 过渡相关的 prop
var transitionProps = {
  name: String,
  appear: Boolean,
  css: Boolean,
  mode: String,     // out-in / in-out
  type: String,
 
  // 进入相关 class 
  enterClass: String,
  leaveClass: String,
  enterToClass: String,

  // 离开相关 class
  leaveToClass: String,
  enterActiveClass: String,
  leaveActiveClass: String,

  // 出现相关 class
  appearClass: String,
  appearActiveClass: String,
  appearToClass: String,
 
  // 持续时间
  duration: [Number, String, Object]
};

// in case the child is also an abstract component, e.g. <keep-alive>
// we want to recursively retrieve the real component to be rendered
// 我们需要递归地检索出真正需要被重新渲染的组件，以免子组件也是一个抽象组件（例如 <keep-alive>）。返回需要被重新渲染的 vnode
function getRealChild (vnode) {
  var compOptions = vnode && vnode.componentOptions;
  // 如果子组件也是抽象组件，那就递归检索
  if (compOptions && compOptions.Ctor.options.abstract) {
    // getFirstComponentChild() 用来获取第一个子组件
    return getRealChild(getFirstComponentChild(compOptions.children))
  } else {
    return vnode
  }
}

// 提取 transition 数据，返回一个 json 对象
function extractTransitionData (comp) {
  var data = {};
  var options = comp.$options;
  // 提取 props
  for (var key in options.propsData) {
    data[key] = comp[key];
  }
  // events.
  // extract listeners and pass them directly to the transition methods
  // 提取监听函数
  var listeners = options._parentListeners;
  for (var key$1 in listeners) {
    data[camelize(key$1)] = listeners[key$1];
  }
  return data
}

// 占位符
function placeholder (h, rawChild) {
  if (/\d-keep-alive$/.test(rawChild.tag)) {
    return h('keep-alive', {
      props: rawChild.componentOptions.propsData
    })
  }
}

// 只要有一个父组件有 transition 数据，就返回 true
function hasParentTransition (vnode) {
  while ((vnode = vnode.parent)) {
    if (vnode.data.transition) {
      return true
    }
  }
}

// 新旧节点的 key 和 tag 都相同，就认为是同一个子节点
function isSameChild (child, oldChild) {
  return oldChild.key === child.key && oldChild.tag === child.tag
}

// 同时拥有 isComment、asyncFactory 等两个属性就认为是异步占位符
function isAsyncPlaceholder (node) {
  return node.isComment && node.asyncFactory
}

// 定义 Transition 组件
var Transition = {
  name: 'transition',
  props: transitionProps,
  // 抽象组件
  abstract: true,

  render: function render (h) {
    var this$1 = this;

    // 如果没有子元素，就返回
    var children = this.$options._renderChildren;
    if (!children) {
      return
    }

    // filter out text nodes (possible whitespaces)
    // 剔除文本子元素（可能是空白）
    children = children.filter(function (c) { 
        return c.tag || isAsyncPlaceholder(c); 
    });
    
    // 如果剔除文本子元素后不剩下子元素了，那就返回
    if (!children.length) {
      return
    }

    // warn multiple elements
    // <transition> 只能用于单一的元素，<transition-group> 可以用于列表
    if ("development" !== 'production' && children.length > 1) {
      warn(
        '<transition> can only be used on a single element. Use ' +
        '<transition-group> for lists.',
        this.$parent
      );
    }

    /*
        in-out：新元素先进行过渡，完成之后当前元素过渡离开。
        out-in：当前元素先进行过渡，完成之后新元素过渡进入。
    */
    var mode = this.mode;

    // warn invalid mode
    // mode 必须是 in-out/out-in 二者之一
    if ("development" !== 'production' && mode && mode !== 'in-out' && mode !== 'out-in') {
      warn(
        'invalid <transition> mode: ' + mode,
        this.$parent
      );
    }

    // 原元素
    var rawChild = children[0];

    // if this is a component root node and the component's
    // parent container node also has transition, skip.
    // 如果父容器节点也有 transition，那就返回
    if (hasParentTransition(this.$vnode)) {
      return rawChild
    }

    // apply transition data to child
    // use getRealChild() to ignore abstract components e.g. keep-alive
    // getRealChild() 方法会忽略抽象组件，找到真正需要被渲染的组件
    var child = getRealChild(rawChild);

    // 如果除了抽象组件不剩下什么，那就返回
    if (!child) {
      return rawChild
    }

    // 正在离开...占位？
    if (this._leaving) {
      return placeholder(h, rawChild)
    }

    // ensure a key that is unique to the vnode type and to this transition
    // component instance. This key will be used to remove pending leaving nodes
    // during entering.
    
    // 确保 key 对于某种 vnode 类型或者对于组件实例是唯一的。在 entering 过程中这个 key 会被用来移除 pending leaving 节点

    var id = "__transition-" + (this._uid) + "-";
    /*
        ① child.key == null
           a. child.isComment == true
              child.key = "__transition-" + (this._uid) + "-comment"
           b. child.isComment != true
              child.key = "__transition-" + (this._uid) + child.tag

        ② child.key != null
           a. child.key 是数值或字符串
              child.key = "__transition-" + (this._uid) + child.key
           b. child.key 是其他值
              child.key = child.key
    */
    child.key = child.key == null
      ? child.isComment
        ? id + 'comment'
        : id + child.tag
      : isPrimitive(child.key)
        ? (String(child.key).indexOf(id) === 0 ? child.key : id + child.key)
        : child.key;
    

    /*
        extractTransitionData() 方法用于提取 props 和 listeners，返回一个 json 对象

        把这个 json 对象赋值给 child.data.transition
    */
    var data = (child.data || (child.data = {})).transition = extractTransitionData(this);

    // 旧的原元素
    var oldRawChild = this._vnode;
    // getRealChild() 方法会忽略抽象组件，找到真正需要被渲染的组件
    var oldChild = getRealChild(oldRawChild);

    // mark v-show
    // so that the transition module can hand over the control to the directive
    // 只要有一个指令的名称为 'show'，那就把 child.data.show 标记为 true
    if (child.data.directives && child.data.directives.some(function (d) { return d.name === 'show'; })) {
      child.data.show = true;
    }

    // 新旧节点不相同，并且旧节点不是异步占位符
    if (oldChild && oldChild.data && !isSameChild(child, oldChild) && !isAsyncPlaceholder(oldChild)) {
      // replace old child transition data with fresh one
      // important for dynamic transitions!
      // 用 child.data.transition 的属性覆盖 oldChild.data.transition 的属性
      var oldData = oldChild && (oldChild.data.transition = extend({}, data));

      // handle transition mode，当前元素先进行过渡，完成之后新元素过渡进入
      if (mode === 'out-in') {
        // return placeholder node and queue update when leave finishes
        this._leaving = true;
        // mergeVNodeHook (def, hookKey, hook) 将钩子方法 hook 加入到 def[hookKey] 中，也就是添加一个钩子方法，以后执行 def[hookKey] 也就会执行 hook 方法了
        mergeVNodeHook(oldData, 'afterLeave', function () {
          // render 函数最开始有定义：var this$1 = this
          this$1._leaving = false;
          this$1.$forceUpdate();
        });
        // 用 rawChild.componentOptions.propsData 数据渲染一个 <keep-alive> ?
        return placeholder(h, rawChild)
      // 新元素先进行过渡，完成之后当前元素过渡离开
      } else if (mode === 'in-out') {
        if (isAsyncPlaceholder(child)) {
          return oldRawChild
        }
        var delayedLeave;
        var performLeave = function () { delayedLeave(); };
        // child.data.transition['afterEnter'] 发生时，会调用 performLeave 函数
        mergeVNodeHook(data, 'afterEnter', performLeave);
        // child.data.transition['enterCancelled'] 发生时，会调用 performLeave 函数
        mergeVNodeHook(data, 'enterCancelled', performLeave);
        // child.data.transition['delayLeave'] 发生时，会调用 function (leave) { delayedLeave = leave; } 函数
        mergeVNodeHook(oldData, 'delayLeave', function (leave) { delayedLeave = leave; });
      }
    }

    return rawChild
  }
};

/*  */

// Provides transition support for list items.
// supports move transitions using the FLIP technique.
/*
   FLIP 代表 First、Last、Invert、Play

   F: first，参加过渡元素的初始状态。
   L: last，元素的终止状态。
   I: invert，这是 flip 的核心。你通过这个元素的初始状态和终止状态计算出元素改变了什么，比如它的宽、高及透明度，然后你翻转这个改变；举个例子，如果一个元素的初始状态和终止状态之间偏移 90px，你应该设置这个元素 transform: translateY(-90px)。这个元素好像是在它的初始位置，其实正好相反。
   P: play，为你要改变的任何 css 属性启用 tansition，移除你 invert 的改变。这时你的元素会做动画从起始点到终止点。

   FLIP 来实现动画，是对 JavaScript 和 CSS 的很好结合。用 JavaScript 计算，但让 CSS 为你处理动画。
   你不必使用 CSS 去完成动画，不过，你可以用 animations  API 或 JavaScript 自身来完成，觉得哪种容易就用哪种。
   关键要减少每帧动画的复杂性（推荐使用 transform 和 opacity），尽力让用户得到最好的体验。 
   
   其中：
   ① transform 指的是变换，一个东西的拉伸，压缩，旋转，偏移等就是使用这个属性。
      
      transform 可以设置这些函数：

      rotate：将元素进行 2D 旋转，单位为 deg。如 transform:rotate(7deg);
      rotateX(angle)：定义沿着 X 轴的 3D 旋转。如 transform:rotateX(10deg);
      rotateY(angle)：定义沿着 Y 轴的 3D 旋转。如 transform:rotateY(10deg);

      translate：将元素进行平移（X，Y 轴同时平移）。如 transform:translate(10px,20px);
      translateX(x)：X 轴平移。如 transform:translateX(10px); 
      translateY(y)：Y 轴平移。如 transform:translateY(10px);

      scale：将元素进行放大或缩小（X，Y 轴同时缩放）。记住，这里的放大和缩小不一定是维持比例的。如 transform:scale(1.1,1.1);
      scaleX(x)：通过设置 X 轴的值来定义缩放转换。如 transform:scaleX(1.1);
      scaleY(y)：通过设置 Y 轴的值来定义缩放转换。如 transform:scaleY(1.1);

      skew(x-angle,y-angle)    定义沿着 X 和 Y 轴的 2D 倾斜转换。如 transform:skew(10deg,10deg);
      skewX(angle)：定义沿着 X 轴的 2D 倾斜转换。如 transform:skewX(10deg);
      skewY(angle)：定义沿着 Y 轴的 2D 倾斜转换。如 transform:skewY(10deg);
        
   ② opacity 指透明度，可以利用这个属性来实现元素的隐藏与显现。

    另外，不要把 transform 和 transition 属性弄混淆了。
    
    应用于宽度属性的过渡效果，时长为 2 秒
    div {
        transition: width 2s; 
    }

    如需向多个样式添加过渡效果，请添加多个属性，由逗号隔开：
    div {
        transition: width 2s, height 2s, transform 2s;
    }

    举个利用 FLIP 的实例：
    参考：
    https://segmentfault.com/a/1190000008907850
    http://web.jobbole.com/83598/

    <div id="app"></div>
    <style>
      #app{
        position: absolute;
        width:20px;
        height:20px;
        background: red;
      }
      .app-to-end{
        top: 100px;
      }
      .animate-on-transforms{
        transition: all 5s;
      }
    </style>
    <script>
        var app = document.getElementById('app');

        var first = app.getBoundingClientRect();
        // 从 0px 处突变到 100px 处
        app.classList.add('app-to-end');

        var last = app.getBoundingClientRect();

        var invert = first.top - last.top;

        // 从终点（100px）突变到起点（0px 处），使元素看起来好像在起点
        app.style.transform = `translateY(${invert}px)`;

        requestAnimationFrame(function() {
          // 启用 tansition 属性（设置属性的变化时长，曲线等）
          app.classList.add('animate-on-transforms');
          // 从 0px 处突变到 100px 处，但由于有了 tansition 限制属性变化时长，所以会连续缓慢变化
          app.style.transform = '';
        });

        // 动画结束，移除 tansition 属性。其实，不移除也不会影响动画执行。
        app.addEventListener('transitionend', () => {
          app.classList.remove('animate-on-transforms');
        })
    </script>

    可以看到，FLIP 的思路是：
    将动画翻转过来，而不是直接过渡（因为这需要对每帧进行昂贵的计算）。通过动态预计算动画，可以让它更轻松地完成。

    使用flip的好处：
    参考图：https://sfault-image.b0.upaiyun.com/222/397/2223977382-58de14ea163ac_articlex

    在用户与网站交互后有 100ms 的空闲时间，如果我们利用这 100ms 做预计算操作，
    然后使用 css3 的 transform 和 opacity 执行动画，用户会觉得你的网站响应非常快。
*/

// Because the vdom's children update algorithm is "unstable" - i.e.
// it doesn't guarantee the relative positioning of removed elements,
// we force transition-group to update its children into two passes:
// in the first pass, we remove all nodes that need to be removed,
// triggering their leaving transition; in the second pass, we insert/move
// into the final desired state. This way in the second pass removed
// nodes will remain where they should be.

/*
   虚拟 dom 的子元素更新算法是不稳定的，也就是说它不能保证被删除元素的相对顺序。
   这里将 transition-group 更新子元素的过程分成两步：
   ① 移除所有需要移除的元素，并触发它们的离开 transition；
   ② 依次节点添加/删除元素，使得它们出现在正确的位置。
   这样下来，被删除的元素就能出现在正确的位置上。
*/

// TransitionGroup 组件的 props 基本继承自 transitionProps
var props = extend({
  tag: String,
  moveClass: String
}, transitionProps);

// transitionProps 不要过渡模式
delete props.mode;

// 定义 transitionProps 组件
var TransitionGroup = {
  props: props,

  // 渲染组件
  render: function render (h) {
    // 默认的标签是 <span>
    var tag = this.tag || this.$vnode.data.tag || 'span';
    var map = Object.create(null);
    var prevChildren = this.prevChildren = this.children;
    var rawChildren = this.$slots.default || [];
    var children = this.children = [];
    // extractTransitionData() 方法用于提取 props 和 listeners，返回一个 json 对象
    var transitionData = extractTransitionData(this);

    // 遍历所有子元素，删除元素，并触发它们的离开 transition ？
    for (var i = 0; i < rawChildren.length; i++) {
      var c = rawChildren[i];
      if (c.tag) {
        // c.key 存在并且不是以 __vlist 开头
        if (c.key != null && String(c.key).indexOf('__vlist') !== 0) {
          // 修改 children 就是修改 this.children，也就是修改 this.prevChildren（prevChildren）
          children.push(c);
          map[c.key] = c;
          // c.data.transition = transitionData
          (c.data || (c.data = {})).transition = transitionData;
        // 报错：<transition-group> 的子元素必须有 key 属性
        } else {
          var opts = c.componentOptions;
          var name = opts ? (opts.Ctor.options.name || opts.tag || '') : c.tag;
          warn(("<transition-group> children must be keyed: <" + name + ">"));
        }
      }
    }

    if (prevChildren) {
      var kept = [];
      var removed = [];
      for (var i$1 = 0; i$1 < prevChildren.length; i$1++) {
        var c$1 = prevChildren[i$1];
        c$1.data.transition = transitionData;
        /*
            getBoundingClientRect 方法返回元素的大小及其相对于视口的位置

            eg:
            div = $('div')[0];
            div.getBoundingClientRect()
            -> { top: 287.625, right: 308, bottom: 387.625, left: 8 ,height: 100, width: 300 }
        */
        c$1.data.pos = c$1.elm.getBoundingClientRect();
        // 有 key 的保留
        if (map[c$1.key]) {
          kept.push(c$1);
        // 没 key 的删除
        } else {
          removed.push(c$1);
        }
      }
      // 创建保留的节点
      this.kept = h(tag, null, kept);
      this.removed = removed;
    }
    
    // 返回创建的元素
    return h(tag, null, children)
  },

  // 调用 patch 函数
  beforeUpdate: function beforeUpdate () {
    // force removing pass
    // Vue$3.prototype.__patch__ = inBrowser ? patch : noop，补丁函数更新
    this.__patch__(
      this._vnode,
      this.kept,
      false, // hydrating
      true // removeOnly (!important, avoids unnecessary moves)
    );
    // 更新 this._vnode
    this._vnode = this.kept;
  },

  // 更新
  updated: function updated () {
    var children = this.prevChildren;
    var moveClass = this.moveClass || ((this.name || 'v') + '-move');
    
    // 不存在子组件或不支持 move 效果？
    if (!children.length || !this.hasMove(children[0].elm, moveClass)) {
      return
    }

    // we divide the work into three loops to avoid mixing DOM reads and writes
    // in each iteration - which helps prevent layout thrashing.
    // 每个 child 依次执行 _moveCb()、_enterCb()
    children.forEach(callPendingCbs);
    // 记录每个 child 的终点位置
    children.forEach(recordPosition);
    // 对每个 child 依次水平/竖直偏移（由 transform:translate(x px,y px) 来实现）
    children.forEach(applyTranslation);

    // force reflow to put everything in position
    var body = document.body;
    /*
    clientHeight：内容高度 + padding 高度
    offsetHeight：内容高度 + padding 高度 + 边框宽度 
    */
    var f = body.offsetHeight; // eslint-disable-line

    children.forEach(function (c) {
      // 当前 c 执行过 applyTranslation 方法，c.data.moved 就为 true，表示偏移过
      if (c.data.moved) {
        var el = c.elm;
        var s = el.style;
        // 添加 moveClass 这个过渡 class
        addTransitionClass(el, moveClass);
        // transform 重置为默认值，会触发过渡，以使得元素移回到默认位置？
        s.transform = s.WebkitTransform = s.transitionDuration = '';
        
        // transitionEndEvent = 'transitionend'，监听 transitionend 事件（过渡结束事件）
        el.addEventListener(transitionEndEvent, el._moveCb = function cb (e) {
          // 删除 class，解除绑定
          if (!e || /transform$/.test(e.propertyName)) {
            el.removeEventListener(transitionEndEvent, cb);
            el._moveCb = null;
            removeTransitionClass(el, moveClass);
          }
        });
      }
    });
  },

  methods: {
    // 返回一个布尔值，表示是否有 move 效果？
    hasMove: function hasMove (el, moveClass) {
      // hasTransition = inBrowser && !isIE9，如果当前环境不支持 transition，直接返回 false
      if (!hasTransition) {
        return false
      }
      /* istanbul ignore if */
      if (this._hasMove) {
        return this._hasMove
      }
      // Detect whether an element with the move class applied has
      // CSS transitions. Since the element may be inside an entering
      // transition at this very moment, we make a clone of it and remove
      // all other transition classes applied to ensure only the move class
      // is applied.
      /*
        检测应用 move class 的元素是否拥有 css transitions.

        由于这个元素此刻可能在某个 entering transition 内部，所以这里就把它克隆一份，
        并且移除所有其他的 transition classes，以确保只有 move class 在应用
      */

      // 克隆 el 元素
      var clone = el.cloneNode();
      // 移除所有 transition classes
      if (el._transitionClasses) {
        el._transitionClasses.forEach(function (cls) { removeClass(clone, cls); });
      }
      // 添加 moveClass
      addClass(clone, moveClass);
      clone.style.display = 'none';
    
      
      this.$el.appendChild(clone);
      /*
        getTransitionInfo(clone) 返回：
        {
            type: type,
            timeout: timeout,
            propCount: propCount,
            hasTransform: hasTransform
        }
      */
      var info = getTransitionInfo(clone);
      this.$el.removeChild(clone);

      return (this._hasMove = info.hasTransform)
    }
  }
};

// 执行回调
function callPendingCbs (c) {
  // 执行 c.elm._moveCb()
  if (c.elm._moveCb) {
    c.elm._moveCb();
  }
  // 执行 c.elm._enterCb()
  if (c.elm._enterCb) {
    c.elm._enterCb();
  }
}

/*
    getBoundingClientRect 方法返回元素的大小及其相对于视口的位置

    eg:
    div = $('div')[0];
    div.getBoundingClientRect()
    -> { top: 287.625, right: 308, bottom: 387.625, left: 8 ,height: 100, width: 300 }
*/
// 记录位置
function recordPosition (c) {
  c.data.newPos = c.elm.getBoundingClientRect();
}

// 执行水平/竖直偏移运动
function applyTranslation (c) {
  var oldPos = c.data.pos;
  var newPos = c.data.newPos;
  // 水平偏移
  var dx = oldPos.left - newPos.left;
  // 竖直偏移
  var dy = oldPos.top - newPos.top;
  if (dx || dy) {
    // 标志偏移过
    c.data.moved = true;
    var s = c.elm.style;
    // 设置 transform 属性，执行偏移
    s.transform = s.WebkitTransform = "translate(" + dx + "px," + dy + "px)";
    s.transitionDuration = '0s';
  }
}

// Transition 和 TransitionGroup 组件
var platformComponents = {
  Transition: Transition,
  TransitionGroup: TransitionGroup
};

/*  */

// install platform specific utils
// 全局的 config 对象定义了以下方法（空函数，没具体作用），后来又定义了 Vue$3.config = config，所以这里相当于覆盖原来全局 config 对象定义的默认方法
Vue$3.config.mustUseProp = mustUseProp;
Vue$3.config.isReservedTag = isReservedTag;
Vue$3.config.isReservedAttr = isReservedAttr;
Vue$3.config.getTagNamespace = getTagNamespace;
Vue$3.config.isUnknownElement = isUnknownElement;

// install platform runtime directives & components
/*
  var platformDirectives = {
    model: model$1,
    show: show
  };
  把 model、show 等指令添到 Vue$3.options.directives 中
 */
extend(Vue$3.options.directives, platformDirectives);
/*
  var platformComponents = {
    Transition: Transition,
    TransitionGroup: TransitionGroup
  };
  把 Transition、TransitionGroup 等组件添加到 Vue$3.options.components 中
 */
extend(Vue$3.options.components, platformComponents);

// install platform patch function
// 把 pacth 方法挂载在 Vue 原型上，这样 Vue 的实例可以调用 patch 方法了。
// patch = createPatchFunction({ nodeOps: nodeOps, modules: modules })
Vue$3.prototype.__patch__ = inBrowser ? patch : noop;

// public mount method，公开的 mount 方法
Vue$3.prototype.$mount = function (el,hydrating) {
  // query(el) 根据 el 选择器，返回对应元素，如果找不到，就新创建一个 div 返回
  el = el && inBrowser ? query(el) : undefined;
  // 安装组件
  return mountComponent(this, el, hydrating)
};

// devtools global hook
/* istanbul ignore next */
// 控制台提示，setTimeout(f,0) 可以让后面的同步代码先执行，然后再执行 f 函数
setTimeout(function () {
  if (config.devtools) {
    // 如果安装了 Devtools，初始化
    if (devtools) {
      devtools.emit('init', Vue$3);
    // 否则就调用 Chrome 的 console.log 方法提示用户安装 Devtools
    } else if ("development" !== 'production' && isChrome) {
      // 优先用 console.log 方法，如果不存在，那就用 console.log 方法吧
      console[console.info ? 'info' : 'log'](
        'Download the Vue Devtools extension for a better development experience:\n' +
        'https://github.com/vuejs/vue-devtools'
      );
    }
  }
  // 开发模式下提示：你正在开发模式下使用 Vue，别忘了在生产环境下使用生产模式
  if ("development" !== 'production' && config.productionTip !== false && inBrowser && typeof console !== 'undefined') {
    console[console.info ? 'info' : 'log'](
      "You are running Vue in development mode.\n" +
      "Make sure to turn on production mode when deploying for production.\n" +
      "See more tips at https://vuejs.org/guide/deployment.html"
    );
  }
}, 0);

/* 
<div title="abc&#10;def">test</div>
其中 "&#10;" 是换行符的 HTML 转义字符。

转义字符有3个组成部分：
（1）&
（2）实体名称，或“#实体编号”
（3）;

例如 
空格 &nbsp; 或 &#160; 
换行 &#10;

（其中 160，10 指的是 ASCII码值（十进制））

使用实体名称表示转义字符，比实体编号更容易记忆。但是，并不是所有浏览器都支持最新的实体名称，而几乎所有的浏览器对实体编号的支持都很好。

*/

// check whether current browser encodes a char inside attribute values
// 判断一个字符是否会转码，例如，属性中有换行符是，ie 会将这个换行符转成转义字符
function shouldDecode (content, encoded) {
  var div = document.createElement('div');
  window.d = div;
  div.innerHTML = "<div a=\"" + content + "\"/>";
  return div.innerHTML.indexOf(encoded) > 0
}

// #3663
// IE encodes newlines inside attribute values while other browsers don't
// 如果属性值中有换行符，ie 会将换行符替换为转义字符，其他浏览器不会
var shouldDecodeNewlines = inBrowser ? shouldDecode('\n', '&#10;') : false;

/*
  /\{\{((?:.|\n)+?)\}\}/g
  其中 . 表示任意字符，除了换行符，\n 表示换行符，合一起就表示任意字符了

  所以，这个正则的匹配的是 {{ 任意字符 1 次或多次 }}
 */
var defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g;
// 匹配以下字符之一 - . * + ? ^ $ { } ( ) [ ] / \
var regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g;

// 创建正则表达式
var buildRegex = cached(function (delimiters) {
  /*
    对于 stringObject.replace(regexp|substr,replacement)，replacement 中的 $ 有特殊含义：

    $$ // 插入一个 "$"
    $& // 插入与 regexp 匹配的子串
    $` // 插入当前匹配的子串左边的内容
    $' // 插入当前匹配的子串右边的内容
    $1、$2、...、$99 // 与 regexp 中的第 1 到第 99 个子表达式相匹配的文本

    所以 '\\$&' 表示在原字符串开头加上 \，例如：
    "Enjoy javascript".replace(re, "\\$&")
    -> "\Enjoy javascript"

    所以这个方法的作用是将 - . * + ? ^ $ { } ( ) [ ] / \ 等字符前加一个 \，然后拼接锦字符串，再生成正则表达式

    例如 buildRegex(['{{','}}']) -> /\{\{((?:.|\n)+?)\}\}/g
   */
  var open = delimiters[0].replace(regexEscapeRE, '\\$&');
  var close = delimiters[1].replace(regexEscapeRE, '\\$&');
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
});

// 模板字符串转为浏览器可以解析的字符串。text 可分为 3 个部分，{{ 之前的，{{}} 中间包裹的，}} 之后的，函数分别将三者抽离出来，push 进 tokens，最后用 + 连接并返回一个字符串
function parseText (text, delimiters) {
  // 匹配文本的正则
  var tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE;
  // 匹配失败，就此返回
  if (!tagRE.test(text)) {
    return
  }
  var tokens = [];
  var lastIndex = tagRE.lastIndex = 0;
  var match, index;
  /*
    看一看：RegExpObject.exec(string)

    ① 正则 RegExpObject 不含 g 参数，也就是非全局的匹配

       如果 exec() 找到了匹配的文本，则返回一个结果数组。否则，返回 null。
       此数组的第 0 个元素是与正则表达式相匹配的文本，第 1 个元素是与 RegExpObject 的第 1 个子表达式相匹配的文本（如果有的话），
       第 2 个元素是与 RegExpObject 的第 2 个子表达式相匹配的文本（如果有的话），以此类推。
       除了数组元素和 length 属性之外，exec() 方法还返回两个属性。index 属性声明的是匹配文本的第一个字符的位置。
       input 属性则存放的是被检索的字符串 string。

       我们可以看得出，在调用非全局的 RegExp 对象的 exec() 方法时，返回的数组与调用方法 String.match() 返回的数组是相同的。

    ② 正则 RegExpObject 含有 g 参数，也就是全局匹配
       
       它会在 RegExpObject 的 lastIndex 属性指定的字符处开始检索字符串 string。
       当 exec() 找到了与表达式相匹配的文本时，在匹配后，它将把 RegExpObject 的 lastIndex 属性设置为匹配文本的最后一个字符的下一个位置。
       这就是说，您可以通过反复调用 exec() 方法来遍历字符串中的所有匹配文本。
       当 exec() 再也找不到匹配的文本时，它将返回 null，并把 lastIndex 属性重置为 0。
   */
  while ((match = tagRE.exec(text))) {
    index = match.index;
    // push text token
    // text 中未被 tagRE 匹配的部分，例如 '{{ message1 }}abc{{ message2 }}efg' 中的 'abc'
    if (index > lastIndex) {
      tokens.push(JSON.stringify(text.slice(lastIndex, index)));
    }
    // tag token
    /*
        例如：
        parseFilters("message | filterA | filterB")
        -> "_f("filterB")(_f("filterA")(message))"
     */
    var exp = parseFilters(match[1].trim());
    tokens.push(("_s(" + exp + ")"));
    // 移动游标
    lastIndex = index + match[0].length;
  }
  // text 中剩余部分，例如 '{{ message1 }}abc{{ message2 }}efg' 中的 'efg'
  if (lastIndex < text.length) {
    tokens.push(JSON.stringify(text.slice(lastIndex)));
  }
  // 最终用 '+' 连接数组元素，其实就是连接成一个字符串，例如 'abc' + '_s(message2)' + 'efg'
  return tokens.join('+')
}

// 转变节点，添加 el.staticClass 和 el.classBinding 属性
function transformNode (el, options) {
  // 警告函数
  var warn = options.warn || baseWarn;
  // 返回 el.attrsMap['class']，并从 el.attrsList 中删除 'class' 这一项
  var staticClass = getAndRemoveAttr(el, 'class');
  if ("development" !== 'production' && staticClass) {
    var expression = parseText(staticClass, options.delimiters);
    if (expression) {
      // <div class="{{ val }}"> 属性内的插值这种写法已经不支持了。推荐使用 <div :class="val">
      warn(
        "class=\"" + staticClass + "\": " +
        'Interpolation inside attributes has been removed. ' +
        'Use v-bind or the colon shorthand instead. For example, ' +
        'instead of <div class="{{ val }}">, use <div :class="val">.'
      );
    }
  }
  // 静态 class
  if (staticClass) {
    el.staticClass = JSON.stringify(staticClass);
  }
  // 动态 class，:class 或 v-bind:class 的值。getBindingAttr 的第三个参数设为 false 表示取不到动态属性就也不取静态的（默认情况下会取静态的）
  var classBinding = getBindingAttr(el, 'class', false /* getStatic */);
  if (classBinding) {
    el.classBinding = classBinding;
  }
}

// 返回一个字符串。这里的 el 指 ast
function genData (el) {
  var data = '';
  // 静态 class
  if (el.staticClass) {
    data += "staticClass:" + (el.staticClass) + ",";
  }
  // 动态绑定的 class
  if (el.classBinding) {
    data += "class:" + (el.classBinding) + ",";
  }
  return data
}

// class 相关方法
var klass$1 = {
  staticKeys: ['staticClass'],
  transformNode: transformNode,
  genData: genData
};

// 转变节点，添加 el.staticStyle 和 el.styleBinding 属性
function transformNode$1 (el, options) {
  // 警告方法
  var warn = options.warn || baseWarn;
  // 返回 el.attrsMap['style']，并从 el.attrsList 中删除 'style' 这一项
  var staticStyle = getAndRemoveAttr(el, 'style');
  if (staticStyle) {
    /* istanbul ignore if */
    {
      var expression = parseText(staticStyle, options.delimiters);
      if (expression) {
        // <div style="{{ val }}"> 属性内的插值这种写法已经不支持了。推荐使用 <div :style="val">
        warn(
          "style=\"" + staticStyle + "\": " +
          'Interpolation inside attributes has been removed. ' +
          'Use v-bind or the colon shorthand instead. For example, ' +
          'instead of <div style="{{ val }}">, use <div :style="val">.'
        );
      }
    }
    // 静态 style
    el.staticStyle = JSON.stringify(parseStyleText(staticStyle));
  }

  // 动态 style，:style 或 v-bind:style 的值
  var styleBinding = getBindingAttr(el, 'style', false /* getStatic */);
  // 动态 style
  if (styleBinding) {
    el.styleBinding = styleBinding;
  }
}

// 返回一个字符串
function genData$1 (el) {
  var data = '';
  // 静态 style
  if (el.staticStyle) {
    data += "staticStyle:" + (el.staticStyle) + ",";
  }
  // 动态绑定的 style
  if (el.styleBinding) {
    data += "style:(" + (el.styleBinding) + "),";
  }
  return data
}

// style 相关方法
var style$1 = {
  staticKeys: ['staticStyle'],
  transformNode: transformNode$1,
  genData: genData$1
};

// class 和 style 模块
var modules$1 = [
  klass$1,
  style$1
];

// el.textContent
function text (el, dir) {
  if (dir.value) {
    // 添加 el.textContent 属性
    addProp(el, 'textContent', ("_s(" + (dir.value) + ")"));
  }
}

// el.innerHTML
function html (el, dir) {
  if (dir.value) {
    // 添加 el.innerHTML 属性
    addProp(el, 'innerHTML', ("_s(" + (dir.value) + ")"));
  }
}

// 指令，对应 v-model,v-text,v-html
var directives$1 = {
  model: model,
  text: text,
  html: html
};

// 单标签（不需要闭合标签）
var isUnaryTag = makeMap(
  'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
  'link,meta,param,source,track,wbr'
);

// Elements that you can, intentionally, leave open
// (and which close themselves)
// 会自动闭合的标签
var canBeLeftOpenTag = makeMap(
  'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
);

// HTML5 tags https://html.spec.whatwg.org/multipage/indices.html#elements-3
// Phrasing Content https://html.spec.whatwg.org/multipage/dom.html#phrasing-content
// 段落元素
var isNonPhrasingTag = makeMap(
  'address,article,aside,base,blockquote,body,caption,col,colgroup,dd,' +
  'details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,' +
  'h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,' +
  'optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,' +
  'title,tr,track'
);


// 基本选项
var baseOptions = {
  expectHTML: true,
  // class、style 模块
  modules: modules$1,
  // model、text、html 指令
  directives: directives$1,
  // 是否为 pre 标签
  isPreTag: isPreTag,
  // 是否为单标签
  isUnaryTag: isUnaryTag,
  mustUseProp: mustUseProp,
  // 会自动闭合的标签
  canBeLeftOpenTag: canBeLeftOpenTag,
  isReservedTag: isReservedTag,
  getTagNamespace: getTagNamespace,
  /*
    将一组对象的 staticKeys 数组合并成一个字符串，举个例子：
    modules = [
      { staticKeys : ['mod11','mod12'] },
      { staticKeys : ['mod21','mod22'] },
      { staticKeys : ['mod31','mod32'] }
    ];
    genStaticKeys(modules)
    -> "mod11,mod12,mod21,mod22,mod31,mod32"
  */
  staticKeys: genStaticKeys(modules$1)
};

/*  */

var decoder;

var he = {
  // 将 html 赋值给一个 div 的 innerHTML，然后返回这个 div 的 textContent 属性
  decode: function decode (html) {
    decoder = decoder || document.createElement('div');
    decoder.innerHTML = html;
    return decoder.textContent
  }
};

/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

// Regular Expressions for parsing tags and attributes，解析 tag 和 attribute 的正则表达式

// 匹配不是以下字符 空白字符 " ' <> / = 1次或多次
var singleAttrIdentifier = /([^\s"'<>/=]+)/;
// 匹配 =
var singleAttrAssign = /(?:=)/;
var singleAttrValues = [
  // attr value double quotes，双引号
  /"([^"]*)"+/.source,
  // attr value, single quotes，单引号
  /'([^']*)'+/.source,
  // attr value, no quotes，没引号
  /([^\s"'=<>`]+)/.source
];
// 匹配属性的正则表达式，/^\s*([^\s"'<>\/=]+)(?:\s*((?:=))\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
var attribute = new RegExp(
  // 属性名
  '^\\s*' + singleAttrIdentifier.source +
  // 等于号
  '(?:\\s*(' + singleAttrAssign.source + ')' +
  // 属性值
  '\\s*(?:' + singleAttrValues.join('|') + '))?'
);

// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
// 字母或下划线后跟若干个 word/-/.
var ncname = '[a-zA-Z_][\\w\\-\\.]*';
var qnameCapture = '((?:' + ncname + '\\:)?' + ncname + ')';
// 开始标签开头
var startTagOpen = new RegExp('^<' + qnameCapture);
// 开始标签结尾
var startTagClose = /^\s*(\/?)>/;
// 结束标签
var endTag = new RegExp('^<\\/' + qnameCapture + '[^>]*>');
// 文档类型
var doctype = /^<!DOCTYPE [^>]+>/i;
// 注释
var comment = /^<!--/;
// 条件注释
var conditionalComment = /^<!\[/;

// 正则表达式捕获是否损坏，默认没有
var IS_REGEX_CAPTURING_BROKEN = false;

'x'.replace(/x(.)?/g, function (m, g) {
  // 例如在 Chrome 浏览器下，是不会捕获这个分组的，也就是说 g 为 undefined
  IS_REGEX_CAPTURING_BROKEN = g === '';
});

// Special Elements (can contain anything)
// 纯文本元素
var isPlainTextElement = makeMap('script,style,textarea', true);
var reCache = {};

// 解码的时候用到的映射表
var decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n'
};
// 匹配 < > " &
var encodedAttr = /&(?:lt|gt|quot|amp);/g;
// 匹配 < > " & \n
var encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10);/g;

// #5992
// pre、textarea 标签会忽略换行
var isIgnoreNewlineTag = makeMap('pre,textarea', true);

// pre、textarea 标签，并且 html 首字符是换行符，那就忽略这个换行
var shouldIgnoreFirstNewline = function (tag, html) { return tag && isIgnoreNewlineTag(tag) && html[0] === '\n'; };

// 字符实体解码，如 '&lt;' -> '<'
function decodeAttr (value, shouldDecodeNewlines) {
  var re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr;
  return value.replace(re, function (match) { return decodingMap[match]; })
}

/*
  例如：
  parseHTML(template, {
    warn: warn$2, // 报警函数
    expectHTML: options.expectHTML, // 是否为 html，布尔值
    isUnaryTag: options.isUnaryTag, // 是否为自闭合标签 'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr'
    canBeLeftOpenTag: options.canBeLeftOpenTag, // 可以省略闭合标签 'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
    shouldDecodeNewlines: options.shouldDecodeNewlines, // 如果属性值中有换行符，ie 会将换行符替换为转义字符，这就涉及到是否将这个转义字符解码的问题
    shouldKeepComment: options.comments, // 是否保留注释
    start: function start (tag, attrs, unary) {...}, // 解析开始标签时调用的钩子函数
    end: function end () {...}, // 解析结束标签时调用的钩子函数
    chars: function chars (text) {...}, // 添加 Attr/Text 子节点
    comment: function comment (text) {...} // 添加注释节点
  });
 */
// 解析 html
function parseHTML (html, options) {
  var stack = [];
  var expectHTML = options.expectHTML;
  // 是否为自闭合标签 'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr'
  var isUnaryTag$$1 = options.isUnaryTag || no;
  // 可以省略闭合标签 'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
  var canBeLeftOpenTag$$1 = options.canBeLeftOpenTag || no;
  var index = 0;
  var last, lastTag;

  // 在解析过程中，html 长度会逐渐变短
  while (html) {
    last = html;

    // Make sure we're not in a plaintext content element like script/style
    // lastTag 不存在或 lastTag 不是 script,style,textarea 等纯文本元素
    if (!lastTag || !isPlainTextElement(lastTag)) {

      // lastTag 是 pre、textarea 标签，并且 html 首字符是换行符
      if (shouldIgnoreFirstNewline(lastTag, html)) {
        // 前进 1 位，也就是忽略这个换行符
        advance(1);
      }

      /*
        '<' 在字符串 html 中首次出现的位置

        textEnd 表示文本的结束位置。举个例子：
        '<p>efg>' 文本为 ''，文本结束位置 textEnd 等于 0
        'abc<p>efg</p>' 文本为 'abc '，文本结束位置 textEnd 等于 3
      */
      var textEnd = html.indexOf('<');

      // ① 解析标签
      // 第一个字符就是 '<'
      if (textEnd === 0) {

        // 注释 comment = /^<!--/
        if (comment.test(html)) {
          var commentEnd = html.indexOf('-->');

          if (commentEnd >= 0) {
            // 保留注释
            if (options.shouldKeepComment) {
              /*
                // 把注释节点内容取出来，后面会生成相应的 vnode。如：
                '<!--this id comment-->'.substring(4, '<!--this id comment-->'.indexOf('-->'))
                -> 'this id comment'
              */
              options.comment(html.substring(4, commentEnd));
            }
            // 跳过注释（3 对应 '-->'）
            advance(commentEnd + 3);
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 条件注释 conditionalComment = /^<!\[/
        if (conditionalComment.test(html)) {
          var conditionalEnd = html.indexOf(']>');
          
          // 跳过条件注释（2 对应 ']>'）
          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2);
            continue
          }
        }

        // 文档类型 doctype = /^<!DOCTYPE [^>]+>/i
        var doctypeMatch = html.match(doctype);
        if (doctypeMatch) {
          // 跳过整个 doctype
          advance(doctypeMatch[0].length);
          continue
        }

        // 结束标签 endTag = new RegExp('^<\\/' + qnameCapture + '[^>]*>')
        var endTagMatch = html.match(endTag);
        if (endTagMatch) {
          var curIndex = index;
          // 跳过整个结束标签
          advance(endTagMatch[0].length);
          // 解析结束标签 parseEndTag (tagName, start, end)，其中 endTagMatch[1] 是标签名
          parseEndTag(endTagMatch[1], curIndex, index);
          continue
        }

        // 开始标签，startTagMatch 为一个 json 对象
        var startTagMatch = parseStartTag();
        // parseStartTag() 很多情况下返回 undefined，若 startTagMatch 为真，说明开始标签解析成功了
        if (startTagMatch) {
          // 处理开始标签（提取属性），处理 startTagMatch 这个 json 对象
          handleStartTag(startTagMatch);
          continue
        }
      }

      // ② 解析文本
      // 文本，void 0 === undefined -> true
      var text = (void 0), rest = (void 0), next = (void 0);
      // 修正 textEnd，取出文本
      if (textEnd >= 0) {
        
        rest = html.slice(textEnd);
        /*
            例：'abc<p>efg>' 文本为 'abc '，文本结束位置 textEnd 等于 3
            rest = 'abc<p>efg</p>'.slice(3) -> "<p>efg>"

            虽然 < 在 rest 中，但是同时满足以下条件，会将 rest 中两个 < 之间的部分当做文本，while 循环逐渐“侵蚀” rest（也就是逐渐扩大文本长度）：
            ① rest 中没有结束标签，其中 endTag = new RegExp('^<\\/' + qnameCapture + '[^>]*>')
            ② rest 中也没有合法的开始标签，其中 startTagOpen = new RegExp('^<' + qnameCapture)
            ③ rest 中也没有注释
            ④ rest 中也没有条件注释

            例如：'abc<hhhhh<p>efg</p>'
            最开始，rest 为 '<hhhhh<p>efg</p>'
            然后，rets 为 '<p>efg</p>'
        */
        while (!endTag.test(rest) && !startTagOpen.test(rest) && !comment.test(rest) && !conditionalComment.test(rest)) {
          // < in plain text, be forgiving and treat it as text
          // str.indexOf(searchvalue,fromindex) 从位置 fromindex 开始，返回指定的字符串 searchvalue 在字符串 str 中首次出现的位置。
          next = rest.indexOf('<', 1);
          // 没找到下一个 '<'，就停止“侵蚀” rest
          if (next < 0) { break }
          // 文本结束位置后移，也就是扩大文本范围
          textEnd += next;
          // rest 缩短，被 “侵蚀” 了
          rest = html.slice(textEnd);
        }
        // 文本
        text = html.substring(0, textEnd);
        // 前进，跳过文本
        advance(textEnd);
      }

      // html 中找不到 '<'，那就把整个 html 都当做文本
      if (textEnd < 0) {
        text = html;
        html = '';
      }

      // 文本处理
      if (options.chars && text) {
        options.chars(text);
      }

    // lastTag && isPlainTextElement(lastTag) 同时满足会走下面的 else 代码块，即 lastTag 是 script,style,textarea 三者之一
    } else {
      var endTagLength = 0;
      // 上一个标签名小写形式
      var stackedTag = lastTag.toLowerCase();
      /*
        reCache = {} 这个对象缓存正则表达式

        以 lastTag = 'script' 为例：
        reCache['script'] = /([\s\S]*?)(<\/script[^>]*>)/i
        script 的结束标签
      */
      var reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'));
      
      // 参数 all 表示 reStackedTag 匹配的所有内容，text 表示文本 ([\s\S]*?)，endTag 表示结束标签 (<\/script[^>]*>)
      var rest$1 = html.replace(reStackedTag, function (all, text, endTag) {
        // 结束标签的长度，如 '</script>'.length -> 9
        endTagLength = endTag.length;
        // 不是 script,style,textarea,noscript
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          // 取出注释和条件注释里的文本
          text = text
            .replace(/<!--([\s\S]*?)-->/g, '$1')
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1');
        }
        // stackedTag 是 pre、textarea 标签，并且 text 首字符是换行符，那就忽略这个换行
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1);
        }
        // 处理文本
        if (options.chars) {
          options.chars(text);
        }
        return ''
      });

      index += html.length - rest$1.length;
      html = rest$1;
      // 解析结束标签 parseEndTag (tagName, start, end)，其中 endTagMatch[1] 是标签名
      parseEndTag(stackedTag, index - endTagLength, index);
    }

    // html 和处理之前是一样的值，一个字符都没减少,也就是说 html 中没有获取到任何有用的元素
    if (html === last) {
      options.chars && options.chars(html);
      if ("development" !== 'production' && !stack.length && options.warn) {
        // 错误格式的标签
        options.warn(("Mal-formatted tag at end of template: \"" + html + "\""));
      }
      break
    }
  }

  // Clean up any remaining tags，关闭所有标签
  parseEndTag();

  // 前进 n 个字符（也就是说，有 n 个字符被忽略了）
  function advance (n) {
    index += n;
    /*
        substring(start,stop) 提取字符串中介于两个指定下标之间的字符，如果省略 stop 参数，那么返回的子串会一直到字符串的结尾。
        'abcdefgh'.substring(2) -> "cdefgh"
    */
    html = html.substring(n);
  }

  // 解析开始标签，返回一个 json 对象 match
  function parseStartTag () {
    // 匹配开始标签 startTagOpen = new RegExp('^<' + qnameCapture)
    var start = html.match(startTagOpen);
    if (start) {
      var match = {
        // 标签名
        tagName: start[1],
        // 属性
        attrs: [],
        // 开始索引
        start: index
      };

      // 跳过开始标签
      advance(start[0].length);

      var end, attr;
      // 开始标签结尾 startTagClose = /^\s*(\/?)>/，把开始标签里的所有属性挑出来
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        // attr[0] 是整个属性表达式，attr[1] 是属性名，attr[2] 是 = ，attr[3] 是属性值
        advance(attr[0].length);
        // 把该属性各个部分存下来
        match.attrs.push(attr);
      }
      // 到这里遇到了开始标签结尾，否则就返回 undefined（开始标签未闭合）
      if (end) {
        // <input /> 等自闭合标签 end[1] 为 '/'，<div> 等标签 end[1] 空 ''
        match.unarySlash = end[1];
        advance(end[0].length);
        match.end = index;
        /*
           到这里，match 结构如下：
           match = {
              tagName: start[1],
              attrs: [],
              start: index1,
              unarySlash: end[1],
              end: index2
           }
        */
        return match
      }
    }
  }

  // 处理开始标签，提取属性。处理 json 对象 match
  function handleStartTag (match) {
    // 标签名
    var tagName = match.tagName;
    // <input /> 等自闭合标签 end[1] 为 '/'，<div> 等标签 end[1] 空 ''
    var unarySlash = match.unarySlash;

    if (expectHTML) {
      // p 标签里的 h1、div、li 等标签段落元素
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        // 闭合 p 标签
        parseEndTag(lastTag);
      }
      // 可以省略闭合标签 'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'。lastTag 为最近一个未闭合标签
      if (canBeLeftOpenTag$$1(tagName) && lastTag === tagName) {
        // 闭合 tagName 标签
        parseEndTag(tagName);
      }
    }

    // 自闭合标签 'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr'
    var unary = isUnaryTag$$1(tagName) || !!unarySlash;

    var l = match.attrs.length;
    var attrs = new Array(l);
    // 属性提取
    for (var i = 0; i < l; i++) {
      var args = match.attrs[i];
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      /*
        匹配属性的正则表达式，/^\s*([^\s"'<>\/=]+)(?:\s*((?:=))\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
        IS_REGEX_CAPTURING_BROKEN 为 true，说明正则表达式捕获损坏了，意味着空字符串 "" 也可以匹配出内容，这是不对的
        args[3] 匹配的是 ([^"]*) 非 "
        args[4] 匹配的是 ([^']*) 非 '
        args[5] 匹配的是 ([^\s"'=<>`]+) 非 "'=<>`
        所以可能匹配出空字符串 ''，这是不需要的
      */
      // 修正 args
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3]; }
        if (args[4] === '') { delete args[4]; }
        if (args[5] === '') { delete args[5]; }
      }
      // args[3]、args[4]、args[5] 是或的关系，属性值只可能是其中一种
      var value = args[3] || args[4] || args[5] || '';
      attrs[i] = {
        name: args[1],
        // 将字符实体解码，如 '&amp;' -> '&'
        value: decodeAttr(value,options.shouldDecodeNewlines)
      };
    }

    /*
        于是，attrs 是这样一个数组：
        [
            {
                name : name1,
                value : value1
            },
            {
                name : name2,
                value : value2
            },
            ...
        ]
    */

    // 不是单标签
    if (!unary) {
      // 将当前标签入栈
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs });
      // lastTag 为最近一个未闭合标签
      lastTag = tagName;
    }

    // 调用钩子函数
    if (options.start) {
      // 钩子函数 start(tag, attrs, unary) 
      options.start(tagName, attrs, unary, match.start, match.end);
    }
  }

  // 解析结束标签
  function parseEndTag (tagName, start, end) {
    var pos, lowerCasedTagName;

       // start/end 实参不存在时，都赋值为 index
    if (start == null) { start = index; }
    if (end == null) { end = index; }

       // 取标签名的小写形式
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase();
    }

    // Find the closest opened tag of the same type
    if (tagName) {
         // 在解析开始标签时 stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs });
      for (pos = stack.length - 1; pos >= 0; pos--) {
            // 因为之前用的 push 方法，所以这里从后向前匹配标签。前面的标签是祖先标签，后面的是后代标签，先闭合后代标签。
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0;
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (var i = stack.length - 1; i >= pos; i--) {
        if ("development" !== 'production' && (i > pos || !tagName) && options.warn) {
          options.warn( ("tag <" + (stack[i].tag) + "> has no matching end tag.") );
        }
            // 关闭当前标签的所有子标签
        if (options.end) {
          options.end(stack[i].tag, start, end);
        }
      }

      // Remove the open elements from the stack
         // 清理数组 stack 中已经关闭的标签
      stack.length = pos;
         // 重置最近未关闭标签名
      lastTag = pos && stack[pos - 1].tag;
       // br 标签
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end);
      }
       // p 标签
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end);
      }
      if (options.end) {
        options.end(tagName, start, end);
      }
    }
  }
}

// 事件绑定
var onRE = /^@|^v-on:/;
// 指令
var dirRE = /^v-|^@|^:/;
// in 或 of
var forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/;
/*
 (( group #1 ),( group #2 ),( group #3 ))
 
 group #1 : (\{[^}]*\}|[^,]*)  { 非} 0次或多次 } 或 非, 0次或多次
 group #2 : ([^,]*)            非, 0次或多次
 group #3 : (?:,([^,]*))       , 后跟 0次或多次非 ,
*/
var forIteratorRE = /\((\{[^}]*\}|[^,]*),([^,]*)(?:,([^,]*))?\)/;

// 匹配参数
var argRE = /:(.*)$/;
// 匹配 bind
var bindRE = /^:|^v-bind:/;
// 匹配修饰符
var modifierRE = /\.[^.]+/g;

//  decodeHTMLCached(html) 将 html 赋值给一个 div 的 innerHTML，然后返回这个 div 的 textContent 属性
var decodeHTMLCached = cached(he.decode);

// configurable state
var warn$2;
var delimiters;
var transforms;
var preTransforms;
var postTransforms;
var platformIsPreTag;
var platformMustUseProp;
var platformGetTagNamespace;

/**
 * Convert HTML string to AST.
 */
// 解析模板 template
function parse (template,options) {
  // 警告函数
  warn$2 = options.warn || baseWarn;

  // 是否为 pre 标签
  platformIsPreTag = options.isPreTag || no;
  // 是否必须用 prop
  platformMustUseProp = options.mustUseProp || no;
  // 获取标签命名空间
  platformGetTagNamespace = options.getTagNamespace || no;

  // 返回 options.modules 中每一个 module.transformNode 组成的数组，即 [ module1.transformNode,  module2.transformNode,  module2.transformNode, ...]
  transforms = pluckModuleFunction(options.modules, 'transformNode');
  // [ module1.preTransformNode,  module2.preTransformNode,  module2.preTransformNode, ...]
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode');
  // [ module1.postTransformNode,  module2.postTransformNode,  module2.postTransformNode, ...]
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode');

  // 分隔符
  delimiters = options.delimiters;

  var stack = [];
  // 是否保留空白
  var preserveWhitespace = options.preserveWhitespace !== false;
  var root;
  // 前一个元素就是后一个元素的父元素，这个变量就是标记当前元素的父元素
  var currentParent;
  var inVPre = false;
  var inPre = false;
  var warned = false;

  // 警告一次
  function warnOnce (msg) {
    if (!warned) {
      warned = true;
      warn$2(msg);
    }
  }

  // 将 inVPre 和 inPre 值置为 false
  function endPre (element) {
    // check pre state
    if (element.pre) {
      inVPre = false;
    }
    if (platformIsPreTag(element.tag)) {
      inPre = false;
    }
  }

  /*
    例如：
    <div id='app'>
          {{message}}
    </div>
    <script>
        var app = new Vue({
            el: '#app',
            data: {
                message: 'Hello Vue!'
            }
        });
    </script>
    
    于是：
    template = "<div id="app">↵ {{message}}↵ </div>"

    root = {
      attrs : [{name: "id", value: ""app""}],
      attrsList : [{name: "id", value: "app"}],
      attrsMap : {id: "app"},
      children : [{type: 2, expression: ""\n "+_s(message)+"\n "", text: "↵ {{message}}↵ ", static: false}],
      parent : undefined,
      plain : false,
      static : false,
      staticRoot : false,
      tag : "div",
      type : 1
    }
   */
  // 解析模板 template
  parseHTML(template, {
    warn: warn$2,
    // 是否为 html 模板
    expectHTML: options.expectHTML,
    // 是否为自闭合标签 'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr'
    isUnaryTag: options.isUnaryTag,
    // 可以省略闭合标签 'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    // 如果属性值中有换行符，ie 会将换行符替换为转义字符，这就涉及到是否将这个转义字符解码的问题
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    // 是否保留注释
    shouldKeepComment: options.comments,
    // 解析开始标签时调用的钩子函数
    start: function start (tag, attrs, unary) {
      // check namespace.
      // inherit parent ns if there is one，获取命名空间
      var ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag);

      // handle IE svg bug
      // 修复 ie 下的 svg bug，即修正 attr.name 属性
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs);
      }

      var element = {
        type: 1,
        tag: tag,
        attrsList: attrs,
        attrsMap: makeAttrsMap(attrs),
        parent: currentParent,
        children: []
      };
      /*
       格式如下：
       ① element.attrsList 是一个数组，结构大概是：
        [
            {
                name : name1,
                value : value1
            },
            {
                name : name2,
                value : value2
            }
            ...
        ]

        ② element.attrsMap 是一个 json 对象，结构大概是：
        {
            name1 : value1,
            name2 : value2,
            name3 : value3,
            ...
        }
       */

      // 以下都是修正 element 对象，继续给其添加属性

      if (ns) {
        element.ns = ns;
      }


      // style 或 script 标签
      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true;
        // 模板的作用仅仅是状态和 UI 之间的一个映射作用。不要在其中放置一些有副作用的标签，比如 style/script 等，因为它们是不会被解析的。
        "development" !== 'production' && warn$2(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          "<" + tag + ">" + ', as they will not be parsed.'
        );
      }

      // apply pre-transforms，依次调用各个模块的 preTransformNode 函数
      for (var i = 0; i < preTransforms.length; i++) {
        preTransforms[i](element, options);
      }

      if (!inVPre) {
        // 如果 element 元素的 v-pre 属性存在，那么将 element.pre 标记为 true
        processPre(element);
        // 如果 element.pre 为 true，那就把 inVPre 标记为 true
        if (element.pre) {
          inVPre = true;
        }
      }

      // 如果 element.tag 是 pre 标签，那就将 inPre 置为 true
      if (platformIsPreTag(element.tag)) {
        inPre = true;
      }

      // pre 标签
      if (inVPre) {
        processRawAttrs(element);
      } else {
        // 解析 v-for 属性
        processFor(element);
        // 解析 v-if 属性，标记 element.if、element.else、element.elseif、element.ifConditions 等
        processIf(element);
        // 标记 element.once
        processOnce(element);
        // 标记 element.key
        processKey(element);

        // determine whether this is a plain element after
        // removing structural attributes
        // 是否移除结构化的 attribute 和 key 后，该元素不存在属性
        element.plain = !element.key && !attrs.length;

        // 标记 element.ref
        processRef(element);
        // slot 相关属性
        processSlot(element);
        // 标记 element.component、element.inlineTemplate 
        processComponent(element);

        // 依次调用各个模块的 transformNode 函数
        for (var i$1 = 0; i$1 < transforms.length; i$1++) {
          transforms[i$1](element, options);
        }
        // 处理 attribute
        processAttrs(element);
      }

      // 检查根元素约束条件
      function checkRootConstraints (el) {
        {
          if (el.tag === 'slot' || el.tag === 'template') {
            // 不能将 slot/template 标签作为组件根元素，因为它可能包含多个节点
            warnOnce(
              "Cannot use <" + (el.tag) + "> as component root element because it may " +
              'contain multiple nodes.'
            );
          }
          if (el.attrsMap.hasOwnProperty('v-for')) {
            // 不能在状态组件根节点上使用 v-for，因为它会渲染多元素
            warnOnce(
              'Cannot use v-for on stateful component root element because ' +
              'it renders multiple elements.'
            );
          }
        }
      }

      // tree management
      if (!root) {
        root = element;
        // 检查根节点约束
        checkRootConstraints(root);
      } else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
        // 允许根元素有 v-if、v-else-if、v-else 属性
        if (root.if && (element.elseif || element.else)) {
          checkRootConstraints(element);
          // root.ifConditions.push({ exp: element.elseif, block: element })
          addIfCondition(root, {
            exp: element.elseif,
            block: element
          });
        } else {
          // 组件模板必须包含一个根元素。如果在多元素上使用 v-if ，后面可以使用 v-else-if
          warnOnce(
            "Component template should contain exactly one root element. " +
            "If you are using v-if on multiple elements, " +
            "use v-else-if to chain them instead."
          );
        }
      }

      // element 为 style 或 script 标签时，element.forbidden = true
      if (currentParent && !element.forbidden) {
        if (element.elseif || element.else) {
          // 在 currentParent.children 数组中从后往前找，找到第一个 element 节点 prev，然后 prev.ifConditions.push({ exp: el.elseif,block: el })
          processIfConditions(element, currentParent);
        // element 是 <template> 标签，并且 element 的 scope 属性存在
        } else if (element.slotScope) { // scoped slot
          // 如果移除结构化的 attribute 和 key 后，该元素不存在属性，那么 plain 属性为 true
          currentParent.plain = false;
          var name = element.slotTarget || '"default"';

          /*
           关于作用域插槽，理解官网这个例子：
           ① 父组件模板
           <my-awesome-list :items="items">
               <li slot="item" slot-scope="props" class="my-fancy-item">{{ props.text }}</li>
           </my-awesome-list>

           ② 子组件 my-awesome-list 模板
           <ul>
               <slot name="item" v-for="item in items" :text="item.text">备选内容</slot>
           </ul>

           假如父作用域中 items 为:
           [
               { text: 'Foo' },
               { text: 'Bar' },
               { }
           ]
          
           有几点注意下：
           a. 父组件中的 <li slot="item" slot-scope="props" class="my-fancy-item">{{ props.text }}</li> 是子组件中 slot 标签的模板
           b. 当给 li 标签传不同的 props 对象时，它会渲染不同的结果
           c. props 是个对象，包括子组件传入的 text 等属性
           d. 子组件中 for 循环生成很多的 slot，每个 slot 的 text 属性不同
           e. text 属性由 props 对象带给父组件中的 li

           渲染结果为：
           <ul>
                <li class="my-fancy-item">Foo</li>
                <li class="my-fancy-item">Bar</li>
                <li class="my-fancy-item">备选内容</li>
           </ul>
           */
          (currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element;
        // 绑定父子关系
        } else {
          currentParent.children.push(element);
          element.parent = currentParent;
        }
      }

      // 不是单标签
      if (!unary) {
        currentParent = element;
        stack.push(element);
      } else {
        // 将 inVPre 和 inPre 值置为 false
        endPre(element);
      }
      // apply post-transforms
      for (var i$2 = 0; i$2 < postTransforms.length; i$2++) {
        // 依次调用各个模块的 postTransformNode 函数
        postTransforms[i$2](element, options);
      }
    },

    // stack 出栈
    end: function end () {
      // remove trailing whitespace
      var element = stack[stack.length - 1];
      // element 最后一个子元素
      var lastNode = element.children[element.children.length - 1];
      // 移除最末尾的空白？
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
        element.children.pop();
      }
      // pop stack，相当于 stack.pop()
      stack.length -= 1;
      // 前一个元素就是当前元素的父元素
      currentParent = stack[stack.length - 1];
      // 将 inVPre 和 inPre 值置为 false
      endPre(element);
    },

    // 添加 Text 子节点
    /*
      简单点就是：
      chars: function chars (text) {
        // ① 表达式文本，如 {{ message }}
        if (expression = parseText(text, delimiters)) {
          currentParent.children.push({
            type: 2,
            expression: expression,
            text: text
          });
        // ② 普通文本，如 someText
        } else {
          currentParent.children.push({
            type: 3,
            text: text
          });
        }
      }
     */
    chars: function chars (text) {
      // 如果不存在父元素，发出警告，就此返回
      if (!currentParent) {
        {
          // 组件模板需要有一个根元素，而不能仅仅是文本
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.'
            );
          // text 去掉左右空格后还有内容，如 'abc<div>efg</div>'，text 为 'abc'，这里会提示根元素 <p> 标签之外的 'abc' 会被忽略的
          } else if ((text = text.trim())) {
            // 根元素之外的文本将被忽略
            warnOnce(
              ("text \"" + text + "\" outside root element will be ignored.")
            );
          }
        }
        return
      }

      // IE textarea placeholder bug，ie 下的 textarea placeholder，就此返回
      if (isIE && currentParent.tag === 'textarea' && currentParent.attrsMap.placeholder === text) {
        return
      }

      var children = currentParent.children;

      // 对 text 进行修正
      text = inPre || text.trim()
        /*
            ① script 和 style 标签为文本标签，不需要解码，其他的标签需要解码
            ② decodeHTMLCached(html) 将 html 赋值给一个 div 的 innerHTML，然后返回这个 div 的 textContent 属性
        */
        ? isTextTag(currentParent) ? text : decodeHTMLCached(text)
        // only preserve whitespace if its not right after a starting tag
        // 只有不是开始标签后（children.length > 0）的空白文本可以保留
        : preserveWhitespace && children.length ? ' ' : '';

      if (text) {
        var expression;
        // 如果不是 pre 标签内，并且 text 不为 ' '，那就将模板字符串 text 转为浏览器可以解析的字符串 expression
        if (!inVPre && text !== ' ' && (expression = parseText(text, delimiters))) {
          // ① 表达式文本，如 {{ message }}
          children.push({
            type: 2,
            expression: expression,
            text: text
          });
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          // ② 普通文本，如 someText
          children.push({
            type: 3,
            text: text
          });
        }
      }
    },
    // 添加注释节点
    comment: function comment (text) {
      currentParent.children.push({
        type: 3,
        text: text,
        isComment: true
      });
    }
  });
  return root
}

// 如果 el 元素的 v-pre 属性存在，那么将 el.pre 标记为 true
function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true;
  }
}

// 修改 el.attrs
function processRawAttrs (el) {
  var l = el.attrsList.length;
  if (l) {
    var attrs = el.attrs = new Array(l);
    /*
        修改 el.attrs 属性
        el.attrs : [
            { 
                name : name1,
                value : value1
            },
            { 
                name : name1,
                value : value1
            },
            ...
        ]
    */
    for (var i = 0; i < l; i++) {
      attrs[i] = {
        name: el.attrsList[i].name,
        value: JSON.stringify(el.attrsList[i].value)
      };
    }
  // 不存在 attributes 并且不是 pre 元素
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true;
  }
}

// 添加 el.key
function processKey (el) {
  var exp = getBindingAttr(el, 'key');
  if (exp) {
    // <template> 标签不能添加 key 属性，只能在真实元素节点上添加
    if ("development" !== 'production' && el.tag === 'template') {
      warn$2("<template> cannot be keyed. Place the key on real elements instead.");
    }
    el.key = exp;
  }
}

// 标记 el.ref
function processRef (el) {
  var ref = getBindingAttr(el, 'ref');
  if (ref) {
    el.ref = ref;
    // el 的祖先元素中是否有 for 属性
    el.refInFor = checkInFor(el);
  }
}

// v-for 属性。添加 el.for（数据源）、el.alias（数据项）、el.iterator1（数据子项）、el.iterator2（数据子项） 等属性
function processFor (el) {
  var exp;
  // v-for 属性存在，eg : "item in items" 或 "(value, key) in items"
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    // forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/， in 或 of
    var inMatch = exp.match(forAliasRE);
    // v-for 的属性值里必须含有 in 或 of 关键词
    if (!inMatch) {
      "development" !== 'production' && warn$2(
        ("Invalid v-for expression: " + exp)
      );
      return
    }
    // 数据源 'items'
    el.for = inMatch[2].trim();
    // 数据项 'item' 或 '(value, key)'
    var alias = inMatch[1].trim();
	/*
		对于 v-for="(value, key) in object" 这种形式，alias = '(value, key)'
		于是：'(value, key)'.match(forIteratorRE) -> ["(value, key)", "value", " key", undefined, index: 0, input: "(value, key)"]
	*/
    var iteratorMatch = alias.match(forIteratorRE);
    if (iteratorMatch) {
      // 数据值 "value"
      el.alias = iteratorMatch[1].trim();
      // 数据键 "key"
      el.iterator1 = iteratorMatch[2].trim();
      if (iteratorMatch[3]) {
        el.iterator2 = iteratorMatch[3].trim();
      }
    } else {
      // 'item'
      el.alias = alias;
    }
  }
}


// v-if 属性
function processIf (el) {
  var exp = getAndRemoveAttr(el, 'v-if');
  // v-if 分支，el.if 为真
  if (exp) {
	// 以 <div v-if="isShow" v-bind:style="styleObject"> 为例，exp = "isShow"
    el.if = exp;
    // el.ifConditions.push(condition)
    addIfCondition(el, {
      exp: exp,
      block: el
    });
  // v-else 分支，v.else 必定为真，v.elseif 得根据条件判断
  } else {
    // v-else 
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true;
    }
    // v-else-if
    var elseif = getAndRemoveAttr(el, 'v-else-if');
    if (elseif) {
      el.elseif = elseif;
    }
  }
}

// 处理 if 条件
function processIfConditions (el, parent) {
  // 在 parent.children 数组中从后往前找，找到第一个 element 节点
  var prev = findPrevElement(parent.children);
  if (prev && prev.if) {
    // prev.ifConditions.push({ exp: el.elseif,block: el })
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    });
  } else {
    // 如果只有 v-else/v-else-if ，而没有对应的 v-if，发出警告
    warn$2(
      "v-" + (el.elseif ? ('else-if="' + el.elseif + '"') : 'else') + " " +
      "used on element <" + (el.tag) + "> without corresponding v-if."
    );
  }
}

// 找到之前的元素，在 children 数组里从后往前找，返回第一个找到的 type === 1 的元素
function findPrevElement (children) {
  var i = children.length;
  while (i--) {
    // 当前 child 是 element 元素，返回
    if (children[i].type === 1) {
      return children[i]
    // 当前 child 不是 element 元素，跳过，重新找
    } else {
      // v-if 和 v-else(-if) 之间的文本会被忽略的
      if ("development" !== 'production' && children[i].text !== ' ') {
        warn$2(
          "text \"" + (children[i].text.trim()) + "\" between v-if and v-else(-if) " +
          "will be ignored."
        );
      }
      children.pop();
    }
  }
}

// 添加 if 条件
function addIfCondition (el, condition) {
  if (!el.ifConditions) {
    el.ifConditions = [];
  }
  el.ifConditions.push(condition);
}

// 标记 el.once
function processOnce (el) {
  var once$$1 = getAndRemoveAttr(el, 'v-once');
  if (once$$1 != null) {
    el.once = true;
  }
}

// slot 相关属性
function processSlot (el) {
  // slot 标签
  if (el.tag === 'slot') {
    el.slotName = getBindingAttr(el, 'name');
    if ("development" !== 'production' && el.key) {
      // <slot> 标签上的 key 不起作用
      warn$2(
        "`key` does not work on <slot> because slots are abstract outlets " +
        "and can possibly expand into multiple elements. " +
        "Use the key on a wrapping element instead."
      );
    }
  } else {
    var slotTarget = getBindingAttr(el, 'slot');
    if (slotTarget) {
      // 若 slotTarget 为 '""'，则取 '"default"'
      el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget;
    }
    /*
      参考官网作用域插槽描述：
      在父级中，具有特殊特性 slot-scope 的 <template> 元素必须存在，表示它是作用域插槽的模板。slot-scope 的值将被用作一个临时变量名，此变量接收从子组件传递过来的 prop 对象
     
      slot-scope 属性被解析成了 scope 属性吗？
      经验证，2.4.0 版本（当前版本）应该是 scope 属性而不是 slot-scope 属性

      2.5.0+ 版本才改成 slot-scope 属性
     */
    if (el.tag === 'template') {
      el.slotScope = getAndRemoveAttr(el, 'scope');
    }
  }
}

// 标记 el.component、el.inlineTemplate 
function processComponent (el) {
  var binding;
  // is 属性
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding;
  }
  // inline-template 属性
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true;
  }
}

// 属性处理
function processAttrs (el) {
  /*
    el.attrsList 是一个数组，结构大概是：
    [
      {
        name : name1,
        value : value1
      },
      {
        name : name2,
        value : value2
      }
      ...
    ]
   */
  var list = el.attrsList;
  var i, l, name, rawName, value, modifiers, isProp;
  // 遍历 attributes
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name;
    value = list[i].value;

    // 匹配指令 dirRE = /^v-|^@|^:/;
    if (dirRE.test(name)) {

      // mark element as dynamic，标记当前元素拥有动态属性
      el.hasBindings = true;

      // modifiers，解析修饰符，返回一个 json，键名是各修饰符，键值是 true
      modifiers = parseModifiers(name);

      if (modifiers) {
        // 匹配修饰符 modifierRE = /\.[^.]+/g，去掉修饰符
        name = name.replace(modifierRE, '');
      }
      // ① 匹配 bind 指令 bindRE = /^:|^v-bind:/
      if (bindRE.test(name)) { 
        // 去掉 v-bind
        name = name.replace(bindRE, '');
        // 解析过滤器，返回一个字符串
        value = parseFilters(value);
        isProp = false;
        // 属性修饰符
        if (modifiers) {

          // ① prop 修饰符
          if (modifiers.prop) {
            isProp = true;
            name = camelize(name);
            // 修正 'innerHtml' -> 'innerHTML'
            if (name === 'innerHtml') { name = 'innerHTML'; }
          }
          // ② camel 修饰符，驼峰化
          if (modifiers.camel) {
            name = camelize(name);
          }
          // ③ sync 修饰符
          if (modifiers.sync) {
            /*
              addHandler 函数的大致作用为：
              addHandler (el,name,value,modifiers,important,warn) 
              -> el.events[name] = el.events[name].push({ value: value, modifiers: modifiers })

              genAssignmentCode(value, "$event") 返回一个字符串形式的执行语句，其实就是一个 set 操作
             */
            addHandler(el, ("update:" + (camelize(name))), genAssignmentCode(value, "$event"));
          }
        }
        if (!el.component && (isProp || platformMustUseProp(el.tag, el.attrsMap.type, name))) {
          // el.props.push({ name: name, value: value })
          addProp(el, name, value);
        } else {
          // el.attrs.push({ name: name, value: value })
          addAttr(el, name, value);
        }
      // ② 匹配事件绑定 onRE = /^@|^v-on:/
      } else if (onRE.test(name)) { // v-on
        name = name.replace(onRE, '');
        addHandler(el, name, value, modifiers, false, warn$2);
      // ③ 匹配 v-show 等普通 vue 指令
      } else { // normal directives
        // 如 name = "show"
        name = name.replace(dirRE, '');
        // parse arg
        // 匹配参数 argRE = /:(.*)$/
        var argMatch = name.match(argRE);
        var arg = argMatch && argMatch[1];
        if (arg) {
          name = name.slice(0, -(arg.length + 1));
        }

        /*
          以 v-show:arg1="isShow" 为例：
          name = "show"
          argMatch = null
          arg = 'arg1'
         */

        // 添加指令
        addDirective(el, name, rawName, value, arg, modifiers);
        if ("development" !== 'production' && name === 'model') {
          // 检测 el 及其所有祖先元素
          checkForAliasModel(el, value);
        }
      }
    } else {
      // literal attribute
      {
        var expression = parseText(value, delimiters);
        if (expression) {
          // <div class="{{ val }}"> 属性内的插值这种写法已经不支持了。推荐使用 <div :class="val">
          warn$2(
            name + "=\"" + value + "\": " +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.'
          );
        }
      }
      // 直接添加 attr
      addAttr(el, name, JSON.stringify(value));
    }
  }
}

// 只要祖先元素中存在 for 属性，那就返回 true
function checkInFor (el) {
  var parent = el;
  // 遍历祖先元素，只要有一个元素的 for 属性存在就返回 true
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent;
  }
  return false
}

// 解析修饰符，返回一个 json，键名是各修饰符，键值是 true
function parseModifiers (name) {
  // 匹配修饰符 modifierRE = /\.[^.]+/g;
  var match = name.match(modifierRE);
  if (match) {
    var ret = {};
    /*
      ret : {
        modifier1 : true,
        modifier2 : true,
        ...
      }
     */
    match.forEach(function (m) { ret[m.slice(1)] = true; });
    return ret
  }
}

// 返回一个 json 对象，键名是属性名，键值是属性值
function makeAttrsMap (attrs) {
  var map = {};
  for (var i = 0, l = attrs.length; i < l; i++) {
    // 重复属性发出警告
    if ("development" !== 'production' && map[attrs[i].name] && !isIE && !isEdge) {
      warn$2('duplicate attribute: ' + attrs[i].name);
    }
    // 添加到 map 
    map[attrs[i].name] = attrs[i].value;
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
// script 和 style 标签为文本标签
function isTextTag (el) {
  return el.tag === 'script' || el.tag === 'style'
}

// style 或 script 标签
function isForbiddenTag (el) {
  return (
    // <style></style>
    el.tag === 'style' ||
    // <script src=".js"></script> 或 <script type="text/javascript" src=".js"></script>
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

var ieNSBug = /^xmlns:NS\d+/;
var ieNSPrefix = /^NS\d+:/;

// 修复 ie 下的 svg bug
function guardIESVGBug (attrs) {
  var res = [];
  // 遍历 attrs，修正 attr.name
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i];
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '');
      res.push(attr);
    }
  }
  return res
}

// 检测 el 及其所有祖先元素，如果源数组绑定到 el 上，发出警告
function checkForAliasModel (el, value) {
  var _el = el;
  while (_el) {
    if (_el.for && _el.alias === value) {
      // 在 v-for 列表里使用 v-model 是不能够修改 v-for 的源数组的
      warn$2(
        "<" + (el.tag) + " v-model=\"" + value + "\">: " +
        "You are binding v-model directly to a v-for iteration alias. " +
        "This will not be able to modify the v-for source array because " +
        "writing to the alias is like modifying a function local variable. " +
        "Consider using an array of objects and use v-model on an object property instead."
      );
    }
    _el = _el.parent;
  }
}


var isStaticKey;
var isPlatformReservedTag;

/*
    将 genStaticKeys$1 函数的执行结果缓存下来
    
    genStaticKeys$1 ('abc') -> makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs,abc')
    genStaticKeys$1 () -> makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs')

    genStaticKeys$1 ('abc')('abc') -> true
    genStaticKeys$1 ('abc')('type') -> true
*/
var genStaticKeysCached = cached(genStaticKeys$1);

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
 /*
    优化器的目标：遍历模板的 AST 树，并检测出纯静态的子树（也就是从来不需要改变的 dom 块）

    一旦检测到了纯静态的子树，做如下处理：
    1. 把它们提升到常量里。这样我们就不必为每一个 re-render 创建一批新的节点了。
    2. 在打补丁的过程中跳过它们

	其实就是给 root 添加 root.static、root.staticInFor、root.staticRoot 等属性，属性值为 true | false
 */
function optimize (root, options) {
  if (!root) { return }
  /*
    function genStaticKeys$1 (keys) {
      return makeMap(
        'type,tag,attrsList,attrsMap,plain,parent,children,attrs' +
        (keys ? ',' + keys : '')
      )
    }
    genStaticKeysCached = cached(genStaticKeys$1)

    所以，isStaticKey 相当于：
    isStaticKey = function(){
        return makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs' + options.staticKeys)
    }

    其中，options.staticKeys(即 baseOptions.staticKeys) 为：genStaticKeys(modules$1)
    genStaticKeys 方法的作用是将一组对象的 staticKeys 数组合并成一个字符串，举个例子：
    modules = [
        { staticKeys : ['mod11','mod12'] },
        { staticKeys : ['mod21','mod22'] },
        { staticKeys : ['mod31','mod32'] }
    ];
    genStaticKeys(modules)
    -> "mod11,mod12,mod21,mod22,mod31,mod32"

    所以，isStaticKey 相当于：
    isStaticKey = function(){
        // 这些属性都是静态属性
        return makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs' + "mod11,mod12,mod21,mod22,mod31,mod32")
    }
  */
  // 判断静态属性
  isStaticKey = genStaticKeysCached(options.staticKeys || '');
  isPlatformReservedTag = options.isReservedTag || no;
  // first pass: mark all non-static nodes.
  // 给 root 添加属性 root.static，属性值为 true 则为静态节点，为 false 则为非静态节点
  markStatic$1(root);
  // second pass: mark static roots.
  // 标记静态根节点，添加 root.staticInFor、root.staticRoot 等属性，属性值为 true | false
  markStaticRoots(root, false);
}

/*
    makeMap() 会返回一个函数，如：
    makeMap('aaa,bbb,ccc',true)('aaa') -> true

    genStaticKeys$1 ('abc') -> makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs,abc')
    genStaticKeys$1 ('abc')('abc') -> true
    genStaticKeys$1 ('abc')('type') -> true
*/
function genStaticKeys$1 (keys) {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs' +
    (keys ? ',' + keys : '')
  )
}

// 标记节点是否为静态节点
function markStatic$1 (node) {
  // 是否为静态节点。当一个节点被标记为静态节点，之后的虚拟 DOM 在通过 diff 算法比较差异时会跳过该节点以提升效率，这就是 AST 的优化。
  node.static = isStatic(node);
  // 1 为 Element，代表元素
  if (node.type === 1) {
    /*
        不要把 slot 组件的内容标记为静态的。这样可以避免两种情况：
        ① 组件不能突变插槽节点
        ② 静态的插槽内容在热更新时会出问题
    */
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (!isPlatformReservedTag(node.tag) && node.tag !== 'slot' && node.attrsMap['inline-template'] == null) {
      return
    }
    
    // 遍历 node 的子节点，递归调用 markStatic$1()
    for (var i = 0, l = node.children.length; i < l; i++) {
      var child = node.children[i];
      // 递归标记所有子节点
      markStatic$1(child);
      // 只要有一个子节点不是静态的，那么父节点 node 就不是静态的
      if (!child.static) {
        node.static = false;
      }
    }
    if (node.ifConditions) {
      // node.ifConditions[i$1] 结构为： { exp: el.elseif,block: el } 
      for (var i$1 = 1, l$1 = node.ifConditions.length; i$1 < l$1; i$1++) {
        var block = node.ifConditions[i$1].block;
        markStatic$1(block);
        // 只要有一个 block 不是静态的，那么 node 就不是静态的
        if (!block.static) {
          node.static = false;
        }
      }
    }
  }
}

// 标记静态根节点，添加 node.staticInFor、node.staticRoot 等属性，属性值为 true | false
function markStaticRoots (node, isInFor) {
  // 1 为 Element，代表元素
  if (node.type === 1) {
    if (node.static || node.once) {
      node.staticInFor = isInFor;
    }
    
    /*
        对一个静态根节点来说，它应该包含除了静态文本之外的其他子节点。
        否则，提升的成本会超过它的效益，所以每次重新渲染之倒是一个更好的选择
    */
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    
    // 作为静态节点，必须保证有子节点并且不为纯文本。如果只是纯文本，那么重新渲染的成本更小。
    if (node.static && node.children.length && !(node.children.length === 1 && node.children[0].type === 3)) {
      node.staticRoot = true;
      return
    } else {
      node.staticRoot = false;
    }

    // 递归标记子节点
    if (node.children) {
      for (var i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for);
      }
    }
    
    // 递归标记 if 块 dom
    if (node.ifConditions) {
       // node.ifConditions[i$1] 结构为： { exp: el.elseif,block: el } 
      for (var i$1 = 1, l$1 = node.ifConditions.length; i$1 < l$1; i$1++) {
        // 递归调用 markStaticRoots()
        markStaticRoots(node.ifConditions[i$1].block, isInFor);
      }
    }
  }
}

// 判断一个节点是否为静态节点
function isStatic (node) {
  // 表达式 {{...}}，非静态
  if (node.type === 2) { // expression
    return false
  }
  // 文本，静态
  if (node.type === 3) { // text
    return true
  }
  return !!(node.pre || (
    // 没有动态的 bind
    !node.hasBindings && // no dynamic bindings
    // 没有 v-if、v-for、v-else
    !node.if && !node.for && // not v-if or v-for or v-else
    // 不是 slot、component
    !isBuiltInTag(node.tag) && // not a built-in
    // 不是保留标签
    isPlatformReservedTag(node.tag) && // not a component
    // 不是模板的直接子元素
    !isDirectChildOfTemplateFor(node) &&
    // node 对象的每一个属性都是静态的
    Object.keys(node).every(isStaticKey)
    /*
        isStaticKey = function(){
            // 这些属性都是静态属性
            return makeMap('type,tag,attrsList,attrsMap,plain,parent,children,attrs' + "mod11,mod12,mod21,mod22,mod31,mod32")
        }
        作用是判断属性是否为以下静态属性
    */
  ))
}

// 当一个元素为 template 标签（该标签的 for 属性为真）的直接子元素才返回 true
function isDirectChildOfTemplateFor (node) {
  while (node.parent) {
    node = node.parent;
    if (node.tag !== 'template') {
      return false
    }
    /*
        例如：
        <ul id="example-1">
          <li v-for="item in items">
            {{ item.message }}
          </li>
        </ul>
    */
    if (node.for) {
      return true
    }
  }
  return false
}

/*
    fnExpRE 匹配两种函数声明方式：
    ① 箭头函数
       (a) =>
       a => 
    ② 普通函数 
       function (
*/
var fnExpRE = /^\s*([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/;
/*
    simplePathRE 匹配以下路径：
    ① abc
    ② abc.def
    ③ abc['def']
    ④ abc["def"]
    ⑤ abc[123]
    ⑥ abc[def]
*/
var simplePathRE = /^\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['.*?']|\[".*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*\s*$/;

// keyCode aliases 键值的别名
var keyCodes = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  up: 38,
  left: 37,
  right: 39,
  down: 40,
  'delete': [8, 46]
};

// #4868: modifiers that prevent the execution of the listener
// need to explicitly return null so that we can determine whether to remove
// the listener for .once
// 修饰符如要阻止监听器执行，则需要显示地返回 null。以便有 .once 修饰符时可以决定是否移除这个监听器。
var genGuard = function (condition) { return ("if(" + condition + ")return null;"); };

// 修饰符对应的执行代码
var modifierCode = {
  // 阻止冒泡
  stop: '$event.stopPropagation();',
  // 阻止默认行为
  prevent: '$event.preventDefault();',
  /*
    event.currentTarget：返回事件当前所在的节点，会随着事件捕获和事件冒泡改变。也就是事件监听函数中的 this。
    event.target：返回目标节点（最深层节点），固定的。正是这个属性使得事件代理成为可能。
  */
  self: genGuard("$event.target !== $event.currentTarget"),

  // "ctrl" 键是否被按下 "if(!$event.ctrlKey)return null;"
  ctrl: genGuard("!$event.ctrlKey"), 

  // "shift" 键是否被按下 "if(!$event.shiftKey)return null;"
  shift: genGuard("!$event.shiftKey"),

  // "alt" 键是否被按下 "if(!$event.altKey)return null;"
  alt: genGuard("!$event.altKey"),

  // "meta" 键是否被按下 "if(!$event.metaKey)return null;"
  meta: genGuard("!$event.metaKey"),

  // 鼠标左键 "if('button' in $event && $event.button !== 0)return null;"
  left: genGuard("'button' in $event && $event.button !== 0"),

  // 鼠标中键 "if('button' in $event && $event.button !== 1)return null;"
  middle: genGuard("'button' in $event && $event.button !== 1"),

  // 鼠标右键 "if('button' in $event && $event.button !== 2)return null;"
  right: genGuard("'button' in $event && $event.button !== 2")
};

/*
    返回结果大概为：
    'on:{
        'name1' : "function($event){ some code}",
        'name2' : "function($event){ some code}",
        'name3' : "function($event){ some code}"
        ...
    }'
*/
function genHandlers (events, isNative, warn) {
  var res = isNative ? 'nativeOn:{' : 'on:{';
  for (var name in events) {
    var handler = events[name];
    // #5330: warn click.right, since right clicks do not actually fire click events.
    // click.right 这种写法发出警告。点击右键并不会触发点击事件
    if ("development" !== 'production' &&
      name === 'click' &&
      handler && handler.modifiers && handler.modifiers.right
    ) {
      warn(
        "Use \"contextmenu\" instead of \"click.right\" since right clicks " +
        "do not actually fire \"click\" events."
      );
    }
    res += "\"" + name + "\":" + (genHandler(name, handler)) + ",";
  }
  // 'abc'.slice(0,-1) -> 'ab'（去除最后一个逗号，然后闭合 {}）
  return res.slice(0, -1) + '}'
}

// 返回一个事件处理函数的字符串形式
function genHandler (name, handler) {
  // 没有指定 handler，那就返回空函数
  if (!handler) {
    return 'function(){}'
  }

  // handler 是数组，递归调用 genHandler 函数
  if (Array.isArray(handler)) {
    return ("[" + (handler.map(function (handler) { return genHandler(name, handler); }).join(',')) + "]")
  }

  /*
    (1) simplePathRE 匹配以下路径：
    ① abc
    ② abc.def
    ③ abc['def']
    ④ abc["def"]
    ⑤ abc[123]
    ⑥ abc[def]

    (2) fnExpRE 匹配两种函数声明方式：
    ① 箭头函数
       (a) =>
       a => 
    ② 普通函数 
       function (
 */
  // handler.value 是函数名，例如 abc['def'] 就是指某个函数
  var isMethodPath = simplePathRE.test(handler.value);
  // handler.value 是函数声明，例如 'function(arg){someCode}'
  var isFunctionExpression = fnExpRE.test(handler.value);

  // ① 没有修饰符
  if (!handler.modifiers) {
    return isMethodPath || isFunctionExpression
      // handler.value 是完整的函数
      ? handler.value
      // 行内语句
      : ("function($event){" + (handler.value) + "}") // inline statement
  // ② 有修饰符 modifiers
  } else {
    var code = '';
    var genModifierCode = '';
    var keys = [];
    // key 为 stop、prevent、self、ctrl...
    for (var key in handler.modifiers) {
      if (modifierCode[key]) {
        /*
            例如：
         var modifierCode = {
             stop: '$event.stopPropagation();',
             prevent: '$event.preventDefault();',
             self: genGuard("$event.target !== $event.currentTarget"),
             ...
         };

         其中：
         ① stop 阻止冒泡，prevent 阻止默认行为
         ② event.currentTarget：返回事件当前所在的节点，会随着事件捕获和事件冒泡改变。也就是事件监听函数中的 this。
            event.target：返回目标节点（最深层节点），固定的。正是这个属性使得事件代理成为可能。
        */
        genModifierCode += modifierCode[key];
        // keyCodes 为一个 json 对象，即键名和键值的映射表
        if (keyCodes[key]) {
          keys.push(key);
        }
      } else {
        keys.push(key);
      }
    }

    if (keys.length) {
      /*
        genKeyFilter(['left','right'])
        -> "if(!('button' in $event)&&_k($event.keyCode,"left",37)&&_k($event.keyCode,"right",39))return null;"

        如果事件源不是指定的按键（keys），就返回 null（什么也不做）
      */
      code += genKeyFilter(keys);
    }
    // Make sure modifiers like prevent and stop get executed after key filtering
    if (genModifierCode) {
      code += genModifierCode;
    }
    /*
        ① isMethodPath 为 true（handler.value 是函数名）
           如 handler.value = abc['def']（函数名），那么 handlerCode 为 abc['def']($event)
        ② isFunctionExpression 为 true（handler.value 是函数声明）
           如 handler.value = function(a){return a}，那么 handlerCode 为 (function(a){return a})($event)
        ③ 以上都不是，那么 handlerCode 为 handler.value
    */
    var handlerCode = isMethodPath
      ? handler.value + '($event)'
      : isFunctionExpression
        ? ("(" + (handler.value) + ")($event)")
        : handler.value;

    // 返回事件处理函数的字符串形式
    /*
      例如，对于 <div @click.self.ctrl='clickFunc'> 则 click 事件返回值为：
      "function($event){if(!('button' in $event)&&_k($event.keyCode,"ctrl"))return null;if($event.target !== $event.currentTarget)return null;clickFunc($event)}"
      格式化后：
      "function($event) {
        if (!('button' in $event) && _k($event.keyCode, "ctrl")) return null;
        if ($event.target !== $event.currentTarget) return null;
        clickFunc($event)
      }"
     */
    return ("function($event){" + code + handlerCode + "}")
  }
}

/*
genKeyFilter(['left','right'])
-> "if(!('button' in $event)&&_k($event.keyCode,"left",37)&&_k($event.keyCode,"right",39))return null;"
*/
function genKeyFilter (keys) {
  return ("if(!('button' in $event)&&" + (keys.map(genFilterCode).join('&&')) + ")return null;")
}

/*
genFilterCode('left') -> "_k($event.keyCode,"left",37)"
genFilterCode(37) -> "$event.keyCode!==37"
*/
function genFilterCode (key) {
  var keyVal = parseInt(key, 10);
  // key 是数值
  if (keyVal) {
    return ("$event.keyCode!==" + keyVal)
  }
  /*
    var keyCodes = {
      esc: 27,
      tab: 9,
      enter: 13,
      space: 32,
      up: 38,
      left: 37,
      right: 39,
      down: 40,
      'delete': [8, 46]
    };
  */
  var alias = keyCodes[key];
  // key 是键名
  return ("_k($event.keyCode," + (JSON.stringify(key)) + (alias ? ',' + JSON.stringify(alias) : '') + ")")
}

// 给 el 添加 wrapListeners 属性，_g 函数
function on (el, dir) {
  // v-on 使用修饰符时必须带有参数
  if ("development" !== 'production' && dir.modifiers) {
    warn("v-on without argument does not support modifiers.");
  }
  el.wrapListeners = function (code) { return ("_g(" + code + "," + (dir.value) + ")"); };
}

// 给 el 添加 wrapData 属性，_b 函数
function bind$1 (el, dir) {
  el.wrapData = function (code) {
    return ("_b(" + code + ",'" + (el.tag) + "'," + (dir.value) + "," + (dir.modifiers && dir.modifiers.prop ? 'true' : 'false') + (dir.modifiers && dir.modifiers.sync ? ',true' : '') + ")")
  };
}

// 事件相关指令
var baseDirectives = {
  on: on,
  bind: bind$1,
  // function noop (a, b, c) {}
  cloak: noop 
}; 

// 代码生成状态
var CodegenState = function CodegenState (options) {
  this.options = options;
  // 警告函数
  this.warn = options.warn || baseWarn;
  // 返回一个 module['transformCode'] 组成的数组，即 [ module1.transformCode,  module2.transformCode,  module2.transformCode, ...]
  this.transforms = pluckModuleFunction(options.modules, 'transformCode');
  // 返回一个 module['genData'] 组成的数组，即 [ module1.genData,  module2.genData,  module2.genData, ...]
  this.dataGenFns = pluckModuleFunction(options.modules, 'genData');
  /*
    var baseDirectives = {
      on: on,
      bind: bind$1,
      cloak: noop 
    }; 
  */
  this.directives = extend(extend({}, baseDirectives), options.directives);
  var isReservedTag = options.isReservedTag || no;
  this.maybeComponent = function (el) { return !isReservedTag(el.tag); };
  this.onceId = 0;
  // 静态渲染函数
  this.staticRenderFns = [];
};


/*
    返回一个 json 对象：
    {
        render : "some code",
        staticRenderFns : []
    }
*/
function generate (ast,options) {
  var state = new CodegenState(options);
  // 将 ast 对象转为浏览器可以解析的字符串
  var code = ast ? genElement(ast, state) : '_c("div")';
  return {
	/*
		以 code = "_c('a',{attrs:{"id":"app"}},_l((items),function(value,key){return _c('a',{attrs:{"href":"#"}},[_v(_s(val))])}))" 为例：
		with 语句的 this 是 vm，所以 _c 实际是 vm._c
		
		看看 with 的基本用法（严格模式下不能使用 with 语句）：
		var qs = location.search.substring(1);
		var hostName = location.hostname;
		var url = location.href;
		这几行代码都是访问 location 对象中的属性，如果使用 with 关键字的话，可以简化代码如下：
		with (location){
		  var qs = search.substring(1);
		  var hostName = hostname;
		  var url = href;
		}
		在这段代码中，使用了 with 语句关联了 location 对象，这就以为着在 with 代码块内部，每个变量首先被认为是一个局部变量，如果局部变量与 location 对象的某个属性同名，则这个局部变量会指向 location 对象属性。
	
		在 Vue.prototype._render 中：
		vnode = render.call(vm._renderProxy, vm.$createElement);
		而 vm._renderProxy = new Proxy(vm, handlers)，也就是说 vm._renderProxy 的属性读取会被代理（对不存在的属性发出警告）
		所以:
		"_c('a',{attrs:{"id":"app"}},_l((items),function(value,key){return _c('a',{attrs:{"href":"#"}},[_v(_s(val))])}))"
		其中的 vm._c、vm._l、vm._v、vm._s 等属性的读取都会被拦截（对不合要求的属性发出警告）

	  注意：这里的 "with(this){return " + code + "}" 只是一个字符串，真正转为执行代码时 this 是 vm

    对于模板：
    div id='app'>
        <div @click.self.ctrl='click'>
            {{computedValue | filter}}
        </div>
    </div>

    得到的 render 为:
    with(this) {
        return _c('div', {
            attrs: {
                "id": "app"
            }
        }, [_c('div', {
            on: {
                "click": function($event) {
                    if (!('button' in $event) && _k($event.keyCode, "ctrl")) return null;
                    if ($event.target !== $event.currentTarget) return null;
                    click($event)
                }
            }
        }, [_v("\n" + _s(_f("filter")(computedValue)) + "\n")])])
    }
	*/
    render: ("with(this){return " + code + "}"),
    staticRenderFns: state.staticRenderFns
  }
}

// 生成渲染函数，返回字符串形式的浏览器可执行代码。这里的 el 指 ast
function genElement (el, state) {
  // 静态节点
  if (el.staticRoot && !el.staticProcessed) {
    return genStatic(el, state)
  // v-once
  } else if (el.once && !el.onceProcessed) {
    return genOnce(el, state)
  // v-for
  } else if (el.for && !el.forProcessed) {
    return genFor(el, state)
  // v-if
  } else if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  // 模板
  } else if (el.tag === 'template' && !el.slotTarget) {
    return genChildren(el, state) || 'void 0'
  // 插槽
  } else if (el.tag === 'slot') {
    return genSlot(el, state)
  } else {
    // component or element
    var code;
    // 组件
    if (el.component) {
      code = genComponent(el.component, el, state);
    // 普通元素
    } else {
      // 若 el.plain 为 false，那就是没属性，没必要去解析 data 了
      var data = el.plain ? undefined : genData$2(el, state);
      /*
        genData$2(el, state) 返回值为这种形式：
        data: {
            staticClass:"view two",
            attrs:{"name":"a"},
            key : ...,
            attrs : {},
            ...
        }
     */
      var children = el.inlineTemplate ? null : genChildren(el, state, true);
      /*
        code = "_c('" + (el.tag) + "'" +  ("," + data)  + ("," + children) + ")"
        其中，_c 就是 createElement。
        createElement( tag, data, children) 生成模板
        其中：
        tag :  一个 HTML 标签字符串，组件选项对象，或者一个返回值类型为 String/Object 的函数，必要参数
        data : 一个包含模板相关属性的数据对象。这样，您可以在 template 中使用这些属性。可选参数。
        children : 子节点。可选参数
      */
      code = "_c('" + (el.tag) + "'" + (data ? ("," + data) : '') + (children ? ("," + children) : '') + ")";
    }
    // module transforms
    // state.transforms 是一个 module['transformCode'] 组成的数组，即 [ module1.transformCode,  module2.transformCode,  module2.transformCode, ...]
    for (var i = 0; i < state.transforms.length; i++) {
      code = state.transforms[i](el, code);
    }
    return code
  }
}

// hoist static sub-trees out，静态节点
function genStatic (el, state) {
  el.staticProcessed = true;
  // 该节点为静态 dom
  state.staticRenderFns.push(("with(this){return " + (genElement(el, state)) + "}"));
  // Vue.prototype._m = renderStatic 其中 renderStatic(index, isInFor) 第一个参数 index 为数值形式的索引
  return ("_m(" + (state.staticRenderFns.length - 1) + (el.staticInFor ? ',true' : '') + ")")
}

// v-once
function genOnce (el, state) {
  // 标记执行过 genOnce 函数
  el.onceProcessed = true;
  // 优先处理 v-if
  if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  } else if (el.staticInFor) {
    var key = '';
    var parent = el.parent;
    // 取出祖先元素的 key 属性
    while (parent) {
      if (parent.for) {
        key = parent.key;
        break
      }
      parent = parent.parent;
    }
    // 没有 key 发出警告：v-for 内的 v-once 必须带有 key 属性
    if (!key) {
      "development" !== 'production' && state.warn(
        "v-once can only be used inside v-for that is keyed. "
      );
      return genElement(el, state)
    }
    return ("_o(" + (genElement(el, state)) + "," + (state.onceId++) + (key ? ("," + key) : "") + ")")
  } else {
    return genStatic(el, state)
  }
}

// v-if，实际调用的时候好像没只用到 el 和 state 等两个参数
function genIf (el, state, altGen, altEmpty) {
  // 标记执行过 genIf，避免递归
  el.ifProcessed = true; // avoid recursion
  return genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)
}

// if 条件
function genIfConditions (conditions, state, altGen, altEmpty) {
  // 条件为空，返回 altEmpty
  if (!conditions.length) {
    return altEmpty || '_e()'
  }

  /*
    el.ifConditions 结构为：
    [
      {
        exp: exp1,
        block: dom1
      },
      {
        exp: exp2,
        block: dom2
      }
      ...
    ]
   */
  var condition = conditions.shift();
  // if 条件成立
  if (condition.exp) {
    return ("(" + (condition.exp) + ")?" + (genTernaryExp(condition.block)) + ":" + (genIfConditions(conditions, state, altGen, altEmpty)))
  } else {
    return ("" + (genTernaryExp(condition.block)))
  }

  // v-if with v-once should generate code like (a)?_m(0):_m(1)
  // 生成 3 元表达式
  function genTernaryExp (el) {
    /*
        ① altGen 存在
           返回 altGen(el, state)
        ② altGen 不存在
           a. el.once 存在，返回 genOnce(el, state)
           b. el.once 不存在，返回 genElement(el, state)
    */
    return altGen
      ? altGen(el, state)
      : el.once
        ? genOnce(el, state)
        : genElement(el, state)
  }
}

// v-for
function genFor (el, state, altGen, altHelper) {
  /*
	v-for = "(value, key) in items"
	数据源 el.for = 'items'
	数据项 el.alias = 'value'
	数据子项 el.iterator1 = "value"
	数据子项 el.iterator2 = ""
  */
  var exp = el.for;
  var alias = el.alias;
  var iterator1 = el.iterator1 ? ("," + (el.iterator1)) : '';
  var iterator2 = el.iterator2 ? ("," + (el.iterator2)) : '';

  if ("development" !== 'production' &&
    state.maybeComponent(el) &&
    el.tag !== 'slot' &&
    el.tag !== 'template' &&
    !el.key
  ) {
    // 用 v-for 生成组件列表时，必须要有显式的 key
    state.warn(
      "<" + (el.tag) + " v-for=\"" + alias + " in " + exp + "\">: component lists rendered with " +
      "v-for should have explicit keys. " +
      "See https://vuejs.org/guide/list.html#key for more info.",
      true /* tip */
    );
  }

  // 标识执行过 genFor 函数，避免递归调用
  el.forProcessed = true; // avoid recursion
  /*
	例如：
	<div id="app">
		<a href="#" v-for="(value, key) in items">{{val}}</a>
	</div>
	这里递归调用 genElement 得到：
	"_l((items),function(value,key){return _c('a',{attrs:{"href":"#"}},[_v(_s(val))])})"
	最终返回："_c('a',{attrs:{"id":"app"}},_l((items),function(value,key){return _c('a',{attrs:{"href":"#"}},[_v(_s(val))])}))"
	最外层的 div 包 a 标签，a 标签又包含文本
  */
  return (altHelper || '_l') + "((" + exp + ")," +
    "function(" + alias + iterator1 + iterator2 + "){" +
      "return " + ((altGen || genElement)(el, state)) +
    '})'
}

/*
    返回值为这种形式：
    data: { 
      directives : someDir,
      key : someKey,
      ref :someRef,
      refInFor : true,
      pre : true,
      tag : el.tag,
      staticClass : someStaticClass,
      class : someClass,
      attrs : { name1 : val1, name2 : val2 ...},
      domProps : { name1 : val1, name2 : val2 ...},
      on:{
        'name1' : "function($event){ some code}",
        'name2' : "function($event){ some code}",
        ...
      },
      nativeOn:{
        'name1' : "function($event){ some code}",
        'name2' : "function($event){ some code}",
        ...
      },
      slot : el.slotTarget,
      scopedSlots:_u([...]),
      model:{ value : el.model.value, callback : el.model.callback, expression : el.model.expression},
      inlineTemplate:{
            render:function(){ inlineRenderFns.render},
            staticRenderFns:[(inlineRenderFns.staticRenderFns.map(function (code) { return ("function(){" + code + "}"); }).join(','))]
      }
    }
*/
// 这里的 el 指 ast
function genData$2 (el, state) {
  var data = '{';

  // directives first.
  // directives may mutate the el's other properties before they are generated.
  /*
    // 指令 
      directives : [
        {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        ...
      ],
  */
  var dirs = genDirectives(el, state);
  if (dirs) { data += dirs + ','; }

  /*
      key : someKey,
  */
  if (el.key) {
    data += "key:" + (el.key) + ",";
  }
  /*
      ref : someRef,
  */
  if (el.ref) {
    data += "ref:" + (el.ref) + ",";
  }
  /*
      refInFor : true,
  */
  if (el.refInFor) {
    data += "refInFor:true,";
  }
  /*
      pre : true,
  */
  if (el.pre) {
    data += "pre:true,";
  }
  // record original tag name for components using "is" attribute
  // 当组件用 is 属性时，记录原始的 tag 名
  /*
      tag : el.tag,
  */
  if (el.component) {
    data += "tag:\"" + (el.tag) + "\",";
  }
  // module data generation functions，模块数据
  /*
    state.dataGenFns[i] 其实是 genData 方法。genData (el) 返回 "staticClass: someStaticClass, class: someClass" 这个字符串

    staticClass: someStaticClass, 
    class: someClass,
  */
  for (var i = 0; i < state.dataGenFns.length; i++) {
    data += state.dataGenFns[i](el);
  }
  // attributes，属性
  /*
      attrs : { name1 : val1, name2 : val2 ...},
  */
  if (el.attrs) {
    data += "attrs:{" + (genProps(el.attrs)) + "},";
  }
  // DOM props
  /*
      domProps : { name1 : val1, name2 : val2 ...},
  */
  if (el.props) {
    data += "domProps:{" + (genProps(el.props)) + "},";
  }
  // event handlers，事件处理函数
  if (el.events) {
    /*
        genHandlers(el.events, false, state.warn)
        -> 'on:{
            'name1' : "function($event){ some code}",
            'name2' : "function($event){ some code}",
            ...
        }'
    */
    data += (genHandlers(el.events, false, state.warn)) + ",";
  }
  if (el.nativeEvents) {
    /*
        genHandlers(el.nativeEvents, true, state.warn)
        -> 'nativeOn:{
            'name1' : "function($event){ some code}",
            'name2' : "function($event){ some code}",
            ...
        }'
    */
    data += (genHandlers(el.nativeEvents, true, state.warn)) + ",";
  }
  /*
      slot : el.slotTarget,
  */
  if (el.slotTarget) {
    data += "slot:" + (el.slotTarget) + ",";
  }
  /*
      scopedSlots:_u([...]),
  */
  if (el.scopedSlots) {
    data += (genScopedSlots(el.scopedSlots, state)) + ",";
  }
  // component v-model
  /*
      model:{ value : el.model.value, callback : el.model.callback, expression : el.model.expression},
  */
  if (el.model) {
    data += "model:{value:" + (el.model.value) + ",callback:" + (el.model.callback) + ",expression:" + (el.model.expression) + "},";
  }
  // inline-template
  if (el.inlineTemplate) {
    /*
        inlineTemplate:{
            render:function(){ inlineRenderFns.render},
            staticRenderFns:[(inlineRenderFns.staticRenderFns.map(function (code) { return ("function(){" + code + "}"); }).join(','))]
        },
    */    
    var inlineTemplate = genInlineTemplate(el, state);
    if (inlineTemplate) {
      data += inlineTemplate + ",";
    }
  }
  // 去掉最后一个逗号
  data = data.replace(/,$/, '') + '}';
  /*
    此时的 data 结构如下：
    { 
      directives : someDir,
      key : someKey,
      ref :someRef,
      refInFor : true,
      pre : true,
      tag : el.tag,
      staticClass : someStaticClass,
      class : someClass,
      attrs : { name1 : val1, name2 : val2 ...},
      domProps : { name1 : val1, name2 : val2 ...},
      on:{
        'name1' : "function($event){ some code}",
        'name2' : "function($event){ some code}",
        ...
      },
      nativeOn:{
        'name1' : "function($event){ some code}",
        'name2' : "function($event){ some code}",
        ...
      },
      slot : el.slotTarget,
      scopedSlots:_u([...]),
      model:{ value : el.model.value, callback : el.model.callback, expression : el.model.expression},
      inlineTemplate:{
            render:function(){ inlineRenderFns.render},
            staticRenderFns:[(inlineRenderFns.staticRenderFns.map(function (code) { return ("function(){" + code + "}"); }).join(','))]
      }
    }
*/

  // v-bind data wrap
  if (el.wrapData) {
      // el.wrapData = function (code) {return ("_b(" + code + ",'" + (el.tag) + "'," + (dir.value) + "," + (dir.modifiers && dir.modifiers.prop ? 'true' : 'false') + (dir.modifiers && dir.modifiers.sync ? ',true' : '') + ")")};
      // 所以 data =  "_b(data, el.tag, dir.value, true|false, true|'')" 这里的 dir 应该是每一条指令
      data = el.wrapData(data);
  }
  // v-on data wrap
  if (el.wrapListeners) {
    // el.wrapListeners = function (code) { return ("_g(" + code + "," + (dir.value) + ")"); };
    // 所以，data = "_g(_b(data, el.tag, dir.value, true|false, true|''), dir.value)"
    data = el.wrapListeners(data);
  }
  
  return data
}

/*
    返回值：
    "directives : [
        {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        ...
    ]"
*/
function genDirectives (el, state) {
  var dirs = el.directives;
  // 没有指令，直接返回
  if (!dirs) { return }

  var res = 'directives:[';
  var hasRuntime = false;
  var i, l, dir, needRuntime;
  for (i = 0, l = dirs.length; i < l; i++) {
    dir = dirs[i];
    needRuntime = true;
    var gen = state.directives[dir.name];
    if (gen) {
      // compile-time directive that manipulates AST.
      // returns true if it also needs a runtime counterpart.
      needRuntime = !!gen(el, dir, state.warn);
    }
    if (needRuntime) {
      hasRuntime = true;
      res += "{name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},";
    }
  }
  if (hasRuntime) {
    // 'abc'.slice(0,-1) -> 'ab'（去除最后一个逗号，然后闭合 []）
    return res.slice(0, -1) + ']'
  }
}

/*
    返回值：
    "inlineTemplate:{
        render:function(){" + (inlineRenderFns.render) + "},
        staticRenderFns:[" + (inlineRenderFns.staticRenderFns.map(function (code) { return ("function(){" + code + "}"); }).join(',')) + "]
    }"
*/
function genInlineTemplate (el, state) {
  var ast = el.children[0];

  // 行内模板组件只能有一个子元素
  if ("development" !== 'production' && (el.children.length > 1 || ast.type !== 1)) {
    state.warn('Inline-template components must have exactly one child element.');
  }

  if (ast.type === 1) {
    /*
        generate 函数返回一个 json 对象：
        {
            render : "some code",
            staticRenderFns : []
        }
    */
    var inlineRenderFns = generate(ast, state.options);
    return ("inlineTemplate:{render:function(){" + (inlineRenderFns.render) + "},staticRenderFns:[" + (inlineRenderFns.staticRenderFns.map(function (code) { return ("function(){" + code + "}"); }).join(',')) + "]}")
  }
}

/*
    返回值：
    "scopedSlots:_u([...])"
*/
function genScopedSlots (slots, state) {
  return ("scopedSlots:_u([" + (Object.keys(slots).map(function (key) {
      return genScopedSlot(key, slots[key], state)
    }).join(',')) + "])")
}

/*
    ① v-for 中，返回：
    "_l( exp ,function(){ ...})"

    ② 其他情况，返回：
    "{
        key:" + key + ",
        fn:function(){...}
      }"

*/
function genScopedSlot (key, el, state) {
  if (el.for && !el.forProcessed) {
    return genForScopedSlot(key, el, state)
  }
  return "{key:" + key + ",fn:function(" + (String(el.attrsMap.scope)) + "){" +
    "return " + (el.tag === 'template'
      ? genChildren(el, state) || 'void 0'
      : genElement(el, state)) + "}}"
}

/*
    v-for 中，返回：
    "_l( exp ,function(){ ...})"
*/
function genForScopedSlot (
  key,
  el,
  state
) {
  var exp = el.for;
  var alias = el.alias;
  var iterator1 = el.iterator1 ? ("," + (el.iterator1)) : '';
  var iterator2 = el.iterator2 ? ("," + (el.iterator2)) : '';
  // 标志执行过该函数，避免递归调用
  el.forProcessed = true; // avoid recursion
  return "_l((" + exp + ")," +
    "function(" + alias + iterator1 + iterator2 + "){" +
      "return " + (genScopedSlot(key, el, state)) +
    '})'
}

// 子节点，返回值为："[,,,] , 0|1|2"
function genChildren (el, state, checkSkip, altGenElement, altGenNode) {
  var children = el.children;
  if (children.length) {
    var el$1 = children[0];
    // optimize single v-for
    // el 只有一个子元素的，并且该子元素有 v-for 指令
    if (children.length === 1 && el$1.for && el$1.tag !== 'template' && el$1.tag !== 'slot') {
      return (altGenElement || genElement)(el$1, state)
    }
    /*
        normalizationType 表示子元素数组所需的规范类型：
        0 : 不需要规范化
        1 : 需要简单的规范化处理
        2 : 全面的规范化处理

        getNormalizationType() 的返回值为 0 | 1 | 2
    */
    var normalizationType = checkSkip
      ? getNormalizationType(children, state.maybeComponent)
      : 0;

    var gen = altGenNode || genNode;
    return ("[" + (children.map(function (c) { return gen(c, state); }).join(',')) + "]" + (normalizationType ? ("," + normalizationType) : ''))
  }
}

// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
/*
    确定子元素数组所需的规范类型：
    0 : 不需要规范化
    1 : 需要简单的规范化处理
    2 : 全面的规范化处理

    返回值：0 | 1 | 2
*/
function getNormalizationType (children, maybeComponent) {
  var res = 0;
  for (var i = 0; i < children.length; i++) {
    var el = children[i];
    // 当前子元素不是 element，则跳过该元素
    if (el.type !== 1) {
      continue
    }
    
    /*
        ① el 为 <template> 或 <slot> 或 v-for 属性存在，即需要规范化
        ② el 存在 v-if 属性，并且某些 if 条件涉及到的元素满足 ①
    */
    if (needsNormalization(el) || (el.ifConditions && el.ifConditions.some(function (c) { return needsNormalization(c.block); }))) {
      res = 2;
      break
    }
    // 组件
    if (maybeComponent(el) ||
        (el.ifConditions && el.ifConditions.some(function (c) { return maybeComponent(c.block); }))) {
      res = 1;
    }
  }
  return res
}

// el 为 <template> 或 <slot> 或 v-for 属性存在，即需要规范化
function needsNormalization (el) {
  return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

// 生成节点
function genNode (node, state) {
  // element 元素
  if (node.type === 1) {
    return genElement(node, state)
  // 注释
  } if (node.type === 3 && node.isComment) {
    return genComment(node)
  // 文本
  } else {
    return genText(node)
  }
}

// 文本，"_v( someText )" 其中 _v 为（Vue.prototype._v = createTextVNode）
function genText (text) {
  return ("_v(" + (text.type === 2
    ? text.expression // no need for () because already wrapped in _s()
    : transformSpecialNewlines(JSON.stringify(text.text))) + ")")
}

// 注释，"_e( someComment )"（Vue.prototype._e = createEmptyVNode）
function genComment (comment) {
  return ("_e('" + (comment.text) + "')")
}

// 插槽，"_t(,,,)"（Vue.prototype._t = renderSlot）
function genSlot (el, state) {
  // 插槽名
  var slotName = el.slotName || '"default"';
  // 子节点
  var children = genChildren(el, state);
  var res = "_t(" + slotName + (children ? ("," + children) : '');
  // 属性
  var attrs = el.attrs && ("{" + (el.attrs.map(function (a) { return ((camelize(a.name)) + ":" + (a.value)); }).join(',')) + "}");
  // v-bind 属性
  var bind$$1 = el.attrsMap['v-bind'];
  
  if ((attrs || bind$$1) && !children) {
    res += ",null";
  }
  if (attrs) {
    res += "," + attrs;
  }
  if (bind$$1) {
    res += (attrs ? '' : ',null') + "," + bind$$1;
  }
  return res + ')'
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
// 组件，"_c(,,,)"（vm._c = function (a, b, c, d) { return createElement(vm, a, b, c, d, false); }）
function genComponent (componentName, el, state) {
  var children = el.inlineTemplate ? null : genChildren(el, state, true);
  return ("_c(" + componentName + "," + (genData$2(el, state)) + (children ? ("," + children) : '') + ")")
}

// 返回值："propName1:propValue1,propName2:propValue2,propName3:propValue3..."
function genProps (props) {
  var res = '';
  for (var i = 0; i < props.length; i++) {
    var prop = props[i];
    res += "\"" + (prop.name) + "\":" + (transformSpecialNewlines(prop.value)) + ",";
  }
  // 剔除最后一个逗号
  return res.slice(0, -1)
}

// #3895, #4268
// 这个编码为 2028 的字符为行分隔符，会被浏览器理解为换行，而在 Javascript 的字符串表达式中是不允许换行的，从而导致错误。
function transformSpecialNewlines (text) {
  return text
    // 行分隔符
    .replace(/\u2028/g, '\\u2028')
    // 段分隔符
    .replace(/\u2029/g, '\\u2029')
}

/*  */

// these keywords should not appear inside expressions, but operators like
// typeof, instanceof and in are allowed
// 以下关键词是不能出现在表达式当中的，不过，typeof、instanceof、in 等运算符是可以的
// prohibitedKeywordRE = /\bdo\b|\bif\b|\bfor\b|\blet\b|\bnew\b|\btry\b|\bvar\b|\bcase\b|\belse\b|\bwith\b|\bawait\b|\bbreak\b|\bcatch\b|\bclass\b|\bconst\b|\bsuper\b|\bthrow\b|\bwhile\b|\byield\b|\bdelete\b|\bexport\b|\bimport\b|\breturn\b|\bswitch\b|\bdefault\b|\bextends\b|\bfinally\b|\bcontinue\b|\bdebugger\b|\bfunction\b|\barguments\b/
var prohibitedKeywordRE = new RegExp('\\b' + (
  'do,if,for,let,new,try,var,case,else,with,await,break,catch,class,const,' +
  'super,throw,while,yield,delete,export,import,return,switch,default,' +
  'extends,finally,continue,debugger,function,arguments'
).split(',').join('\\b|\\b') + '\\b');

// these unary operators should not be used as property/method names
// 以下一元运算符不能被用作属性/方法名
// unaryOperatorsRE = /\bdelete\s*\([^\)]*\)|\btypeof\s*\([^\)]*\)|\bvoid\s*\([^\)]*\)/
var unaryOperatorsRE = new RegExp('\\b' + (
  'delete,typeof,void'
).split(',').join('\\s*\\([^\\)]*\\)|\\b') + '\\s*\\([^\\)]*\\)');

// check valid identifier for v-for
// 为 v-for 检测有效的标识符，A-Za-z_$ 开头，后跟若干个 \w 或 $
var identRE = /[A-Za-z_$][\w$]*/;

// strip strings in expressions
// 在表达式中剥去字符串
/*
    ① 'someString'
    ② "someString"
    ③ `someString${
    ④ }someString`
    ⑤ `someString`
*/
var stripStringRE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g;

// detect problematic expressions in a template
// 检测模板中有问题的表达式
function detectErrors (ast) {
  var errors = [];
  if (ast) {
    checkNode(ast, errors);
  }
  // 返回一个数组
  return errors
}

// 检查节点
function checkNode (node, errors) {
  // element 元素
  if (node.type === 1) {
    for (var name in node.attrsMap) {
      // dirRE = /^v-|^@|^:/
      if (dirRE.test(name)) {
        var value = node.attrsMap[name];
        if (value) {
          // v-for 列表
          if (name === 'v-for') {
            checkFor(node, ("v-for=\"" + value + "\""), errors);
          // onRE = /^@|^v-on:/ 事件
          } else if (onRE.test(name)) {
            checkEvent(value, (name + "=\"" + value + "\""), errors);
          } else {
            checkExpression(value, (name + "=\"" + value + "\""), errors);
          }
        }
      }
    }
    // 对子元素，递归调用 checkNode()
    if (node.children) {
      for (var i = 0; i < node.children.length; i++) {
        checkNode(node.children[i], errors);
      }
    }
  // 表达式
  } else if (node.type === 2) {
    checkExpression(node.expression, node.text, errors);
  }
}

// 检查事件
function checkEvent (exp, text, errors) {
  // 剔除 exp 中的字符串
  var stipped = exp.replace(stripStringRE, '');
  // unaryOperatorsRE 匹配 delete,typeof,void 等一元运算符
  var keywordMatch = stipped.match(unaryOperatorsRE);
  if (keywordMatch && stipped.charAt(keywordMatch.index - 1) !== '$') {
    // 一元运算符不能被用作属性/方法名
    errors.push(
      "avoid using JavaScript unary operator as property name: " +
      "\"" + (keywordMatch[0]) + "\" in expression " + (text.trim())
    );
  }
  checkExpression(exp, text, errors);
}

// 检查 v-for
function checkFor (node, text, errors) {
  checkExpression(node.for || '', text, errors);
  checkIdentifier(node.alias, 'v-for alias', text, errors);
  checkIdentifier(node.iterator1, 'v-for iterator', text, errors);
  checkIdentifier(node.iterator2, 'v-for iterator', text, errors);
}

// 检查标识符
function checkIdentifier (ident, type, text, errors) {
  // identRE = /[A-Za-z_$][\w$]*/
  if (typeof ident === 'string' && !identRE.test(ident)) {
    // 错误信息加到 errors 数组里
    errors.push(("invalid " + type + " \"" + ident + "\" in expression: " + (text.trim())));
  }
}

// 检查表达式
function checkExpression (exp, text, errors) {
  try {
    // 用 exp 表达式作为函数体，若报错，说明这个函数体有问题
    new Function(("return " + exp));
  } catch (e) {
    /*
        ① 把 exp 中的字符串剔除
        ② 检测是否有 do if for let 等关键词
    */
    var keywordMatch = exp.replace(stripStringRE, '').match(prohibitedKeywordRE);
    // 属性名中不能使用 JavaScript 关键词
    if (keywordMatch) {
      errors.push(
        "avoid using JavaScript keyword as property name: " +
        "\"" + (keywordMatch[0]) + "\" in expression " + (text.trim())
      );
    // 表达式错误
    } else {
      errors.push(("invalid expression: " + (text.trim())));
    }
  }
}

// 创建一个方法，以 code 为执行代码块，若出错，则返回一个空方法
function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err: err, code: code });
    return noop
  }
}

// 将 compile 转为函数
function createCompileToFunctionFn (compile) {
  // 缓存 template 对应的 json 结果
  var cache = Object.create(null);

  // 该方法会根据模板 template 返回一个 json { render:fn , staticRenderFns: [...]}
  return function compileToFunctions (template, options, vm) {
    options = options || {};

    {
      // detect possible CSP restriction
      // CSP 是由单词 Content Security Policy 的首字母组成，CSP 旨在减少跨站脚本攻击
      try {
        new Function('return 1');
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          /*
            您正在使用独立版本的 Vue.js。当前环境的“内容安全政策”禁止不安全的 eval。
            模板编译器在这样的环境里是不能生效的。可以考虑解除“内容安全政策”以支持不安全的 eval。
            或者将您的目标预编译进渲染函数也是可以的。
          */
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          );
        }
      }
    }

    // check cache
    var key = options.delimiters
      ? String(options.delimiters) + template
      : template;

    // 首先从缓存去取，取到了就返回
    if (cache[key]) {
      return cache[key]
    }

    // 第 1 步：编译
    var compiled = compile(template, options);
    /*
         compiled 结构:
         {
            ast: ast,
            render: code.render,
            staticRenderFns: code.staticRenderFns
            errors: [...],
            tips: [...]
          }
     */

    // check compilation errors/tips
    {
      // 编译出错
      if (compiled.errors && compiled.errors.length) {
        warn(
          "Error compiling template:\n\n" + template + "\n\n" +
          compiled.errors.map(function (e) { return ("- " + e); }).join('\n') + '\n',
          vm
        );
      }
      // 编译提示
      if (compiled.tips && compiled.tips.length) {
        compiled.tips.forEach(function (msg) { return tip(msg, vm); });
      }
    }

    // turn code into functions，最终返回这个 res 对象
    var res = {};
    var fnGenErrors = [];

    // 第 2 步，将代码文本转为真正的函数
    // 文本（compiled.render）-> 函数（res.render），发生的错误加入到数组 fnGenErrors 中
    res.render = createFunction(compiled.render, fnGenErrors);

    // 文本数组（compiled.staticRenderFns）-> 函数数组（res.staticRenderFns），发生的错误加入到数组 fnGenErrors 中
    res.staticRenderFns = compiled.staticRenderFns.map(function (code) {
      return createFunction(code, fnGenErrors)
    });

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    // 转化为渲染函数过程中出现的错误
    {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        // 生成渲染函数失败
        warn(
          "Failed to generate render function:\n\n" +
          fnGenErrors.map(function (ref) {
            var err = ref.err;
            var code = ref.code;

            return ((err.toString()) + " in\n\n" + code + "\n");
        }).join('\n'),
          vm
        );
      }
    }

    // 将 res 缓存下来
    return (cache[key] = res)
  }
}

// 生成编译器
function createCompilerCreator (baseCompile) {
  /*
    var baseOptions = {
      expectHTML: true,
      modules: modules$1,                    // class、style 模块
      directives: directives$1,                // model、text、html 指令
      isPreTag: isPreTag,                    // 是否为 pre 标签
      isUnaryTag: isUnaryTag,                // 是否为自闭合标签
      mustUseProp: mustUseProp,
      canBeLeftOpenTag: canBeLeftOpenTag,   // 可以省略闭合标签
      isReservedTag: isReservedTag,
      getTagNamespace: getTagNamespace,
      staticKeys: genStaticKeys(modules$1)
    };
  */
  return function createCompiler (baseOptions) {
    function compile (template, options) {
      // finalOptions 继承 baseOptions 对象
      var finalOptions = Object.create(baseOptions);

      var errors = [];
      var tips = [];

      // 向 errors/tips 数组里添加 msg
      finalOptions.warn = function (msg, tip) {
        (tip ? tips : errors).push(msg);
      };

      // 根据 options 修正 finalOptions 对象
      if (options) {
        // merge custom modules，合并自定义模块
        if (options.modules) {
          finalOptions.modules = (baseOptions.modules || []).concat(options.modules);
        }
        // merge custom directives，合并自定义指令
        if (options.directives) {
          finalOptions.directives = extend(Object.create(baseOptions.directives),options.directives);
        }
        // copy other options，合并其他 option 选项
        for (var key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key];
          }
        }
      }
      
      /*
        baseCompile (template,options) 返回：
        {
            ast: ast,
            render: code.render,
            staticRenderFns: code.staticRenderFns
         }
      */
      var compiled = baseCompile(template, finalOptions);
      {
        // detectErrors() 返回一个 error 数组
        errors.push.apply(errors, detectErrors(compiled.ast));
      }
      compiled.errors = errors;
      compiled.tips = tips;
      /*
         compiled 结构:
         {
            ast: ast,
            render: code.render,
            staticRenderFns: code.staticRenderFns
            errors: errors,
            tips: tips
          }
      */
      return compiled
    }

    // 返回一个 json 对象
    return {
      compile: compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}

/*  */

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
// createCompiler 是一个函数
var createCompiler = createCompilerCreator(function baseCompile (template,options) {
  // 将模板解析成 ast 树
  /*
    ast(即 root) 为根节点，在 start 钩子函数中有对其赋值：
    if (!root) {
        root = element;
        checkRootConstraints(root);
    }

    其中，element 结构大致如下：
    {
        type: 1,
        tag: tag,
        attrsList: 数组形式的属性列表,
        attrsMap: json 对象形式的属性列表,
        parent: currentParent,
        children: [],
        ns : 命名空间
        forbidden : 禁用
        pre : 是否有 v-pre 属性
        plain : 是否移除结构化的 attribute 和 key 后，该元素不存在属性
     }

     也就是说 ast 拥有这些属性
  */
  var ast = parse(template.trim(), options);
  // 优化 ast 树，其实就是给 ast 添加 ast.static、ast.staticInFor、ast.staticRoot 等属性，属性值为 true | false
  optimize(ast, options);
  /*
    返回一个 json 对象：
    {
        render : "some code",
        staticRenderFns : []
    }
 */
  var code = generate(ast, options);
  return {
    ast: ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
});

/* 
    ref$1 结构为：
    {
      compile: compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
*/
var ref$1 = createCompiler(baseOptions);
var compileToFunctions = ref$1.compileToFunctions;


// 根据选择器 id 获取元素，然后返回该元素的 innerHTML
var idToTemplate = cached(function (id) {
  // 根据 el 选择器，返回对应元素，如果找不到，就新创建一个 div 返回
  var el = query(id);
  return el && el.innerHTML
});

// 保存之前定义的 Vue$3.prototype.$mount
var mount = Vue$3.prototype.$mount;
// 重新定义 Vue$3.prototype.$mount，本质上还是调用 mount 方法，也就是之前定义的 Vue$3.prototype.$mount 方法
Vue$3.prototype.$mount = function (el,hydrating) {
  el = el && query(el);

  // 不能将 Vue 挂载到 <html> 或 <body>，只能挂载到普通元素上
  if (el === document.body || el === document.documentElement) {
    "development" !== 'production' && warn(
      "Do not mount Vue to <html> or <body> - mount to normal elements instead."
    );
    return this
  }

  var options = this.$options;
  // resolve template/el and convert to render function
  // 如果没有 options.render，将 template/el 转化为渲染函数
  if (!options.render) {
    var template = options.template;
    // 有模板就用模板
    if (template) {
      // 字符串模板
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          // idToTemplate(id) 根据选择器 id 获取元素，然后返回该元素的 innerHTML
          template = idToTemplate(template);
          // 如果没找到对应元素，发出警告
          if ("development" !== 'production' && !template) {
            warn(
              ("Template element not found or is empty: " + (options.template)),
              this
            );
          }
        }
      // <template> 标签，直接获取其 innerHTML 为模板
      } else if (template.nodeType) {
        template = template.innerHTML;
      // 其他都是无效的 template 选项
      } else {
        {
          warn('invalid template option:' + template, this);
        }
        return this
      }
    // 没有模板就用 el 元素的 outerHTML 作为模板
    } else if (el) {
      template = getOuterHTML(el);
    }

    // 根据模板 template 生成渲染函数
    if (template) {
      // 标记编译开始
      if ("development" !== 'production' && config.performance && mark) {
        mark('compile');
      }
    
      /*
        ref 为一个 json 对象，结果为：
        {
            render : createFunction(compiled.render, fnGenErrors),
            staticRenderFns : compiled.staticRenderFns.map(function (code) {return createFunction(code, fnGenErrors)})
        }
      */
      // 根据模板生成渲染函数 compileToFunctions (template, options, vm)
      var ref = compileToFunctions(template, {
        shouldDecodeNewlines: shouldDecodeNewlines,
        delimiters: options.delimiters,
        comments: options.comments
      }, this);

      var render = ref.render;
      var staticRenderFns = ref.staticRenderFns;
      // 修改 options 对象
      options.render = render;
      options.staticRenderFns = staticRenderFns;

      // 标记编译结束
      if ("development" !== 'production' && config.performance && mark) {
        mark('compile end');
        measure(((this._name) + " compile"), 'compile', 'compile end');
      }
    }
  }
  // 修正完 this.$options 的渲染函数，开始安装元素 el
  return mount.call(this, el, hydrating)
};

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
// 获取元素的 outerHTML，如果获取不到则获取其父元素的 innerHTML
function getOuterHTML (el) {
  if (el.outerHTML) {
    return el.outerHTML
  // 兼容 ie 中的 svg
  } else {
    var container = document.createElement('div');
    container.appendChild(el.cloneNode(true));
    return container.innerHTML
  }
}

// 编译方法挂载到全局的 Vue 下
Vue$3.compile = compileToFunctions;

return Vue$3;

})));

// 有空的时候看看 
// http://www.cnblogs.com/QH-Jimmy/p/6862539.html#3770924
// http://www.cnblogs.com/QH-Jimmy/archive/2017/05.html
// https://www.brooch.me/2017/03/17/vue-source-notes-1/
// https://www.brooch.me/tags/vue/
// https://www.gitbook.com/book/114000/read-vue-code/details
