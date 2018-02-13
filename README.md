## 目录/文件说明

**1. editorconfig 定义项目编码规范**

当多人共同开发一个项目的时候，往往会出现大家用不同编辑器的情况。那么如何让使用不同编辑器的开发者在共同开发一个项目时“无痛”地遵循编码规范(编码风格)呢？EditorConfig 能很好地解决这个问题。只需两步：

① 在项目根创建一个名为 .editorconfig 的文件。该文件的内容定义该项目的编码规范。

② 安装与编辑器对应的 EditorConfig 插件。

其工作原理是：当你在编码时，EditorConfig 插件会去查找当前编辑文件的所在文件夹或其上级文件夹中是否有 .editorconfig 文件。如果有，则编辑器的行为会与 .editorconfig 文件中定义的一致，并且其优先级高于编辑器自身的设置。

**2 . eslintignore 设置可忽略文件，这样 eslint 就不会校验这些文件代码了**

**3.  eslintrc 代码校验工具 eslint 的配置文件**

**4 . babelrc 语法编译器 babel 的配置文件**

**5. flowconfig 静态类型检测工具 flow 的配置文件**

flow 允许我们给变量添加类型，它可以在代码运行前对类型错误进行检查，包括：

- 类型错误
- 对 null 的引用
- 以及可怕的 “undefined is not a function”

**flow 的安装和使用：**

① 安装 

```
npm install --save-dev flow-bin
```

② 基本使用：

安装完成后我们在要执行静态检查的项目根目录下执行一下 flow init，之后会发现多出一个 .flowconfig 文件，这个文件告诉 Flow 在这个目录下开始检测。此外 .flowconfig 文件可以进行一下更为高级的配置，比如仅包含一些目录、忽略一下目录等等。

对于需要使用 flow 进行类型检查的 js 文件，在开头加入 @flow 的注释

```
/* @flow */
// @flow 
/* @flow weak */ （只对有加类型注解的变量进行类型检测）
```

例如：

```javascript
/* @flow */
function square (num) {  
    return num * num
}
square('2')
```

接下来执行 flow check 看一下结果：

```
3: return num * num
          ^^^ string. The operand of an arithmetic operation must be a number.
```

③ 自定义类型

很多时候，除了 number、string 这些基础类型外，我们还会有一些自定义的类型，比如：

```javascript
var someData = {
    id: 1,
    text: '选项1'
}
```

这时候可以在一个单独的文件中将 someData 申明了一个自定义类型。方式如下：

```javascript
/* /decls/data.js.flow */
declare type SomeData = {
  id: number;
  text: string;
}
```

然后在 .flowconfig 文件中引入该申明文件

```
[libs]
decls/
```

④ flow server
在大型项目中，如果每修改完代码，就执行以下 flow check ，然后等待看结果，太麻烦了。flow 为我们提供了一个 flow server ，支持在后台运行，并且只监测有修改的文件。方法很简单，只有一个命令

```
$> flow # 开启一个后台服务，输出首次检测结果
$> flow # 第二次使用 flow，连接正在运行的后台服务，输出检测结果
$> flow stop # 关闭 flow server
```

⑤ babel+flow

由于 flow 中类型注解的语法不属于 javascript 规范中的内容。所以在最终的代码中，我们需要移除 flow 的内容。flow 提供了 flow-remove-types 和 babel 插件两种方式，推荐使用 babel 插件来完成这项工作。

a. flow-remove-types。这种方法比较简单粗暴: 安装 flow-remove-types，然后执行命令：

```
$> npm install -g flow-remove-types
$> flow-remove-types src/ --out-dir build/
```

b. babel 插件。首先，安装 babel 插件，然在 babel 的 plugin 中加入该插件。

```
$> npm install babel-plugin-transform-flow-strip-types

{
  "presets":["es2015", "stage-2"],
  "plugins": ["transform-runtime", "transform-flow-strip-types"],
  "comments": false
}
```

