//! drill.js - v5.0.4 https://github.com/kirakiray/drill.js  (c) 2018-2023 YAO
const processor = {};

const use = (name, handler) => {
  if (name instanceof Function) {
    handler = name;
    name = ["js", "mjs"];
  }

  if (name instanceof Array) {
    name.forEach((name) => {
      const tasks = processor[name] || (processor[name] = []);
      tasks.push(handler);
    });
    return;
  }

  const tasks = processor[name] || (processor[name] = []);
  tasks.push(handler);
};

use(["mjs", "js"], ({ url }) => {
  return import(url);
});

use(["txt", "html"], ({ url }) => {
  return fetch(url).then((e) => e.text());
});

use("json", async ({ url }) => {
  return fetch(url).then((e) => e.json());
});

use("wasm", async ({ url }) => {
  const data = await fetch(url).then((e) => e.arrayBuffer());

  const module = await WebAssembly.compile(data);
  const instance = new WebAssembly.Instance(module);

  return instance.exports;
});

const LOADED = Symbol("loaded");

const createLoad = (meta) => {
  if (!meta) {
    meta = {
      url: document.location.href,
    };
  }
  const load = (url) => {
    let reurl = "";
    if (meta.resolve) {
      reurl = meta.resolve(url);
    } else {
      const currentUrl = new URL(meta.url);
      const resolvedUrl = new URL(url, currentUrl);
      reurl = resolvedUrl.href;
    }

    return agent(reurl);
  };
  return load;
};

const agent = async (url, opts) => {
  const urldata = new URL(url);
  const { pathname } = urldata;

  const type = pathname.slice(((pathname.lastIndexOf(".") - 1) >>> 0) + 2);

  let data;

  const tasks = processor[type];

  if (tasks) {
    for (let f of tasks) {
      const temp = await f({
        url,
        data,
        ...opts,
      });

      temp !== undefined && (data = temp);
    }
  } else {
    data = fetch(url);
  }

  if (opts && opts.element) {
    const { element } = opts;
    element[LOADED] = true;
    const event = new Event("load");
    element.dispatchEvent(event);
  }

  return data;
};

function lm(meta) {
  return createLoad(meta);
}

Object.assign(lm, {
  use,
});

class LoadModule extends HTMLElement {
  constructor(...args) {
    super(...args);

    this[LOADED] = false;

    Object.defineProperties(this, {
      loaded: {
        get: () => this[LOADED],
      },
    });

    this._init();
  }

  _init() {
    if (this.__initSrc || this.attributes.hasOwnProperty("pause")) {
      return;
    }

    let src = this.getAttribute("src");

    if (!src) {
      return;
      // throw `The ${this.tagName.toLowerCase()} element requires the src attribut `;
    }
    this.__initSrc = src;

    const relatePath = this.getAttribute("relate-path");
    this.removeAttribute("relate-path");
    src = new URL(src, relatePath || location.href).href;
    this.__relatePath = relatePath;
    Object.defineProperties(this, {
      src: {
        configurable: true,
        value: src,
      },
    });
    agent(src, {
      element: this,
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "src") {
      if (newValue && oldValue === null) {
        this._init();
      } else if (this.__initSrc && oldValue && newValue !== this.__initSrc) {
        console.warn(
          `${this.tagName.toLowerCase()} change src is invalid, only the first change will be loaded`
        );
        this.setAttribute("src", this.__initSrc);
      }
    } else if (name === "pause" && newValue === null) {
      this._init();
    }
  }

  static get observedAttributes() {
    return ["src", "pause"];
  }
}

class LM extends LoadModule {
  constructor(...args) {
    super(...args);
  }
}

customElements.define("load-module", LoadModule);
customElements.define("l-m", LM);

if (typeof window !== "undefined") {
  window.lm = lm;
}

export { lm as default };
