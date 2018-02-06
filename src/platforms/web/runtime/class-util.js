/* @flow */


/*
 说一说 classList 属性：

 ① 传统方法
    在操作类名的时候，需要通过 className 属性添加、删除和替换类名。如下面例子：
    <p class="bd user disabled">...</p>

    这个 p 中一共有三个类名，要从中删掉一个类名，需要把这三个类分别拆开，然后进行处理，处理过程如下：
    
    <script>
       var className = p.className.split(/\s+/);
       var pos = -1, i ,len;

       for (var i = 0; i < className.length; i++) {
           if(className[i] === "user"){
              pos = i;
              break;
           }
       };
       className.splice(i,1);
       p.className = className.join(" ");
    </script>

 ② html5 新增方法 classList 属性，可以完全摆脱 className 属性

    <p id="myDiv" class="init">Hello world!</p>
    <input type="button" value="Add class" onclick="addClass()">
    <input type="button" value="Remove class" onclick="removeClass()">
    <input type="button" value="Toggle class" onclick="toggleClass()">
    <input type="button" value="Contains class?" onclick="containsClass()">
    <p>This demo works in Firefox 3.6 and Chrome 8.</p>
     
    <script type="text/javascript">
        var myDiv = document.getElementById("myDiv");

        function addClass(){
            myDiv.classList.add("highlight");
        }
     
        function removeClass(){
            myDiv.classList.remove("highlight");
        }
     
        function toggleClass(){
            myDiv.classList.toggle("highlight");
        }
     
        function containsClass(){
            alert(myDiv.classList.contains("highlight"));
        }
    </script>

    可以看到，使用 classList 来修改 class 是多么便捷
*/

/**
 * Add class with compatibility for SVG since classList is not supported on
 * SVG elements in IE
 */
// 添加 class
export function addClass (el: HTMLElement, cls: ?string) {

  // 若待添加的 cls 不存在，直接返回
  if (!cls || !(cls = cls.trim())) {
    return
  }

  // 1. 支持 classList 属性
  if (el.classList) {
    // ① cls 形如 'cls1 cls2 cls3'，逐个添加
    if (cls.indexOf(' ') > -1) {
      cls.split(/\s+/).forEach(c => el.classList.add(c))
    // ② cls 形如 'cls1'，直接添加
    } else {
      el.classList.add(cls)
    }
  // 2. 原生 class 属性里添加 cls
  } else {
    /*
        注意：
        a. 这里 cur 前后带空格
        b. 前面执行了 cls = cls.trim()，所以 cls 前后是不带 ' '
     */
    const cur = ` ${el.getAttribute('class') || ''} `
    if (cur.indexOf(' ' + cls + ' ') < 0) {
      el.setAttribute('class', (cur + cls).trim())
    }
  }
}

/**
 * Remove class with compatibility for SVG since classList is not supported on
 * SVG elements in IE
 */
// 删除 class
export function removeClass (el: HTMLElement, cls: ?string) {
  
  // 若待删除的 cls 不存在，直接返回
  if (!cls || !(cls = cls.trim())) {
    return
  }

  // 1. 支持 classList 属性
  if (el.classList) {
    // ① cls 形如 'cls1 cls2 cls3'，逐个删除
    if (cls.indexOf(' ') > -1) {
      cls.split(/\s+/).forEach(c => el.classList.remove(c))
    // ② cls 形如 'cls1'，直接删除
    } else {
      el.classList.remove(cls)
    }

    // 若删除 cls 后 classList 长度为 0，那就移除 class 属性
    if (!el.classList.length) {
      el.removeAttribute('class')
    }
  // 2. 原生 class 属性里删除 cls
  } else {
    let cur = ` ${el.getAttribute('class') || ''} `
    const tar = ' ' + cls + ' '
    // ① 将 ' ' + cls + ' ' 替换为 ' '
    while (cur.indexOf(tar) >= 0) {
      cur = cur.replace(tar, ' ')
    }

    // ② 更新 class
    cur = cur.trim()
    if (cur) {
      el.setAttribute('class', cur)
    } else {
      el.removeAttribute('class')
    }
  }
}
