# drill.js 3.0

更改为浏览器的资源管理器，不单纯只是模块化框架；

将载入函数名改为 `load` 而不是 `require`，从此不会在 `electron` 等CMD框架内起冲突；

## drill.js 2.0

与 CMD 和 es6 module 不同，drill.js 是专注于懒加载的模块化方案；

与 AMD 模块化不同，drill.js 是真正做到按需加载的方案，而不是依赖前置来解决；

### 相比 drill.js 1.0

1. 大幅增强扩展性；
2. 支持载入css和json文件；

## 目录结构

`doc/` 使用文档；

`src/` 源代码目录；

`test/` 测试案例目录；

`plugin/` 官方插件目录；

## 使用文档

[点击doc目录](doc/README.md)

## 为什么使用 drill.js ？

* 按需加载模块，为项目提供 `过渡中` 的状态，方便做用户体验优化；
* 能根据浏览器的支持状态，动态判断载入Babel编译的es5或原生的es7文件；
