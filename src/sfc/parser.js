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

/*
  单文件组件 .vue
  在 vue.js 项目中，我们会把界面拆分成多个小组件，每个组件在同一个文件中封装它的 css 样式，template 模板以及 JavaScript 功能。

  以 my-component.vue 为例，完整内容如下：
  <script>
    .red {
      color : red;
    }
  </script>
  
  <template>
    <div class = "red">
      {{ message }}
    </div>
  </template>

  <script>
    module.exports = {
      data : function () {
        return {
          message : 'hello'
        }
      }
    }
  </script>
 */

/**
 * Parse a single-file component (*.vue) file into an SFC Descriptor Object.
 */
// 将一个 .vue 文件转为一个 sfc 对象。（最终生成的 vue.js 并没有这一部分）
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
  // 最后导出的 sfc 对象，分为 template、script、style 和自定义块四部分。其中 style 和自定义块允许多个，template 和 script 各允许一个
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
  // 确定 <script>、<style>、<template> 等 3 个标签的开始，并将标签内容存储到 sfc 对象上
  function start (
    tag: string,              // 标签名
    attrs: Array<Attribute>,  // 属性数组
    unary: boolean,           // 是否为单标签
    start: number,            // 标签 < 位置
    end: number               // 标签 > 位置
  ) {
	  // depth === 0 说明之前的标签都配对了，关闭了
    if (depth === 0) {
      currentBlock = {
        type: tag,
        content: '',
        start: end, // <script>ssssssss</script> 开始标签 <script> 的结束位置 > 就是 currentBlock 的开始位置
    		/*
    		  对于 arr.reduce([callback, initialValue]) 函数：
    		  ① callback 函数的第一个参数为上次调用 callback 的返回值，或者初始值 initialValue。callback 函数的第二个参数为当前被处理的元素
    		  ② initialValue 为第一次调用 callback 的第一个参数

    		  attrs 由 [{name1, value1},{name2, value2},{name3, value3}...] 变为 {name1:value1,name2:value2,name3:value3,...}
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
		    // .vue 文件中 <style> 标签可以有多个
        if (tag === 'style') {
          sfc.styles.push(currentBlock)
		    // .vue 文件中 <script>/<tempalte> 标签各自只能有一个
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
	  // unary 为 false，非单标签，那么 depth 加 1，表示标签开启
    if (!unary) {
      depth++
    }
  }

  /*
	type Attribute = {
	  name: string,
	  value: string
	};

	checkAttrs 函数的作用是遍历 attrs，给 block 添加 lang/scoped/module/src 等属性
  */
  function checkAttrs (block: SFCBlock, attrs: Array<Attribute>) {
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i]
      // 可以用 lang 标签设置 style 标签内用的预处理语法，less，sass 之类的
      if (attr.name === 'lang') {
        block.lang = attr.value
      }
      // style 有 scoped 属性，则样式只在当前组件起作用
      if (attr.name === 'scoped') {
        block.scoped = true
      }
      // 模块
      if (attr.name === 'module') {
        block.module = attr.value || true
      }
      // 资源路径
      if (attr.name === 'src') {
        block.src = attr.value
      }
    }
  }

  // 标签结束时调用该函数，将标签内容存储到 sfc 对象上（其实就是给 currentBlock.content 赋值）
  function end (tag: string, start: number, end: number) {
	  // depth === 1 说明有标签未关闭
    if (depth === 1 && currentBlock) {
      // <script>ssssssss</script> 结束标签 </script> 的开始的位置 < 就是 currentBlock 的结尾的位置
      currentBlock.end = start

	    // 去除标签内的缩进，deindent 是作者专门为了去除缩进开发的模块
      let text = deindent(content.slice(currentBlock.start, currentBlock.end))
      // pad content so that linters and pre-processors can output correct
      // line numbers in errors and warnings
      // 空格/空行被去除后，<script>、<style> 等开头加上空格/空行，目的是在 lint 报错时，报错信息行数能对应上
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

  // 在代码块起始位置前添加空行（空格），使得 eslint 等工具能准确定位行号
  function padContent (block: SFCBlock | SFCCustomBlock, pad: true | "line" | "space") {
    if (pad === 'space') {
      // replaceRE = /./g，将 block 之前的字符都替换为空格
      return content.slice(0, block.start).replace(replaceRE, ' ')
    } else {
      /*
        splitRE = /\r?\n/g 匹配换行，offset 代表 block 之前的行数

        获取当前这段代码到底在多少行
       */
      const offset = content.slice(0, block.start).split(splitRE).length
      // 换行符
      const padChar = block.type === 'script' && !block.lang
        ? '//\n' // ① js 代码，加注释换行
        : '\n'   // ② 其他代码，加换行
      // 若干个换行符组成的字符串
      return Array(offset).join(padChar)
    }
    /*
      如：
      <style>


        .red {
          color
        }
      </style>
      
      deindent() 函数去除缩进的过程中会去掉空白。
      <style> 和 .red 之间有 2 个空行，padContent() 函数的作用就是用空格、换行符等将这些空行补上
     */
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
    template: {
      type: string;
      content: string;
      start?: number;
      end?: number;
      lang?: string;
      src?: string;
      scoped?: boolean;
      module?: string | boolean;
    },
    script: {
      type: string;
      content: string;
      start?: number;
      end?: number;
      lang?: string;
      src?: string;
      scoped?: boolean;
      module?: string | boolean;
    },
    styles: [...],
    customBlocks: [...]
  }
   */
  return sfc
}