注意：在 babel6 的 babel-preset-react 的插件中已经内置了 transform-flow-strip-types（Syntax），如果使用了 babel-preset-react 那么无需再引入 transform-flow-strip-types

**6 . gitignore 版本控制工具 git 配置忽略文件**

**7.  BACKERS.md 项目的捐款名单（backer 的意思为“支持者，赞助者”）**

**8. circle.yml 为 CircleCI 集成测试平台的配置文件**

**9.  LICENSE 该软件的使用协议和服务条款等**

**10.  package.json**

定义了这个项目所需要的各种模块，以及项目的配置信息（比如名称、版本、许可证等元数据）。npm install 命令根据这个配置文件，自动下载所需的模块，也就是配置项目所需的运行和开发环境。

vue 是用 npm 的 scripts 来定义工作流命令的。构建命令大体分为四类，dev、build、test、release。

① dev 类
vue 是用 rollup 打包的。如：

```
"dev": "rollup -w -c build/config.js --environment TARGET:web-full-dev"
```

其中：-w 是 wacth，-c 是指定 config 文件，这里的 build/config.js 就是配置文件。build/config.js 内部根据 TARGET 参数获取不同的构建配置。

② build 类

可以看到 "build:ssr"、"build:weex" 等命令本质上都是执行 "build" 命令，也就是运行 "build" 命令，所以 build 系列命令都是运行 build/build.js 这个文件。这个文件中的逻辑就是通过 build/config.js 获取所有的配置，然后串行用 rollup 打包。

③ test 类

test 系列命令是用来搞自动化测试的。不过这些命令也都不是让你自己执行的，这些都是用来搞自动化测试的，自动自动化测试的命令配置在 build/ci.sh 这个脚本文件里面。这个脚本会在 CircleCI 的 hook 中被调用。

④ release 类

release 系列命令是用来发布 release 版本的。调用了 build 文件下对应的 sh 文件。脚本里主要做了设置版本、自动化测试、构建、打 tag、提交、npm 推送这几件事。另外还提别为 weex 做了独立的发布脚本。

**11.  yarn.lock**

Yarn 类似于 npm，是一个由 Facebook 推出的新 JavaScript 包管理器。yarn.lock 锁定了安装包的精确版本以及所有依赖项。有了这个文件，你可以确定项目团队的每个成员都安装了精确的软件包版本，部署可以轻松地重现，且没有意外的 bug。

**12.  vue_code_analysis.js**

对应源代码中的 vue.js 开发版本。该文件对源代码逐行分析注释，可以直接用 <script> 标签引入该文件。

**13. 源码 src**


|——  compiler	编译器，解析模板

|——  core	Vue 核心代码

|——  platforms	不同平台下各自独有代码

|——  server	 服务器端渲染， server side render (ssr)

|——  sfc  将 .vue 文件转换为 sfc 对象（可识别组件）

|—— shared 工具函数集



下面对 core 目录简单介绍下（详细分析见源码注释）：

**1. components 目录，定义 <KeepAlive> 组件。**

**2. global-api 目录，定义以下公共方法：**

```javascript
Vue.extend( options ) // 传入一个配置对象，生成新的组件构造函数
Vue.set( target, key, value ) // 设置对象属性
Vue.delete( target, key ) // 删除对象的属性
Vue.nextTick( [callback, context] ) // 在下次 DOM 更新循环结束之后执行回调函数
Vue.use( plugin ) // 安装 Vue.js 插件
Vue.mixin( mixin ) // 全局注册一个混入，影响之后创建的每一个 Vue 实例
Vue.compile( template ) // 将字符串模板编译成渲染函数

Vue.directive( id, [definition] ) // 注册或获取全局指令（两个实参注册，一个实参获取）
Vue.component( id, [definition] ) // 注册或获取全局组件（两个实参注册，一个实参获取）
Vue.filter( id, [definition] ) // 注册或获取全局过滤器（两个实参注册，一个实参获取）
```

**3. instance 目录**

index.js 定义 Vue 构造函数
构造函数接受配置对象 options 作为实参，新建 Vue 实例。

