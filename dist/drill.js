// drill.js - v5.0.0 https://github.com/kirakiray/drill.js  (c) 2018-2023 YAO
!function(){"use strict";const t={},e=(e,s)=>{if(e instanceof Function&&(s=e,e=["js","mjs"]),e instanceof Array)return void e.forEach((e=>{(t[e]||(t[e]=[])).push(s)}));(t[e]||(t[e]=[])).push(s)};e(["mjs","js"],(({url:t})=>import(t))),e(["txt","html"],(({url:t})=>fetch(t).then((t=>t.text())))),e("json",(async({url:t})=>fetch(t).then((t=>t.json())))),e("wasm",(async({url:t})=>{const e=await fetch(t).then((t=>t.arrayBuffer())),s=await WebAssembly.compile(e);return new WebAssembly.Instance(s).exports}));const s=async(e,s)=>{const n=new URL(e),{pathname:i}=n,r=i.slice(2+(i.lastIndexOf(".")-1>>>0));let c;const o=t[r];if(o)for(let t of o){const n=await t({url:e,data:c,...s});void 0!==n&&(c=n)}else c=fetch(e);return c};function n(t){return(t=>e=>{let n="";if(t.resolve)n=t.resolve(e);else{const s=new URL(t.url);n=new URL(e,s).href}return s(n)})(t)}Object.assign(n,{use:e});class i extends HTMLElement{constructor(...t){super(...t),this._init()}_init(){if(this.__initSrc||this.attributes.hasOwnProperty("pause"))return;let t=this.getAttribute("src");t&&(this.__initSrc=t,t=new URL(t,location.href,t).href,s(t,{element:this}))}attributeChangedCallback(t,e,s){"src"===t?s&&null===e?this._init():this.__initSrc&&e&&s!==this.__initSrc&&(console.warn(`${this.tagName.toLowerCase()} change src is invalid, only the first change will be loaded`),this.setAttribute("src",this.__initSrc)):"pause"===t&&null===s&&this._init()}static get observedAttributes(){return["src","pause"]}}customElements.define("load-module",i),customElements.define("l-m",class extends i{constructor(...t){super(...t)}}),"undefined"!=typeof window&&(window.lm=n),"object"==typeof module&&(module.exports=n)}();