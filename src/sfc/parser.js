/* @flow */

// 第三方插件，作用是移除缩进
import deindent from 'de-indent'
import { parseHTML } from 'compiler/parser/html-parser'
import { makeMap } from 'shared/util'

// 回车?换行
const splitRE = /\r?\n/g
// . 匹配除换行符以外的任意字符
const replaceRE = /./g
// isSpecialTag(tag) 判断 tag 是否为 script,style,template 三者之一
const isSpecialTag = makeMap('script,style,template', true)

// flow 类型声明
type Attribute = {
  name: string,
  value: string
};

/**
 * Parse a single-file component (*.vue) file into an SFC Descriptor Object.
 */
// 将一个 .vue 文件转为一个 sfc 对象
export function parseComponent (
  content: string,
  options?: Object = {}
 ): SFCDescriptor {
  /*
	flow/complier 文件中有声明：
	declare type SFCDescriptor = {
	  template: ?SFCBlock;
	  script: ?SFCBlock;
	  styles: Array<SFCBlock>;
	  customBlocks: Array<SFCCustomBlock>;
	}

	declare type SFCBlock = {
	  type: string;
	  content: string;
	  start?: number;
	  end?: number;
	  lang?: string;
	  src?: string;
	  scoped?: boolean;
	  module?: string | boolean;
	};

	declare type SFCCustomBlock = {
	  type: string;
	  content: string;
	  start?: number;
	  end?: number;
	  src?: string;
	  attrs: {[attribute:string]: string};
	};
  */
  // 最后导出的 sfc 对象，分为 template、script、style 和自定义块四部分。其中 style 和自定义块允许多个，template 和 script 只允许一个
  const sfc: SFCDescriptor = {
    template: null,
    script: null,
    styles: [],
    customBlocks: []
  }
  let depth = 0
  // 当前处理的代码块
  let currentBlock: ?(SFCBlock | SFCCustomBlock) = null

  // 匹配到标签开始时的钩子，主要是对 currentBlock 赋值以及对标签的属性进行处理
  function start (
    tag: string,
	 // attrs 为一个数组，数组的每项是 Attribute。其中 Attribute 是包含 name 和 value 属性的对象
    attrs: Array<Attribute>,
    unary: boolean,
    start: number,
    end: number
  ) {
	  // depth === 0 说明之前的标签都配对了，关闭了
    if (depth === 0) {
      currentBlock = {
        type: tag,
        content: '',
        start: end,
    		/*
    		  对于 arr.reduce([callback, initialValue]) 函数：
    		  ① callback 函数的第一个参数为上次调用 callback 的返回值，或者初始值 initialValue
    			 callback 函数的第二个参数为当前被处理的元素
    		  ② initialValue 为第一次调用 callback 的第一个参数

    		  attrs 由 [{name, value},{name, value},{name, value}...] 变为 {name1:value1,name2:value2,name3:value3,...}
    		*/
        attrs: attrs.reduce((cumulated, { name, value }) => {
          cumulated[name] = value || true
          return cumulated
        }, Object.create(null))
      }


	    // tag 为 script,style,template 三者之一
      if (isSpecialTag(tag)) {
		    // 遍历 attrs，给 currentBlock 添加属性
        checkAttrs(currentBlock, attrs)
		    // sfc.style 默认为 []
        if (tag === 'style') {
          sfc.styles.push(currentBlock)
		    // tag 为 script | template，sfc[script | template] 默认值为 null
        } else {
          sfc[tag] = currentBlock
        }
	    // 其他标签
      } else { // custom blocks
        sfc.customBlocks.push(currentBlock)
      }
      /*
        这一段 if-else 的意思是：

        首先回顾一下 sfc: {
          template: null,
          script: null,
          styles: [],
          customBlocks: []
        }

        也就是说：
        ① 如果当前 tag 是 template，那就把 currentBlock 赋值给 sfc.template
        ② 如果当前 tag 是 script，那就把 currentBlock 赋值给 sfc.script
        ③ 如果当前 tag 是 style，那就把 currentBlock 添加到数组 sfc.styles 中
        ④ tag 为其他标签，直接加入到数组 sfc.customBlocks 中
       */

    }
	// unary 为 false，即不是一元运算符，那么 depth 加 1，表示标签开启
    if (!unary) {
      depth++
    }
  }

  /*
	type Attribute = {
	  name: string,
	  value: string
	};

	checkAttrs 函数的作用是遍历 attrs，给 block 添加属性（这些属性主要是针对 style 标签）
  */
  function checkAttrs (block: SFCBlock, attrs: Array<Attribute>) {
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i]
      // 可以用 lang 标签设置 style 标签内用的预处理语法，less，sass 之类的
      if (attr.name === 'lang') {
        block.lang = attr.value
      }
      // 如果设置了 scoped 属性，那么这个标签就只对当前组件有作用
      if (attr.name === 'scoped') {
        block.scoped = true
      }
      if (attr.name === 'module') {
        block.module = attr.value || true
      }
      // 用src属性设置内容对应的文件
      if (attr.name === 'src') {
        block.src = attr.value
      }
    }
  }

  // 匹配到标签结束时调用的钩子，主要是对 currentBlock.content 赋值
  function end (tag: string, start: number, end: number) {
	// depth === 1 说明有标签未关闭
    if (depth === 1 && currentBlock) {
      currentBlock.end = start
	    // 去除标签内的缩进，deindent 是作者专门为了去除缩进开发的模块
      let text = deindent(content.slice(currentBlock.start, currentBlock.end))
      // pad content so that linters and pre-processors can output correct
      // line numbers in errors and warnings
      // 不是 template 标签时加上空格/空行，目的是在 lint 报错时，报错信息行数能对应上
      if (currentBlock.type !== 'template' && options.pad) {
        // text 前补上若干个换行符或空格
        text = padContent(currentBlock, options.pad) + text
      }
      currentBlock.content = text
       // currentBlock 其实已经保存在 sfc 的属性的引用上了，currentBlock 只是个临时变量（js 对象都是引用类型），所以这里释放 currentBlock 引用
      currentBlock = null
    }
	// depth 减 1，表示标签关闭
    depth--
  }

  // 用来生成能跟 .vue 文件行数对应上的内容用的。用来对应 lint 或者预编译软件的报错信息的行数
  function padContent (block: SFCBlock | SFCCustomBlock, pad: true | "line" | "space") {
    if (pad === 'space') {
      // replaceRE = /./g，将 block 之前的字符都替换为空格
      return content.slice(0, block.start).replace(replaceRE, ' ')
    } else {
      /*
        splitRE = /\r?\n/g 匹配换行
        offset 代表 block 之前的行数？

        获取当前这段代码到底在多少行
       */
      const offset = content.slice(0, block.start).split(splitRE).length
      // 换行符，根据不同的块使用不同的换行
      const padChar = block.type === 'script' && !block.lang
        ? '//\n'
        : '\n'
      // 若干个换行符组成的字符串
      return Array(offset).join(padChar)
    }
  }

  /*
    parseHTML 函数接收一个 options 参数（第二个），里面可以设置匹配到标签开始和结束时的钩子，通过钩子来获取自己写想要的内容。
    就是说，比如有个 <tag>xxx</tag> 这样的内容，匹配到 <tag> 时，执行 start 函数，匹配到 </tag> 时，执行 end 函数，如果匹配到 <tab/>，就只执行 start 函数。
    
    直接运行 parseHTML 不加 options 参数也是可以的，只不过不会返回任何的内容
   */
  // 整个文件，最关键为这一句
  parseHTML(content, {
    start,
    end
  })

  /*
  sfc: {
    template: null,
    script: null,
    styles: [...],
    customBlocks: [...]
  }
   */
  return sfc
}