init.js 定义 Vue.prototype._init 方法
这是 Vue 构造函数中唯一调用的一个方法，该方法完成实例的初始化以及视图初始渲染。

state.js 定义以下 5 个属性/方法：

```javascript
Vue.prototype.$data // vm.$data -> vm._data -> vm.$options.data
Vue.prototype.$props // vm.$props -> vm._props -> vm.$options.props
Vue.prototype.$set // 设置对象属性，这是全局 Vue.set 方法的别名
Vue.prototype.$delete // 删除对象属性，这是全局 Vue.delete 方法的别名
Vue.prototype.$watch // 观察一个函数返回值/表达式的值，若发生变化就触发回调函数
```

events.js 定义以下 4 个方法：

```javascript
Vue.prototype.$on // 监听自定义事件
Vue.prototype.$once // 监听自定义事件（只触发一次，然后自动解除监听）
Vue.prototype.$off // 移除自定义事件监听器
Vue.prototype.$emit // 触发事件
```

lifecycle.js 定义以下 3 个方法：

```javascript
Vue.prototype._update // 更新视图（内部方法）
Vue.prototype.$forceUpdate // 更新视图（实际上就是调用上面的 _update 方法）
Vue.prototype.$destroy // 完全销毁一个实例。清理它与其它实例的连接，解绑它的全部指令及事件监听器
```

render.js 定义以下多个渲染相关的内部方法：

```javascript
Vue.prototype.$nextTick // 将回调函数延迟到下次 DOM 更新循环之后执行（它跟全局方法 Vue.nextTick 一样，不同的是回调的 this 自动绑定到调用它的实例上）
Vue.prototype._render // 生成当前实例对应的虚拟节点 vnode
Vue.prototype._o = markOnce // 标记静态树（v-once）
Vue.prototype._n = toNumber // 转为数值
Vue.prototype._s = toString // 转为字符串
Vue.prototype._l = renderList // 渲染 v-for 列表
Vue.prototype._t = renderSlot // 渲染 <slot>
Vue.prototype._q = looseEqual // 形式上（都转为字符串后）是否相等
Vue.prototype._i = looseIndexOf // 返回元素在数组中的索引
Vue.prototype._m = renderStatic // 渲染静态树
Vue.prototype._f = resolveFilter // 根据 id 返回某个指定的过滤器
Vue.prototype._k = checkKeyCodes // 检查当前按下的键盘按键，若不是指定的键，则返回 true
Vue.prototype._b = bindObjectProps // 将 v-bind="object" 转换成 VNode 的 data
Vue.prototype._v = createTextVNode // 创建文本 VNode
Vue.prototype._e = createEmptyVNode // 创建一个空的 vNode（注释）
Vue.prototype._u = resolveScopedSlots // 返回作用域插槽渲染函数集合
Vue.prototype._g = bindObjectListeners // 将 v-on="object" 转换成 VNode 的 data
```
**4. observer 目录，讲述 Observer-Dep-Watcher 之间的三角关系**

这一部分相对独立，是学习观察者模式很好的例子，这里只介绍两个函数的执行流程：

```javascript
observe(data, true /* 作为根 data */)
```

(1) 如果 data 不是对象就返回，只有对象才继续执行后续步骤

(2) 如果 data 有对应的 Observer 实例 data.ob 那就将它作为 observe 方法返回值

(3) 如果 data 没有对应的 Observer 实例，那就执行 ob = new Observer(value)

(4) new Observer(value) 的本质是执行 ob.walk(data)

(5) 依次遍历 data 的属性 key，执行 defineReactive$$1(obj, keys[i], obj[keys[i]])

(6) defineReactive$$1 会劫持属性 key 的 get/set 操作。

(7) 当获取属性 key 时除了返回属性值，还会将 Dep.target（即与属性 key 对应的 watcher）加入到 key 的订阅者数组里（dep.depend() -> Dep.target.addDep(dep)）

