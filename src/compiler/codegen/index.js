/* @flow */

import { genHandlers } from './events'
import baseDirectives from '../directives/index'
import { camelize, no, extend } from 'shared/util'
import { baseWarn, pluckModuleFunction } from '../helpers'

type TransformFunction = (el: ASTElement, code: string) => string;
type DataGenFunction = (el: ASTElement) => string;
type DirectiveFunction = (el: ASTElement, dir: ASTDirective, warn: Function) => boolean;



// 代码生成状态管理
export class CodegenState {
  options: CompilerOptions;
  warn: Function;
  transforms: Array<TransformFunction>;
  dataGenFns: Array<DataGenFunction>;
  directives: { [key: string]: DirectiveFunction };
  maybeComponent: (el: ASTElement) => boolean;
  onceId: number;
  staticRenderFns: Array<string>;

  constructor (options: CompilerOptions) {
    this.options = options
    this.warn = options.warn || baseWarn

    // 返回一个 module['transformCode'] 组成的数组，即 [ module1.transformCode,  module2.transformCode,  module2.transformCode, ...]
    this.transforms = pluckModuleFunction(options.modules, 'transformCode')
    
    // 返回一个 module['genData'] 组成的数组，即 [ module1.genData,  module2.genData,  module2.genData, ...]
    this.dataGenFns = pluckModuleFunction(options.modules, 'genData')
    
    /*
      var baseDirectives = {
        on: on,
        bind: bind$1,
        cloak: noop 
      }; 
    */
    this.directives = extend(extend({}, baseDirectives), options.directives)
    const isReservedTag = options.isReservedTag || no
    
    // 若元素标签不是保留标签，那就认为该元素可能是组件
    this.maybeComponent = (el: ASTElement) => !isReservedTag(el.tag)
    this.onceId = 0
    this.staticRenderFns = []
  }
}

export type CodegenResult = {
  render: string,
  staticRenderFns: Array<string>
};

/*
    返回 json 对象：
    {
      render: `with(this){return someCode}`,
      staticRenderFns: [stringCode1, stringCode2, ...]
    }
 */
export function generate (
  ast: ASTElement | void,
  options: CompilerOptions
): CodegenResult {
  const state = new CodegenState(options)
  /*
      ① ast 存在，调用 genElement(ast, state) 生成节点树代码
      ② 否则，返回一个创建空 div 的代码 '_c("div")'
   */
  const code = ast ? genElement(ast, state) : '_c("div")'
  return {
    /*
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
    */
    render: `with(this){return ${code}}`,
    staticRenderFns: state.staticRenderFns
  }
}

/*
    对于模板：
    div id='app'>
        <div @click.self.ctrl='click'>
            {{computedValue | filter}}
        </div>
    </div>

    得到的 render 为:
    `with(this) {
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
    }`
 */

/* 
  返回渲染函数执行代码（字符串形式的浏览器可执行代码）。这里的 el 指 ast
  最终返回值形如："_c(el.tag ,data, children)"
*/
export function genElement (el: ASTElement, state: CodegenState): string {
  // 1. 静态节点
  if (el.staticRoot && !el.staticProcessed) {
    return genStatic(el, state)
  // 2. v-once
  } else if (el.once && !el.onceProcessed) {
    return genOnce(el, state)
  // 3. v-for
  } else if (el.for && !el.forProcessed) {
    return genFor(el, state)
  // 4. v-of
  } else if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  // 5. 模板，只生成子元素就好了（当前 <template> 元素不用管）
  } else if (el.tag === 'template' && !el.slotTarget) {
    return genChildren(el, state) || 'void 0'
  // 6. 插槽
  } else if (el.tag === 'slot') {
    return genSlot(el, state)
  // 7. 元素/组件
  } else {

    let code
    // ① 组件
    if (el.component) {
      code = genComponent(el.component, el, state)
    // ② 元素
    } else {
      // 若 el.plain 为 false，那就是没属性，没必要去解析 data 了
      const data = el.plain ? undefined : genData(el, state)
      /*
          <div>
            <my-component inline-template>
              <div>
                <p>这些将作为组件自身的模板。</p>
                <p>而非父组件透传进来的内容。</p>
              </div>
            </my-component>
          </div>
          内联模板组件的内容属于组件自身，而属于父组件，所以解析 div 时不应该解析内联模板内容
       */
      const children = el.inlineTemplate ? null : genChildren(el, state, true)
      
      /*
          code = "_c('" + (el.tag) + "'" +  ("," + data)  + ("," + children) + ")"
          其中，_c 就是 createElement。
          createElement( tag, data, children) 生成模板
          其中：
          tag :  一个 HTML 标签字符串，组件选项对象，或者一个返回值类型为 String/Object 的函数，必要参数
          data : 一个包含模板相关属性的数据对象。这样，您可以在 template 中使用这些属性。可选参数。
          children : 子节点。可选参数
      */
      code = `_c('${el.tag}'${
        data ? `,${data}` : '' // data
      }${
        children ? `,${children}` : '' // children
      })`
    }

    // module transforms
    for (let i = 0; i < state.transforms.length; i++) {
      // state.transforms 是一个 module['transformCode'] 组成的数组，即 [ module1.transformCode,  module2.transformCode,  module2.transformCode, ...]
      code = state.transforms[i](el, code)
    }

    return code
  }
}

