/* @flow */

// ������������������Ƴ�����
import deindent from 'de-indent'
import { parseHTML } from 'compiler/parser/html-parser'
import { makeMap } from 'shared/util'

// �س�?����
const splitRE = /\r?\n/g
// . ƥ������з�����������ַ�
const replaceRE = /./g
// isSpecialTag(tag) �ж� tag �Ƿ�Ϊ script,style,template ����֮һ
const isSpecialTag = makeMap('script,style,template', true)

// flow ��������
type Attribute = {
  name: string,
  value: string
};

/*
  ���ļ���� .vue
  �� vue.js ��Ŀ�У����ǻ�ѽ����ֳɶ��С�����ÿ�������ͬһ���ļ��з�װ���� css ��ʽ��template ģ���Լ� JavaScript ���ܡ�

  �� my-component.vue Ϊ���������������£�
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
// ��һ�� .vue �ļ�תΪһ�� sfc ���󡣣��������ɵ� vue.js ��û����һ���֣�
export function parseComponent (
  content: string,
  options?: Object = {}
 ): SFCDescriptor {

  /*
	flow/complier �ļ�����������
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
  // ��󵼳��� sfc ���󣬷�Ϊ template��script��style ���Զ�����Ĳ��֡����� style ���Զ������������template �� script ������һ��
  const sfc: SFCDescriptor = {
    template: null,
    script: null,
    styles: [],
    customBlocks: []
  }

  let depth = 0
  // ��ǰ����Ĵ����
  let currentBlock: ?(SFCBlock | SFCCustomBlock) = null

  // ƥ�䵽��ǩ��ʼʱ�Ĺ��ӣ���Ҫ�Ƕ� currentBlock ��ֵ�Լ��Ա�ǩ�����Խ��д���
  // ȷ�� <script>��<style>��<template> �� 3 ����ǩ�Ŀ�ʼ��������ǩ���ݴ洢�� sfc ������
  function start (
    tag: string,              // ��ǩ��
    attrs: Array<Attribute>,  // ��������
    unary: boolean,           // �Ƿ�Ϊ����ǩ
    start: number,            // ��ǩ < λ��
    end: number               // ��ǩ > λ��
  ) {
	  // depth === 0 ˵��֮ǰ�ı�ǩ������ˣ��ر���
    if (depth === 0) {
      currentBlock = {
        type: tag,
        content: '',
        start: end, // <script>ssssssss</script> ��ʼ��ǩ <script> �Ľ���λ�� > ���� currentBlock �Ŀ�ʼλ��
    		/*
    		  ���� arr.reduce([callback, initialValue]) ������
    		  �� callback �����ĵ�һ������Ϊ�ϴε��� callback �ķ���ֵ�����߳�ʼֵ initialValue��callback �����ĵڶ�������Ϊ��ǰ�������Ԫ��
    		  �� initialValue Ϊ��һ�ε��� callback �ĵ�һ������

    		  attrs �� [{name1, value1},{name2, value2},{name3, value3}...] ��Ϊ {name1:value1,name2:value2,name3:value3,...}
    		*/
        attrs: attrs.reduce((cumulated, { name, value }) => {
          cumulated[name] = value || true
          return cumulated
        }, Object.create(null))
      }


	    // tag Ϊ script,style,template ����֮һ
      if (isSpecialTag(tag)) {
		    // ���� attrs���� currentBlock �������
        checkAttrs(currentBlock, attrs)
		    // .vue �ļ��� <style> ��ǩ�����ж��
        if (tag === 'style') {
          sfc.styles.push(currentBlock)
		    // .vue �ļ��� <script>/<tempalte> ��ǩ����ֻ����һ��
        } else {
          sfc[tag] = currentBlock
        }
	    // ������ǩ
      } else { // custom blocks
        sfc.customBlocks.push(currentBlock)
      }
      /*
        ��һ�� if-else ����˼�ǣ�

        ���Ȼع�һ�� sfc: {
          template: null,
          script: null,
          styles: [],
          customBlocks: []
        }

        Ҳ����˵��
        �� �����ǰ tag �� template���ǾͰ� currentBlock ��ֵ�� sfc.template
        �� �����ǰ tag �� script���ǾͰ� currentBlock ��ֵ�� sfc.script
        �� �����ǰ tag �� style���ǾͰ� currentBlock ��ӵ����� sfc.styles ��
        �� tag Ϊ������ǩ��ֱ�Ӽ��뵽���� sfc.customBlocks ��
       */

    }
	  // unary Ϊ false���ǵ���ǩ����ô depth �� 1����ʾ��ǩ����
    if (!unary) {
      depth++
    }
  }

  /*
	type Attribute = {
	  name: string,
	  value: string
	};

	checkAttrs �����������Ǳ��� attrs���� block ��� lang/scoped/module/src ������
  */
  function checkAttrs (block: SFCBlock, attrs: Array<Attribute>) {
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i]
      // ������ lang ��ǩ���� style ��ǩ���õ�Ԥ�����﷨��less��sass ֮���
      if (attr.name === 'lang') {
        block.lang = attr.value
      }
      // style �� scoped ���ԣ�����ʽֻ�ڵ�ǰ���������
      if (attr.name === 'scoped') {
        block.scoped = true
      }
      // ģ��
      if (attr.name === 'module') {
        block.module = attr.value || true
      }
      // ��Դ·��
      if (attr.name === 'src') {
        block.src = attr.value
      }
    }
  }

  // ��ǩ����ʱ���øú���������ǩ���ݴ洢�� sfc �����ϣ���ʵ���Ǹ� currentBlock.content ��ֵ��
  function end (tag: string, start: number, end: number) {
	  // depth === 1 ˵���б�ǩδ�ر�
    if (depth === 1 && currentBlock) {
      // <script>ssssssss</script> ������ǩ </script> �Ŀ�ʼ��λ�� < ���� currentBlock �Ľ�β��λ��
      currentBlock.end = start

	    // ȥ����ǩ�ڵ�������deindent ������ר��Ϊ��ȥ������������ģ��
      let text = deindent(content.slice(currentBlock.start, currentBlock.end))
      // pad content so that linters and pre-processors can output correct
      // line numbers in errors and warnings
      // �ո�/���б�ȥ����<script>��<style> �ȿ�ͷ���Ͽո�/���У�Ŀ������ lint ����ʱ��������Ϣ�����ܶ�Ӧ��
      if (currentBlock.type !== 'template' && options.pad) {
        // text ǰ�������ɸ����з���ո�
        text = padContent(currentBlock, options.pad) + text
      }

      currentBlock.content = text
      // currentBlock ��ʵ�Ѿ������� sfc �����Ե��������ˣ�currentBlock ֻ�Ǹ���ʱ������js �������������ͣ������������ͷ� currentBlock ����
      currentBlock = null
    }
	  // depth �� 1����ʾ��ǩ�ر�
    depth--
  }

  // �ڴ������ʼλ��ǰ��ӿ��У��ո񣩣�ʹ�� eslint �ȹ�����׼ȷ��λ�к�
  function padContent (block: SFCBlock | SFCCustomBlock, pad: true | "line" | "space") {
    if (pad === 'space') {
      // replaceRE = /./g���� block ֮ǰ���ַ����滻Ϊ�ո�
      return content.slice(0, block.start).replace(replaceRE, ' ')
    } else {
      /*
        splitRE = /\r?\n/g ƥ�任�У�offset ���� block ֮ǰ������

        ��ȡ��ǰ��δ��뵽���ڶ�����
       */
      const offset = content.slice(0, block.start).split(splitRE).length
      // ���з�
      const padChar = block.type === 'script' && !block.lang
        ? '//\n' // �� js ���룬��ע�ͻ���
        : '\n'   // �� �������룬�ӻ���
      // ���ɸ����з���ɵ��ַ���
      return Array(offset).join(padChar)
    }
    /*
      �磺
      <style>


        .red {
          color
        }
      </style>
      
      deindent() ����ȥ�������Ĺ����л�ȥ���հס�
      <style> �� .red ֮���� 2 �����У�padContent() ���������þ����ÿո񡢻��з��Ƚ���Щ���в���
     */
  }

  /*
    parseHTML ��������һ�� options �������ڶ������������������ƥ�䵽��ǩ��ʼ�ͽ���ʱ�Ĺ��ӣ�ͨ����������ȡ�Լ�д��Ҫ�����ݡ�
    ����˵�������и� <tag>xxx</tag> ���������ݣ�ƥ�䵽 <tag> ʱ��ִ�� start ������ƥ�䵽 </tag> ʱ��ִ�� end ���������ƥ�䵽 <tab/>����ִֻ�� start ������
    
    ֱ������ parseHTML ���� options ����Ҳ�ǿ��Եģ�ֻ�������᷵���κε�����
   */
  // �����ļ�����ؼ�Ϊ��һ��
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