(8) 当设置属性 key 时除了更新属性值外，还会由主题对象 dep 发出通知给所有的订阅者 dep.notify()

总的来说就是：observe(data) -> new Observer(data) -> defineReactive$$1()

```javascript
var watcher = new Watcher(vm, 'aaa.bbb.ccc' , cb, options);
```

(1) 执行 watcher = new Watcher() 会定义 watcher.getter = parsePath(‘aaa.bbb.ccc’)（这是一个函数），同时也会定义 watcher.value = watcher.get()，而这会触发执行 watcher.get()

(2) 执行 watcher.get() 就是执行 watcher.getter.call(vm, vm)，也就是 parsePath(‘aaa.bbb.ccc’).call(vm, vm)

(3) 执行 parsePath(‘aaa.bbb.ccc’).call(vm, vm) 会触发 vm.aaa.bbb.ccc 属性读取操作

(4) vm.aaa.bbb.ccc 属性读取会触发 aaa.bbb.cc 属性的 get 函数（在 defineReactive$$1 函数中定义）

(5) get 函数会触发 dep.depend()，也就是 Dep.target.addDep(dep)，即把 Dep.target 这个 Watcher 实例添加到 dep.subs 数组里（也就是说，dep 可以发布消息通知给订阅者 Dep.target）

(6) 那么 Dep.targe 又是什么呢？其实 (2) 中执行 watcher.get() 之前已经将 Dep.target 锁定为当前 watcher（等到 watcher.get() 执行结束时释放 Dep.target）

(7) 于是，watcher 就加入了 aaa.bbb.ccc 属性的订阅数组，也就是说 watcher 对 aaa.bbb.ccc 属性感兴趣

(8) 当给 aaa.bbb.ccc 属性赋值时，如 vm.aaa.bbb.ccc = 100 会触发 vm 的 aaa.bbb.ccc 属性的 set 函数（在 defineReactive$$1 函数中定义）

(9) set 函数触发 dep.notify()

(10) 执行 dep.notify() 就会遍历 dep.subs 中的所有 watcher，并依次执行 watcher.update()

(11) 执行 watcher.update() 又会触发 watcher.run()

(12) watcher.run() 触发 watcher.cb.call(watcher.vm, value, oldValue);

**5. util 目录**

debug.js 定义 3 个辅助调试的方法：

```javascript
warn(msg, vm) // 打印警告信息
tip(msg, vm) // 打印提示信息
formatComponentName(vm, includeFile) // 返回格式化的字符串形式组件名
```

env.js 做一些环境相关的功能嗅探和兼容性处理，例如对象是否原生支持 watch 方法，事件监听是否支持 Passive 模式，当前是否处在服务器环境，以及封装 nextTick 函数和 _Set 类。这里着重说一说 nextTick 函数的。

原函数代码比较多，为了便于理解，这里做个简化：

```javascript
var callbacks = [];
var pending = false;
var timerFunc;

function nextTickHandler () {
    /* 依次执行 callbacks 队列中的函数，并清空该队列，解锁 */
}
timerFunc = function () {
    /* 异步执行 nextTickHandler() */
};
var nextTick = function queueNextTick (cb, ctx) {
    var _resolve;
    /* 将匿名函数封装 cb/_resolve，并推入 callbacks 队列 */
    callbacks.push(function () {
      if (cb) {
        cb.call(ctx);
      } else if (_resolve) {
        _resolve(ctx);
      }
    });
    /* 执行 timerFunc() 并上锁 */
    if (!pending) {
      pending = true;
      timerFunc();
    }
    /* 参数为空并且不支持 Promise */
    if (!cb && typeof Promise !== 'undefined') {
      return new Promise(function (resolve, reject) {
        /* 于是可以用 _resolve 方法来触发 Promise 实例的 then 回调 */
        _resolve = resolve;
      })
    }
}
```

总结一下 nextTick 函数的用法：

```javascript
var nextTick = function queueNextTick (cb, ctx) {...}
```