// hoist static sub-trees out
// 生成静态树
function genStatic (el: ASTElement, state: CodegenState): string {
  el.staticProcessed = true
  /*
      Vue.prototype._m = renderStatic 
      其中 renderStatic(index, isInFor) 第一个参数 index 为数值形式的索引
   */
  // ① 当前静态树的生成代码存进 state.staticRenderFns 数组（代码执行后才能生成静态树）
  state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`)
  // ② 返回当前索引对应的静态树
  return `_m(${state.staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}

// v-once
function genOnce (el: ASTElement, state: CodegenState): string {
  // 标记执行过 genOnce 函数
  el.onceProcessed = true
  
  // ① 优先处理 v-if
  if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  // ② v-for 中的静态节点
  } else if (el.staticInFor) {
    let key = ''
    let parent = el.parent

    // 若某个祖先元素有 v-for 指令，那就取出该祖先元素的 key 值
    while (parent) {
      if (parent.for) {
        key = parent.key
        break
      }
      parent = parent.parent
    }

    /*
        若 key 值还是为空，说明没有一个祖先元素有 v-for 指令
        而 v-once 元素只能在带 key 值的 v-for 元素里
     */
    if (!key) {
      process.env.NODE_ENV !== 'production' && state.warn(
        `v-once can only be used inside v-for that is keyed. `
      )
      return genElement(el, state)
    }

    /*
        Vue.prototype._o = markOnce
        function markOnce (tree, index, key) {
          markStatic(tree, ("__once__" + index + (key ? ("_" + key) : "")), true);
          return tree
        }

        所以这里先标记这棵树为静态树，然后返回这棵树
     */
    return `_o(${genElement(el, state)},${state.onceId++}${key ? `,${key}` : ``})`
  // ③ 返回生成静态树
  } else {
    return genStatic(el, state)
  }
}

// 实际调用 genIfConditions()
export function genIf (
  el: any,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  el.ifProcessed = true // avoid recursion
  return genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)
}

/*
    ① condition.exp 为 true，返回值可能为：
        `condition.exp ? genOnce(el, state) : genIfConditions(conditions, state, altGen, altEmpty)`
    ② condition.exp 为 false，返回值可能为：
        `genOnce(el, state)`
 */
