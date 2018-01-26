/* @flow */

/*
    fnExpRE 匹配两种函数声明方式：
    ① 箭头函数
       (a) =>
       a => 
    ② 普通函数 
       function (
*/
const fnExpRE = /^\s*([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/

/*
    simplePathRE 匹配以下路径：
    ① abc
    ② abc.def
    ③ abc['def']
    ④ abc["def"]
    ⑤ abc[123]
    ⑥ abc[def]

    观察这个正则，会发现闭合方括号没有转义，如 \[\d+]，这样写不是错误，因为有规定：
    如果之前能找到与之对应的元字符开方括号 [，则 ] 作为元字符出现，否则，作为普通字符出现。
*/
const simplePathRE = /^\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['.*?']|\[".*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*\s*$/

// keyCode aliases
const keyCodes: { [key: string]: number | Array<number> } = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  up: 38,
  left: 37,
  right: 39,
  down: 40,
  'delete': [8, 46]
}

// #4868: modifiers that prevent the execution of the listener
// need to explicitly return null so that we can determine whether to remove
// the listener for .once
// 如修饰符如要阻止监听器回调函数执行，则需要显示地返回 null。以便有 .once 修饰符时可以决定是否移除这个监听器。
const genGuard = condition => `if(${condition})return null;`

// 各修饰符对应的执行代码
const modifierCode: { [key: string]: string } = {
  stop: '$event.stopPropagation();',    // 阻止冒泡
  prevent: '$event.preventDefault();',  // 阻止默认行为
  /*
    event.currentTarget：返回事件当前所在的节点，会随着事件捕获和事件冒泡改变。也就是事件监听函数中的 this。
    event.target：返回目标节点（最深层节点），固定的。正是这个属性使得事件代理成为可能。
  */
  self: genGuard(`$event.target !== $event.currentTarget`), // 事件绑定的元素和事件源不一样
  ctrl: genGuard(`!$event.ctrlKey`),    // 按下了 ctrl 键
  shift: genGuard(`!$event.shiftKey`),  // 按下了 shift 键
  alt: genGuard(`!$event.altKey`),      // 按下了 alt 键
  meta: genGuard(`!$event.metaKey`),    // 按下了 meta 键
  left: genGuard(`'button' in $event && $event.button !== 0`),   // 按下了鼠标左键
  middle: genGuard(`'button' in $event && $event.button !== 1`), // 按下了鼠标中键
  right: genGuard(`'button' in $event && $event.button !== 2`)   // 按下了鼠标右键
}

/*
    返回结果大概为这种形式：
    'on:{
        'name1' : "function($event){ some code }",
        'name2' : "function($event){ some code }",
        'name3' : "function($event){ some code }"
        ...
    }'
*/
export function genHandlers (
  events: ASTElementHandlers,
  isNative: boolean,
  warn: Function
): string {
  let res = isNative ? 'nativeOn:{' : 'on:{'

  for (const name in events) {
    const handler = events[name]

    // #5330: warn click.right, since right clicks do not actually fire click events.
    if (process.env.NODE_ENV !== 'production' &&
      name === 'click' &&
      handler && handler.modifiers && handler.modifiers.right
    ) {
      // 警告：click.right 这种写法是不对的，因为右键点击并不会真正触发点击事件
      warn(
        `Use "contextmenu" instead of "click.right" since right clicks ` +
        `do not actually fire "click" events.`
      )
    }

    // 例如 '{abc,'.slice(0,-1) + '}' -> '{abc}'（去除最后一个逗号，然后闭合 {}）
    res += `"${name}":${genHandler(name, handler)},`
  }

  return res.slice(0, -1) + '}'
}

/*
    该函数返回一个事件处理函数的字符串形式
    ① handler 不是数组，那么返回值为一个完整的函数，如：
       return `function($event){${code}${handlerCode}}`
    ② handler 是数组，那么返回值是是 ① 中多个返回值拼接成的数组，如：
       return `[function($event){${code}${handlerCode}},function($event){${code}${handlerCode}},function($event){${code}${handlerCode}}]`
 */
function genHandler (
  name: string,
  /*
      看下 ASTElementHandler 的结构：
      declare type ASTElementHandler = {
        value: string;
        modifiers: ?ASTModifiers;
      };
   */
  handler: ASTElementHandler | Array<ASTElementHandler>
): string {
  // 1. 直接返回空方法
  if (!handler) {
    return 'function(){}'
  }

  // 2. handler 是一组 ASTElementHandler，递归调用本方法
  if (Array.isArray(handler)) {
    return `[${handler.map(handler => genHandler(name, handler)).join(',')}]`
  }

  // 3. 一般流程

  // ① handler.value 是路径名，指向一个函数，如 abc['def']
  const isMethodPath = simplePathRE.test(handler.value)
  // ② handler.value 是函数表达式，如 'function(arg){someCode}'
  const isFunctionExpression = fnExpRE.test(handler.value)

  // a. 没有修饰符
  if (!handler.modifiers) {
    /*
        ① isMethodPath || isFunctionExpression 为 true 表示 handler.value 是完整的函数
        ② 否则，handler.value 只是行内执行语句，将其封装成完整函数
     */
    return isMethodPath || isFunctionExpression
      ? handler.value
      : `function($event){${handler.value}}` // inline statement
  // b. 有修饰符
  } else {
    let code = ''
    let genModifierCode = ''
    const keys = []

    for (const key in handler.modifiers) {
      // ① stop、prevent、self 等修饰符有自己对应的 if 语句
      if (modifierCode[key]) {
        genModifierCode += modifierCode[key]
        // 既存在 genModifierCode 中又存在于 keyCodes 中只有 'left'/'right' 这两个了
        if (keyCodes[key]) {
          keys.push(key)
        }
      // ② 多个键值条件合并成一个 if 语句
      } else {
        keys.push(key)
      }
    }

    /*
        根据一组键名（键值），生成一个 if 语句，如：
        genKeyFilter(['up','enter'])
        -> "if(!('button' in $event)&&_k($event.keyCode,"up",38)&&_k($event.keyCode,"enter",13))return null;"
        
        没有点击鼠标 && 点击的键盘按键按键不是 'up' && 点击的键盘按键不是 'enter'，那就返回 null
    */
    if (keys.length) {
      code += genKeyFilter(keys)
    }


    // Make sure modifiers like prevent and stop get executed after key filtering
    /*
        根据一组键名，生成多个 if 语句，如：
        genModifierCode = 
        `if($event.target !== $event.currentTarget)return null;
        if(!$event.shiftKey)return null;
        if(!$event.altKey)return null;
        $event.stopPropagation();
        $event.preventDefault();
        `
     */
    if (genModifierCode) {
      code += genModifierCode
    }

    /*
        ① isMethodPath 为 true，handler.value 是路径名，指向一个函数，如 "abc['def']"
        ② isFunctionExpression 为 true，handler.value 是函数表达式，如 'function(arg){someCode}'
     
        于是：
        ① isMethodPath 为真，直接给函数传实参，如：
           handlerCode = "abc['def'](($event))"
        ② isFunctionExpression 为真，需要把函数声明用括号包起来，形式立即执行函数，如：
           handlerCode = '(function(arg){someCode})($event)'
        ③ 其他，handler.value 可认为是行内可执行语句，如：
           handlerCode = $event.stopPropagation();

        总之，handlerCode 是可执行语句
     */
    const handlerCode = isMethodPath
      ? handler.value + '($event)'
      : isFunctionExpression
        ? `(${handler.value})($event)`
        : handler.value

    /*
        ① code 是一堆 if 语句，只要有一个不满足就返回 null
        ② handlerCode 是可以执行语句，是真正的函数体

        例如，对于 <div @click.self.ctrl='clickFunc'> 则 click 事件返回值为：
        "function($event){if(!('button' in $event)&&_k($event.keyCode,"ctrl"))return null;if($event.target !== $event.currentTarget)return null;clickFunc($event)}"
        格式化后：
        "function($event) {
          if (!('button' in $event) && _k($event.keyCode, "ctrl")) return null;
          if ($event.target !== $event.currentTarget) return null;
          clickFunc($event)
        }"
     */
    return `function($event){${code}${handlerCode}}`
  }
}

/*
  根据一组键名（键值），生成一个 if 语句，如：
  genKeyFilter(['up','enter'])
  -> "if(!('button' in $event)&&_k($event.keyCode,"up",38)&&_k($event.keyCode,"enter",13))return null;"
  
  没有点击鼠标 && 点击的键盘按键按键不是 'up' && 点击的键盘按键不是 'enter'，那就返回 null
*/
function genKeyFilter (keys: Array<string>): string {
  return `if(!('button' in $event)&&${keys.map(genFilterCode).join('&&')})return null;`
}

/*
    根据键名（键值），生成 if 判断的条件，例如：
    ① genFilterCode(10) -> "$event.keyCode!==10"  点击的按键键值不是 10
    ② genFilterCode('up') -> "_k($event.keyCode,"up",38)" 点击的按键别名不是 up
    ③ genFilterCode('hi') -> "_k($event.keyCode,"hi")   点击的按键别名不是 hi
 */
function genFilterCode (key: string): string {
  const keyVal = parseInt(key, 10)
  // 1. 如 key = '10'
  if (keyVal) {
    return `$event.keyCode!==${keyVal}`
  }

  // 2. 如 key = 'up'
  const alias = keyCodes[key]
  return `_k($event.keyCode,${JSON.stringify(key)}${alias ? ',' + JSON.stringify(alias) : ''})`
  /*
  Vue.prototype._k = checkKeyCodes;

  checkKeyCodes($event.keyCode,"right",39) 
  将 config.keyCodes[key] || 39 这个值和当前点击下的键值 $event.keyCode 对比
  ① 相等，返回 false
  ② 不相等，返回 true
 */
}