a) 若 cb 参数不存在或当前环境不支持 Promise，则没有指定返回值，也就是 undefined；

b) 否则，返回一个 promise 实例

也就是说：

① nextTick 方法有实参时，将实参加入回调函数队列 callbacks，然后在本轮DOM 更新循环结束后，依次执行回调队列 callbacks 中的函数；

② nextTick 方法没有实参时，返回一个 Promise 实例。可以为该实例添加 then 回调，待队列 callbacks 中函数执行 _resolve(ctx) 时触发 then 的回调方法

options.js 定义各个选项合并策略，简单地说就是：每个组件构造函数原本都有一些选项，新建组件实例的时候又会传入选项配置对象，这就涉及到选项之间的合并问题。在这里是这么处理的：

```javascript
// 1. 初始化合并策略对象
config.optionMergeStrategies = Object.create(null)
strats = config.optionMergeStrategies

// 2. 逐步添加各个选项的合并策略
strats.el = strats.propsData = function (parent, child, vm, key) {...}
strats.data = function (parentVal, childVal, vm) {...}

[
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
].forEach(hook => {
  strats[hook] = mergeHook
})

[
 'component',
 'directive',
 'filter'
].forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

strats.watch = function (parentVal, childVal) {...}

strats.props =
strats.methods =
strats.inject =
strats.computed = function (parentVal: ?Object, childVal: ?Object): ?Object {
  ...
}
strats.provide = mergeDataOrFn

/*
  可以看到，逐步给 strats 添加合并方法（不同的属性，对应的合并策略不太一样）
  这些方法的形式都很统一：f(parentVal, childVal, vm ,key) ，最多四个参数，一般两个参数就行。
 */

// 3. 合并选项对象（简化的 mergeOptions 方法）
function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {

  /* 打印出不合要求的组件名 */

  /* 修正 child 对象 */

  /* 
     将 child.props 的每一项都格式化成对象格式
     将数组 child.inject 转化为对象格式
     将 child.directives 的每一项都格式化成对象格式
  */

  /* 递归 mergeOptions() 修正 parent 对象 */

  const options = {}
  let key

  // ① 遍历 parent 对象的属性，合并
  for (key in parent) {
    mergeField(key)
  }

  // ② 遍历 (child - parent) 差集的属性，合并
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }

  // 合并 key 选项
  function mergeField (key) {
    /*    
      其中 defaultStrat(parentVal, childVal) 是一个函数，默认合并策略函数
      也就是说，如果没有对某个 key 选项指定合并策略，就用默认的策略 defaultStrat
    */
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }

  return options
}
```

props.js 提供一个对外方法

```javascript
validateProp(key, propOptions, propsData, vm)
/*
  该函数执行流程为：
  ① 若属性约束条件 propOptions 规定属性 key 是布尔值，那就修正属性值为 true/false
  ② 若 propsData 中取到的 key 对应的属性值是 undefined，那就取约束条件中的默认值
  ③ 依据约束条件 propOptions 对属性是否必需，类型是否匹配，能都通过校验函数等检查
  ④ 返回属性值
 */
```

另外，error.js 定义错误处理函数 handleError、lang.js 定义几个全局的工具方法、pref.js 定义 mark、measure 等两个耗时计算辅助方法。

**6. vdom 目录**

vnode.js 定义虚拟节点 VNode 构造函数以及相关 api

```javascript
VNode = function VNode (
  tag,
  data,
  children,
  text,
  elm,
  context,
  componentOptions,
  asyncFactory
)

createEmptyVNode(text) // 创建文本空虚拟节点
createTextVNode(val) // 创建文本虚拟节点
cloneVNode(vnode) // 克隆虚拟节点
cloneVNodes(vnodes) // 克隆一组虚拟节点

// 注意 vnode 必须是唯一的，所以克隆时必须新建一个完全独立的 vnode，而不能通过浅拷贝方式共用
```

create-component.js 对外提供两个方法：