function genIfConditions (
  conditions: ASTIfConditions,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  if (!conditions.length) {
    // Vue.prototype._e = createEmptyVNode
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

    这里出栈第一个元素
   */
  const condition = conditions.shift()
  if (condition.exp) {
    /*
        ① condition.exp 为 true，返回值可能为：
        `condition.exp ? genOnce(el, state) : genIfConditions(conditions, state, altGen, altEmpty)`
     */
    return `(${condition.exp})?${
      genTernaryExp(condition.block)
    }:${
      genIfConditions(conditions, state, altGen, altEmpty)
    }`
  } else {
    /*
        ② condition.exp 为 false，返回值可能为：
        `genOnce(el, state)`
     */
    return `${genTernaryExp(condition.block)}`
  }

  // v-if with v-once should generate code like (a)?_m(0):_m(1)
  /*
      生成 3 元表达式：
      ① altGen 存在
         返回 altGen(el, state)
      ② altGen 不存在
         a. el.once 存在，返回 genOnce(el, state)
         b. el.once 不存在，返回 genElement(el, state)
  */
  function genTernaryExp (el) {
    return altGen
      ? altGen(el, state)
      : el.once
        ? genOnce(el, state)
        : genElement(el, state)
  }
}

/*
    返回值形如：
    `_l(exp, function(alias, iterator1, iterator2){
          return ${(altGen || genElement)(el, state)
    })`
 */
export function genFor (
  el: any,
  state: CodegenState,
  altGen?: Function,
  altHelper?: string
): string {
  /*
      v-for = "(value, key) in items"
      数据源 el.for = 'items'
      数据项 el.alias = 'value'
      数据子项 el.iterator1 = "key"
      数据子项 el.iterator2 = ""
  */
  const exp = el.for
  const alias = el.alias
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

  // 警告：用 v-for 生成组件列表时，必须要有显式的 key
  if (process.env.NODE_ENV !== 'production' &&
    state.maybeComponent(el) &&
    el.tag !== 'slot' &&
    el.tag !== 'template' &&
    !el.key
  ) {
    state.warn(
      `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
      `v-for should have explicit keys. ` +
      `See https://vuejs.org/guide/list.html#key for more info.`,
      true /* tip */
    )
  }

  // 标识执行过 genFor 函数，避免递归调用
  el.forProcessed = true // avoid recursion

  /*
      `_l(exp, function(alias, iterator1, iterator2){
          return ${(altGen || genElement)(el, state)
      })`

      Vue.prototype._l = renderList

      renderList(val,render) 渲染 v-for 列表，返回数组 ret，该数组元素是 render 函数执行结果
      以 val 是对象为例，ret[i] = render(val[key], key, i)

      例如：
      <div id="app">
        <a href="#" v-for="(value, key) in items">{{val}}</a>
      </div>
      最外层的 div 包 a 标签，a 标签又包含文本：
      ① v-for 返回："_l((items),function(value,key){return _c('a',{attrs:{"href":"#"}},[_v(_s(val))])})"
      ② 整个 div 返回："_c('a',{attrs:{"id":"app"}},_l((items),function(value,key){return _c('a',{attrs:{"href":"#"}},[_v(_s(val))])}))"
   */
  return `${altHelper || '_l'}((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
      `return ${(altGen || genElement)(el, state)}` +
    '})'
}

/*
    返回值 data 为这种形式：
    `{ 
      directives : [
          {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
          {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
          ...
      ],
      key : el.key,
      ref : el.ref,
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
      scopedSlots : _u([
          {
              key:key1,
              fn:function(){}
          },
          {
              key:key2,
              fn:function(){}
          }
          ...
      ]),
      model:{ 
          value : el.model.value, 
          callback : el.model.callback, 
          expression : el.model.expression
      },
      inlineTemplate:{
          render:function(){someCode},
          staticRenderFns:[function(){${code}}, function(){${code}}...]
      }
    }`
*/
export function genData (el: ASTElement, state: CodegenState): string {
  let data = '{'

  // directives first.
  // directives may mutate the el's other properties before they are generated.
  const dirs = genDirectives(el, state)
  if (dirs) data += dirs + ','

  // key
  if (el.key) {
    data += `key:${el.key},`
  }
  // ref
  if (el.ref) {
    data += `ref:${el.ref},`
  }
  if (el.refInFor) {
    data += `refInFor:true,`
  }
  // pre
  if (el.pre) {
    data += `pre:true,`
  }
  // record original tag name for components using "is" attribute
  if (el.component) {
    data += `tag:"${el.tag}",`
  }

  // module data generation functions
  for (let i = 0; i < state.dataGenFns.length; i++) {
    /*
        state.dataGenFns = pluckModuleFunction(options.modules, 'genData');
        返回各个 module['genData'] 组成的数组，即 [ module1.genData,  module2.genData,  module2.genData, ...]
     */
    data += state.dataGenFns[i](el)
  }


  // attributes
  if (el.attrs) {
    /*
        genProps(props: Array<{ name: string, value: string }>) 函数返回值为：
        `"propName1":propValue1,"propName2":propValue2,"propName3":propValue3...`
     */
    data += `attrs:{${genProps(el.attrs)}},`
  }
  // DOM props
  if (el.props) {
    data += `domProps:{${genProps(el.props)}},`
  }

  /*
      function genHandlers (
        events: ASTElementHandlers,
        isNative: boolean,
        warn: Function
      )
      返回值为：
      ① isNative 为 false
      'on:{
          'name1' : "function($event){ some code }",
          'name2' : "function($event){ some code }",
          'name3' : "function($event){ some code }"
          ...
      }'
      ② isNative 为 true
      'nativeOn:{
          'name1' : "function($event){ some code }",
          'name2' : "function($event){ some code }",
          'name3' : "function($event){ some code }"
          ...
      }'
   */
  // event handlers
  if (el.events) {
    data += `${genHandlers(el.events, false, state.warn)},`
  }
  if (el.nativeEvents) {
    data += `${genHandlers(el.nativeEvents, true, state.warn)},`
  }

  // slot target
  if (el.slotTarget) {
    data += `slot:${el.slotTarget},`
  }
  // scoped slots
  if (el.scopedSlots) {
    data += `${genScopedSlots(el.scopedSlots, state)},`
  }
  // component v-model
  if (el.model) {
    data += `model:{value:${
      el.model.value
    },callback:${
      el.model.callback
    },expression:${
      el.model.expression
    }},`
  }
  // inline-template
  if (el.inlineTemplate) {
    const inlineTemplate = genInlineTemplate(el, state)
    if (inlineTemplate) {
      data += `${inlineTemplate},`
    }
  }

  // 去掉最后的的逗号，并闭合 {}
  data = data.replace(/,$/, '') + '}'

  // v-bind data wrap
  if (el.wrapData) {
    /*
        el.wrapData = function (code) {return ("_b(" + code + ",'" + (el.tag) + "'," + (dir.value) + "," + (dir.modifiers && dir.modifiers.prop ? 'true' : 'false') + (dir.modifiers && dir.modifiers.sync ? ',true' : '') + ")")};
        所以 data =  "_b(data, el.tag, dir.value, true|false, true|'')" 这里的 dir 应该是每一条指令
     
        Vue.prototype._b = bindObjectProps;
        该函数作用是将 v-bind="object" 转换成 VNode 的 data，简单的说：
        v-bind 指令的值 object 对象就是参数 value，根据这个 value 对象的值对 data 对象进行修正，最后返回 data 对象     
        
        这个操作会覆盖之前的 json 形式的 data
     */
    data = el.wrapData(data)
  }


  // v-on data wrap
  if (el.wrapListeners) {
    /*
        el.wrapListeners = function (code) { return ("_g(" + code + "," + (dir.value) + ")"); };
        所以 data = "_g(data, dir.value)"

        Vue.prototype._g = bindObjectListeners;
        该函数作用是将 v-on="object" 转换成 VNode 的 data，简单的说：
        v-on 指令的值 object 对象就是参数 value，然后根据 value 对象的值对 data.on 进行修正，最后返回 data 对象
        
        这个操作同样会覆盖之前的 data
   */
    data = el.wrapListeners(data)
  }
  return data
}

/*
    生成指令，返回值形如：
    "directives : [
        {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        {name:\"" + (dir.name) + "\",rawName:\"" + (dir.rawName) + "\"" + (dir.value ? (",value:(" + (dir.value) + "),expression:" + (JSON.stringify(dir.value))) : '') + (dir.arg ? (",arg:\"" + (dir.arg) + "\"") : '') + (dir.modifiers ? (",modifiers:" + (JSON.stringify(dir.modifiers))) : '') + "},
        ...
    ]"
 */
function genDirectives (el: ASTElement, state: CodegenState): string | void {
  const dirs = el.directives
  if (!dirs) return

  let res = 'directives:['
  let hasRuntime = false
  let i, l, dir, needRuntime

  for (i = 0, l = dirs.length; i < l; i++) {
    dir = dirs[i]
    needRuntime = true

    /*
        state.directives = extend(extend({}, baseDirectives), options.directives)
        baseDirectives = {
          on: on,
          bind: bind$1,
          // function noop (a, b, c) {}
          cloak: noop 
        }
        以 on 为例：
        执行 gen(el, dir, state.warn) 会给 el 添加 wrapData 属性：
        el.wrapData = function (code) {
          return ("_b(" + code + ",'" + (el.tag) + "'," + (dir.value) + "," + (dir.modifiers && dir.modifiers.prop ? 'true' : 'false') + (dir.modifiers && dir.modifiers.sync ? ',true' : '') + ")")
        };
     */
    const gen: DirectiveFunction = state.directives[dir.name]
    if (gen) {
      // compile-time directive that manipulates AST.
      // returns true if it also needs a runtime counterpart.
      needRuntime = !!gen(el, dir, state.warn)
    }

    if (needRuntime) {
      hasRuntime = true
      res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
        dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
      }${
        dir.arg ? `,arg:"${dir.arg}"` : ''
      }${
        dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
      }},`
    }
  }

  // 去掉最后一个逗号，然后闭合 []
  if (hasRuntime) {
    return res.slice(0, -1) + ']'
  }
}


/*
    生成内联模板，返回值形如：
    `inlineTemplate:{
        render:function(){someCode},
        staticRenderFns:[function(){${code}}, function(){${code}}...]
    }`
 */
function genInlineTemplate (el: ASTElement, state: CodegenState): ?string {
  const ast = el.children[0]

  /*
      如果子组件有 inline-template 特性，组件将把它的内容当作它的模板，而不是把它当作分发内容。
      例如：
      <my-component inline-template>
        <div>
          <p>这些将作为组件自身的模板。</p>
          <p>而非父组件透传进来的内容。</p>
        </div>
      </my-component>
   */

  // 内联模板只能有一个元素
  if (process.env.NODE_ENV !== 'production' && (
    el.children.length > 1 || ast.type !== 1
  )) {
    state.warn('Inline-template components must have exactly one child element.')
  }

  // 第一个子元素必须是元素才处理（不能是文本或注释）
  if (ast.type === 1) {
    /*
        generate 函数返回一个 json 对象：
        {
            render : "some code",
            staticRenderFns : []
        }
    */
    const inlineRenderFns = generate(ast, state.options)

    return `inlineTemplate:{render:function(){${
      inlineRenderFns.render
    }},staticRenderFns:[${
      inlineRenderFns.staticRenderFns.map(code => `function(){${code}}`).join(',')
    }]}`
  }
}

/*
    生成作用域插槽，返回值形如：
    `scopedSlots : _u([
        {
            key:key1,
            fn:function(){}
        },
        {
            key:key2,
            fn:function(){}
        }
        ...
    ])`
 */
function genScopedSlots (
  slots: { [key: string]: ASTElement },
  state: CodegenState
): string {
  return `scopedSlots:_u([${
    Object.keys(slots).map(key => {
      return genScopedSlot(key, slots[key], state)
    }).join(',')
  }])`
}


/*
    生成一个作用域插槽

    ① v-for 中，返回：
    "_l( exp ,function(){ ...})"

    ② 一般情况，返回：
    `{
        key:" + key + ",
        fn:function(){
          el.tag === 'template'
            ? genChildren(el, state) || 'void 0'
            : genElement(el, state))
        }
    }`
*/
function genScopedSlot (
  key: string,
  el: ASTElement,
  state: CodegenState
): string {
  if (el.for && !el.forProcessed) {
    return genForScopedSlot(key, el, state)
  }
  /*
      在父级中，具有特殊特性 scope 的 <template> 元素必须存在，表示它是作用域插槽的模板。
      scope 的值将被用作一个临时变量名，此变量接收从子组件传递过来的 prop 对象

      ① 对于这种 <template> 元素，只需要生成其子元素就好了
         <template slot-scope="props">
           <span>hello from parent</span>
           <span>{{ props.text }}</span>
         </template> 
      ② 对于其他的元素，要生成自身以及子元素
         <div>
           <span>hello from parent</span>
           <span>{{ props.text }}</span>
         </div> 
   */
  return `{key:${key},fn:function(${String(el.attrsMap.scope)}){` +
    `return ${el.tag === 'template'
      ? genChildren(el, state) || 'void 0'
      : genElement(el, state)
  }}}`
}

/* 
    生成一个作用域插槽（v-for 列表中），返回值形如
    ` _l(exp, function(val, idx, i){
          return genScopedSlot(key, el, state)
      })
    `
*/
function genForScopedSlot (
  key: string,
  el: any,
  state: CodegenState
): string {
  // ① 数据源，例如 v-for="(value, key) in items" 中的 items
  const exp = el.for
  // ② 数据值 value
  const alias = el.alias
  // ③ 数据键 key
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  // ④ 数据索引，例如当前 (value, key) 在 items 中的索引 i
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

  // 标记为 true，避免递归
  el.forProcessed = true // avoid recursion


  /*
    Vue.prototype._l = renderList

    renderList(val,render) 渲染 v-for 列表，返回数组 ret，该数组元素是 render 函数执行结果
    以 val 是对象为例，ret[i] = render(val[key], key, i)

    返回值：
    `
      _l(exp, function(val, idx, i){
          return genScopedSlot(key, el, state)
      })
    `
 */
  return `_l((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
      `return ${genScopedSlot(key, el, state)}` +
    '})'
}


/*
    gen(c, state) 的大致结构为：
    code = "_c('" + (el.tag) + "'" +  ("," + data)  + ("," + children) + ")"
    
    所以，最终返回值的结构大致为：
    '[code1,code2],2' 或 `[code1,code2]`
*/
export function genChildren (
  el: ASTElement,
  state: CodegenState,
  checkSkip?: boolean,
  altGenElement?: Function,
  altGenNode?: Function
): string | void {
  const children = el.children

  // 前提：children 长度大于 0
  if (children.length) {
    const el: any = children[0]

    // optimize single v-for
    // 1. 如果 v-for 循环的元素只有一个，那就优化一下：直接生成这个元素，并返回
    if (children.length === 1 &&
      el.for &&
      el.tag !== 'template' &&
      el.tag !== 'slot'
    ) {
      return (altGenElement || genElement)(el, state)
    }

    // 标准化类型， 0 | 1 | 2
    const normalizationType = checkSkip
      ? getNormalizationType(children, state.maybeComponent)
      : 0

    const gen = altGenNode || genNode

    // 2. 遍历 children，对每个 child 执行 gen(child, state)
    return `[${children.map(c => gen(c, state)).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''
    }`
    /*
        gen(c, state) 的大致结构为：
        code = "_c('" + (el.tag) + "'" +  ("," + data)  + ("," + children) + ")"
        
        所以，最终返回值的结构大致为：
        '[code1,code2],2' 或 `[code1,code2]`
     */
  }
}

// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
/*
    normalizationType 表示子元素数组所需的规范类型：
    0 : 不需要规范化
    1 : 需要简单的规范化处理
    2 : 全面的规范化处理

    getNormalizationType() 的返回值为 0 | 1 | 2，确定以哪种形式来格式化 children
*/
function getNormalizationType (
  /*
      ASTNode = ASTElement | ASTText | ASTExpression，其中：
      ASTElement 的 type 类型为 1
      ASTText 的 type 类型为 3
      ASTExpression 的 type 类型为 2
   */                            
  children: Array<ASTNode>,
  maybeComponent: (el: ASTElement) => boolean
): number {
  // 默认为 0
  let res = 0

  for (let i = 0; i < children.length; i++) {
    const el: ASTNode = children[i]
    // ① 若 el 为文本或表达式，那就跳过这次循环，不决定 res 的值
    if (el.type !== 1) {
      continue
    }

    /*
        needsNormalization(el):
        el 为 <template> 或 <slot> 或 v-for 属性存在，返回 true，即需要规范化

        ② 若 el 元素需要规范化或某个 if 块需要规范化，直接确定 res = 2，结束循环
     */
    if (needsNormalization(el) ||
        (el.ifConditions && el.ifConditions.some(c => needsNormalization(c.block)))) {
      res = 2
      break
    }

    // ③ 若 el 为组件或某个 if 块为组件，那就暂时认定 res = 1，因为这里不终止循环，所以后面还可能修改 res 的值为 2
    if (maybeComponent(el) ||
        (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))) {
      res = 1
    }
  }

  return res
}


// el 为 <template> 或 <slot> 或 v-for 属性存在，即需要规范化
function needsNormalization (el: ASTElement): boolean {
  return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

/*
    生成节点有 3 种类型：
    ASTNode = ASTElement | ASTText | ASTExpression，其中：
    
    ASTElement 的 type 类型为 1
    ASTText 的 type 类型为 3
    ASTExpression 的 type 类型为 2
 */  
function genNode (node: ASTNode, state: CodegenState): string {
  // ① 生成元素
  if (node.type === 1) {
    return genElement(node, state)
  // ② 生成注释
  } if (node.type === 3 && node.isComment) {
    return genComment(node)
  // ③ 生成文本
  } else {
    return genText(node)
  }
}

// 生成文本，返回值形如 `_v( someText )``
export function genText (text: ASTText | ASTExpression): string {
  /*
      Vue.prototype._v = createTextVNode

      ① text.type 为 2，表达式，那就取 text.expression
      ② text.text 为 3，文本，那就取 text.text（替换掉其中的行分隔符，段分隔符）
   */
  return `_v(${text.type === 2
    ? text.expression // no need for () because already wrapped in _s()
    : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}

// 生成注释，返回值形如 `_e( someComment )`
export function genComment (comment: ASTText): string {
  // Vue.prototype._e = createEmptyVNode
  return `_e(${JSON.stringify(comment.text)})`
}

// 生成插槽，返回值形如 `_t(slotName,null,attrs,bind)`
function genSlot (el: ASTElement, state: CodegenState): string {
  const slotName = el.slotName || '"default"'
  // genChildren(el, state) 返回值的结构大致为：'[child1,child2]'
  const children = genChildren(el, state)
  /*
      Vue.prototype._t = renderSlot
      
      对于函数 renderSlot (name, fallback, props, bindObject) 
      ① 第二个参数 fallback （对应这里的 children）的意义为：
      若父组件有给插槽传入内容那就以父组件的内容为准，否则就取插槽的默认内容（也就是 fallback 这个数组）
      ② 作用域插槽，参数 props, bindObject 才起作用，静态插槽不需要这俩参数
   */
  let res = `_t(${slotName}${children ? `,${children}` : ''}`

  /*
      生成的 attrs 形如：
      `
        {
          attrName1:val1,
          attrName2:val2,
          attrName3:val3,
          ...
        }
      `
   */
  const attrs = el.attrs && `{${el.attrs.map(a => `${camelize(a.name)}:${a.value}`).join(',')}}`
  
  const bind = el.attrsMap['v-bind']

  // ① children 不存在时，到这里 res = `_t(slotName,null`
  if ((attrs || bind) && !children) {
    res += `,null`
  }

  // ② attrs 存在，到这里 res = `_t(slotName,null,attrs`
  if (attrs) {
    res += `,${attrs}`
  }

  // ③ bind 存在，到这里 res = `_t(slotName,null,attrs,bind`
  if (bind) {
    res += `${attrs ? '' : ',null'},${bind}`
  }

  // 到这里，res = `_t(slotName,null,attrs,bind)`
  return res + ')'
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
// 生成组件，返回值形如 `_c(tag, {data}, [children], 2)`
function genComponent (
  componentName: string,
  el: ASTElement,
  state: CodegenState
): string {
  /*
    ① genChildren(el, state, true) 返回值的结构大致为：
    '[code1,code2],2' 或 `[code1,code2]`

    ② genData$2(el, state) 返回值为这种形式：
    data: {
        staticClass:"view two",
        attrs:{"name":"a"},
        key : ...,
        attrs : {},
        ...
    }

    所以该函数返回值形如：
    `_c(tag, {data}, [children], 2)`

    其中 vm._c = function (a, b, c, d) { return createElement(vm, a, b, c, d, false); };
  */
  const children = el.inlineTemplate ? null : genChildren(el, state, true)
  return `_c(${componentName},${genData(el, state)}${
    children ? `,${children}` : ''
  })`
}

/*
    生成 props 键值对字符串，返回值形如：
    `"propName1":propValue1,"propName2":propValue2,"propName3":propValue3...`
 */
function genProps (props: Array<{ name: string, value: string }>): string {
  let res = ''
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    res += `"${prop.name}":${transformSpecialNewlines(prop.value)},`
  }
  // 剔除最后一个逗号
  return res.slice(0, -1)
}

// #3895, #4268
/*
    替换掉 text 字符中的行分隔符、段分隔符（因为它们会被浏览器理解为换行，而在 Javascript 的字符串表达式中是不允许换行的，这会导致错误）
    ① 'abc\u2028def'.replace(/\u2028/g, '\\u2028')
     -> "abc\u2028def"

    ② "abc\u2028def"
    -> "abc def"
 */
function transformSpecialNewlines (text: string): string {
  return text
    // 行分隔符
    .replace(/\u2028/g, '\\u2028')
    // 段分隔符
    .replace(/\u2029/g, '\\u2029')
}
