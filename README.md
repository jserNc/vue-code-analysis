## 目录/文件说明

**(1) .editorconfig 定义项目编码规范**

当多人共同开发一个项目的时候，往往会出现大家用不同编辑器的情况。那么如何让使用不同编辑器的开发者在共同开发一个项目时“无痛”地遵循编码规范(编码风格)呢？EditorConfig 能很好地解决这个问题。只需两步：

① 在项目根创建一个名为 .editorconfig 的文件。该文件的内容定义该项目的编码规范。

② 安装与编辑器对应的 EditorConfig 插件。

其工作原理是：当你在编码时，EditorConfig 插件会去查找当前编辑文件的所在文件夹或其上级文件夹中是否有 .editorconfig 文件。如果有，则编辑器的行为会与 .editorconfig 文件中定义的一致，并且其优先级高于编辑器自身的设置。

**(2) .eslintignore 设置可忽略文件，这样 eslint 就不会校验这些文件代码了**

**(3) eslintrc 代码校验工具 eslint 的配置文件**

**(4) .babelrc 语法编译器 babel 的配置文件**

**(5) .flowconfig 静态类型检测工具 flow 的配置文件**

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

**(6) .gitignore 版本控制工具 git 配置忽略文件**

**(7) BACKERS.md 项目的捐款名单（backer 的意思为“支持者，赞助者”）**

**(8) circle.yml 为 CircleCI 集成测试平台的配置文件**

**(9) LICENSE 该软件的使用协议和服务条款等**

**(10) package.json**

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

**(11) yarn.lock**

Yarn 类似于 npm，是一个由 Facebook 推出的新 JavaScript 包管理器。yarn.lock 锁定了安装包的精确版本以及所有依赖项。有了这个文件，你可以确定项目团队的每个成员都安装了精确的软件包版本，部署可以轻松地重现，且没有意外的 bug。

**(12) 源码 src**
  
- compiler      编译器，解析模板
- core          vue 核心
- platforms     不同平台下各自独特的代码
- server        server side render，即 ssr
- sfc           将 .vue 文件转换为 sfc 对象（可识别组件）
- shared        共享的模块，一个工具集

**以入口文件 src/platforms/web 为例：**

① entry-compiler.js

导出了解析 sfc 模块和 compiler 模块的接口。compiler 模块的作用是用来解析模板的，对应的是 src/compiler 模块，大概是使用 new Function 将字符串转换为 js 代码，所以对于不支持或者认为这样不安全的环境，vue 会给出错误提示。

② entry-runtime.js  

只包含 vue 的运行时部分的代码
  
③ entry-runtime-with-compiler.js 

这个模块既包含解析器又包含运行时这个文件作为一个入口，将已经整合好的 compiler 和 runtime 再一次整合封装，最终导出浏览器用的vue构造函数。

④ entry-server-basic-renderer.js entry-server-renderer.js

这个是 server side render 的入口，所以与 brower 端用到的方法差别很大。server 端只是做初步的渲染，所以只有一个生成 render 的函数，结构比较简单。

**源码中经常出现一组注释：**

```javascript
/* istanbul ignore if */
/* istanbul ignore else */
/* istanbul ignore next */
```

Istanbul 是 JavaScript 程序的代码覆盖率工具。这个软件以土耳其最大城市伊斯坦布尔命名，因为土耳其地毯世界闻名，而地毯是用来覆盖的。以上 3 个语句是 Istanbul 提供的注释语法，允许某些代码不计入覆盖率，用官网的原文说明其作用：

> Ignoring code for coverage
> Skip an if or else path with /* istanbul ignore if */ or /* istanbul ignore else */ respectively.
>For all other cases, skip the next 'thing' in the source with: /* istanbul ignore next */

在 vue 源码中应用如下：

```javascript
// 下个代码段的 if 块不计入代码覆盖率计算
/* istanbul ignore if */ 
if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
  startTag = `vue-perf-start:${vm._uid}`
  endTag = `vue-perf-end:${vm._uid}`
  mark(startTag)
}

// 下个代码段的 else 块不计入代码覆盖率计算
/* istanbul ignore else */ 
if (process.env.NODE_ENV !== 'production') {
  initProxy(vm)
} else {
  vm._renderProxy = vm
}

// 下个代码段不计入代码覆盖率计算
/* istanbul ignore next */ 
function copyAugment (target, src, keys) {
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    // 依次将 src[key] 赋予 target[key]
    def(target, key, src[key]);
  }
}

```  


参考：
[1] http://www.jianshu.com/p/712cea0ef70e

[2] https://zhuanlan.zhihu.com/p/24649359?utm_source=tuicool&utm_medium=referral

[3] http://www.jianshu.com/p/41f9d7461844

[4] https://segmentfault.com/a/1190000006983211

[5] https://www.brooch.me/2017/03/17/vue-source-notes-1/