```javascript
// 创建组件节点，返回 vnode
createComponent (Ctor, data, context, children, tag)

// 创建与 vnode 对象的组件实例
createComponentInstanceForVnode (vnode, parent, parentElm, refElm)

```

create-element.js 对外提供一个方法：

```javascript
// 创建元素节点，返回 vnode
_createElement (context, tag, data, children, normalizationType)

// 该函数的作用是生成 vnode，分为以下几类：

// ① data && data.\_\_ob\_\_ 存在：
return createEmptyVNode()

// ② !tag 即 tag 不存在：
return createEmptyVNode()

// ③ tag 是 html/svg 内置标签名：
return vnode = new VNode(config.parsePlatformTagName(tag), data, children, undefined, undefined, context);

// ④ tag 是组件标签名（字符串）：
return vnode = createComponent(resolveAsset(context.$options, 'components', tag), data, context, children, tag);

// ⑤ tag 是其他字符串：
return vnode = new VNode(tag, data, children, undefined, undefined, context);

// ⑥ tag 是构造函数名：
return vnode = createComponent(tag, data, context, children);

// 可以看出，除了直接调用 new VNode() 生成 vnode，还有就是用 createComponent() 和 createEmptyVNode() 来生成 vnode 
```

create-functional-component.js 对外提供一个方法：

```javascript
// 创建函数式组件节点，返回 vnode
createFunctionalComponent (Ctor, propsData, data, context, children)

/*
  函数式组件和普通组件定义的不同点体现在：

  1. 选项对象中显式指定 functional: true
  2. render 函数多一个参数 context 代表上下文
     其中，context 提供以下属性给组件使用：
     props：提供 props 的对象
     children: VNode 子节点的数组
     slots: slots 对象
     data：传递给组件的 data 对象
     parent：对父组件的引用
     listeners: 一个包含了组件上所注册的 v-on 侦听器的对象。这只是一个指向 data.on 的别名。
     injections: 如果使用了 inject 选项，则该对象包含了应当被注入的属性。
 */
```

patch.js 对外提供一个方法 createPatchFunction(backend) 这个方法非常非常长，长得看起来想吐，但是这个方法很重要，为了便于理解，将其简化为：

```javascript
export function createPatchFunction (backend) {

    /* 初始化 cbs = {...} */

    // 定义以下方法
    function emptyNodeAt (elm){...}
    function createRmCb (childElm, listeners){...}
    function removeNode (el){...}
    function createElm (vnode, insertedVnodeQueue, parentElm, refElm, nested) {...}
    function createComponent (vnode, insertedVnodeQueue, parentElm, refElm){...}
    function initComponent (vnode, insertedVnodeQueue){...}
    function reactivateComponent (vnode, insertedVnodeQueue, parentElm, refElm)
    function insert (parent, elm, ref$$1){...}
    function createChildren (vnode, children, insertedVnodeQueue){...}
    function isPatchable (vnode){...}
    function invokeCreateHooks (vnode, insertedVnodeQueue){...}
    function setScope (vnode){...}
    function addVnodes(parentElm,refElm,vnodes,startIdx,endIdx,insertedVnodeQueue){...}
    function invokeDestroyHook (vnode){...}
    function removeVnodes (parentElm, vnodes, startIdx, endIdx){...}
    function removeAndInvokeRemoveHook (vnode, rm){...}
    function updateChildren(parentElm,oldCh,newCh,insertedVnodeQueue,removeOnly){...}
    function patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly)
    function invokeInsertHook (vnode, queue, initial){...}
    function hydrate (elm, vnode, insertedVnodeQueue){...}
    function assertNodeMatch (node, vnode){...}

    // 最后返回 patch 函数
    return function patch (oldVnode,vnode,hydrating,removeOnly,parentElm,refElm){...}
}

// 再简化一点：
export function createPatchFunction (backend) {
    // ...
    return function patch (oldVnode,vnode,hydrating,removeOnly,parentElm,refElm){...}
}

// 实际调用时：
var patch = createPatchFunction({ nodeOps: nodeOps, modules: modules });
/* 
  其中：
  ① nodeOps 对象封装了 dom 操作相关方法
  ② modules 为属性、指令等相关的生命周期方法
*/
```

好，继续看看 patch 方法是什么鬼：

```
patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm)
```

其中：

① oldVnode 可能是 VNode 实例，也可能是 dom 元素

② vnode 为新的 VNode 实例

③ hydrating 为 true 才执行 hydrate() 函数“注水”，这里的 oldVnode 就是 dom 元素

④ removeOnly 该参数只用于 <transition-group> 中，确保被移除的元素在离开时保持相对正确的位置

⑤ parentElm 为 dom 元素，它将作为虚拟 vnode 生成的 dom 元素的父元素

⑥ refElm 作为 vnode 生成的 dom 元素插入父元素 parentElm 时的参考节点（插入 refElm 元素之前）

**一言以蔽之，patch 函数的作用就是根据虚拟节点 vnode 来生成 dom 树并更新视图，最后返回该 dom 树。**

**7. config.js 全局配置**

```javascript
{
  // 选项合并策略
  optionMergeStrategies: Object.create(null),

  // 是否打印警告日志
  silent: false,

  /*
     若该值为 true，那么在开发模式下会出现提示：
     当前为开发模式，若需要部署生产模式代码别忘了开启生产模式开关
   */
  productionTip: process.env.NODE_ENV !== 'production',

  // 是否开启 devtools（一种专门针对 Vue.js 的控制台调试工具）
  devtools: process.env.NODE_ENV !== 'production',

  // 是否记录耗时等性能数据
  performance: false,

  // 错误处理函数
  errorHandler: null,

  // 警告处理函数
  warnHandler: null,

  // 规定可以忽略的自定义元素。要不然 Vue 会认为是你忘记注册该组件或组件名拼错了，并抛警告。
  ignoredElements: [],

  // 给 v-on 自定义键位别名
  keyCodes: Object.create(null),

  // 检验该标签是否为保留标签（和当前平台有关）
  isReservedTag: no,

  // 检验该属性名是否为保留属性（和当前平台有关）
  isReservedAttr: no,

  // 检验该元素是否为未知元素（和当前平台有关）
  isUnknownElement: no,

  // 获取标签的命名空间，也可以理解为获取标签的文档类型（html、svg 等等）
  getTagNamespace: noop,

  // 在特点平台下解析真正的标签名
  parsePlatformTagName: identity,

  // 检查某个 attr，看其是否应该用 prop，例如 value
  mustUseProp: no,

  // 生命周期钩子函数名组成的数组
  _lifecycleHooks: LIFECYCLE_HOOKS
}
```

**8. index.js 导出 Vue**

```javascript
// ① 引入 Vue 构造函数，此时的 Vue 只添加了 Vue.prototype._init 等原型（实例）方法
import Vue from './instance/index'

// ② 将静态方法挂载在 Vue 上，于是就有了 Vue.extend 等全局 API
initGlobalAPI(Vue)

// ③ 定义实例属性 Vue.prototype.$isServer、Vue.prototype.$ssrContext

// ④ 定义当前 Vue 版本号（构建的时候会调用 build/config.js，将 __VERSION__ 替换为实际的版本号）
Vue.version = '__VERSION__'

// ⑤ 导出 Vue
```

篇幅有点长，暂时到这里，如有需要再对本文进行补充。更详细的注解直接看源代码注释。

参考：
1. https://cn.vuejs.org/
2. http://www.jianshu.com/p/712cea0ef70e
3. https://zhuanlan.zhihu.com/p/24649359?utm_source=tuicool&utm_medium=referral
4. http://www.jianshu.com/p/41f9d7461844
5. https://segmentfault.com/a/1190000006983211
6. https://www.brooch.me/2017/03/17/vue-source-notes-1/
7. https://www.brooch.me/tags/vue/
8. https://www.gitbook.com/book/114000/read-vue-code/details
9. http://www.cnblogs.com/QH-Jimmy/archive/2017/05.html
