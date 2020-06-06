/*!
 * drill.js v3.4.6
 * https://github.com/kirakiray/drill.js
 * 
 * (c) 2018-2020 YAO
 * Released under the MIT License.
 */
((glo) => {
    "use strict";
    // common
    // 处理器（针对js类型）
    const processors = new Map();
    // 加载器（针对文件类型）
    const loaders = new Map();
    // 地址寄存器
    const bag = new Map();

    // 映射资源
    const paths = new Map();

    // 映射目录
    const dirpaths = {};

    // 错误处理数据
    let errInfo = {
        // 加载错误之后，再次加载的间隔时间(毫秒)
        time: 100,
        // baseUrl后备仓
        backups: []
    };

    // 基础数据对象
    let base = {
        processors,
        loaders,
        bag,
        paths,
        dirpaths,
        errInfo,
        // 根目录
        baseUrl: "",
        // 临时挂起的模块对象
        tempM: {}
    };

    // function
    // 获取随机id
    const getRandomId = () => Math.random().toString(32).substr(2);
    var objectToString = Object.prototype.toString;
    var getType = value => objectToString.call(value).toLowerCase().replace(/(\[object )|(])/g, '');
    const isFunction = d => getType(d).search('function') > -1;
    var isEmptyObj = obj => !(0 in Object.keys(obj));

    //改良异步方法
    const nextTick = (() => {
        if (document.currentScript.getAttribute("debug") !== null) {
            return setTimeout;
        }

        if (typeof process === "object" && process.nextTick) {
            return process.nextTick;
        }

        let isTick = false;
        let nextTickArr = [];
        return (fun) => {
            if (!isTick) {
                isTick = true;
                setTimeout(() => {
                    for (let i = 0; i < nextTickArr.length; i++) {
                        nextTickArr[i]();
                    }
                    nextTickArr = [];
                    isTick = false;
                }, 0);
            }
            nextTickArr.push(fun);
        };
    })();

    // 获取文件类型
    const getFileType = url => {
        let lastOri = url.split('/').pop();
        let fileType;
        let sArr = lastOri.match(/(.+)\.(.+)/);
        if (sArr) {
            // 得出文件类型
            fileType = sArr[2];
        }
        return fileType;
    };

    // 获取目录名
    const getDir = url => {
        url = url.replace(/(.+)#.+/, "$1");
        url = url.replace(/(.+)\?.+/, "$1");
        let urlArr = url.match(/(.+\/).*/);
        return urlArr && urlArr[1];
    };

    //修正字符串路径
    const removeParentPath = (url) => {
        let urlArr = url.split(/\//g);
        let newArr = [];
        urlArr.forEach((e) => {
            if (e == '..' && newArr.length && (newArr.slice(-1)[0] != "..")) {
                newArr.pop();
                return;
            }
            newArr.push(e);
        });
        return newArr.join('/');
    };

    // 获取根目录地址
    const rootHref = getDir(document.location.href);

    // loaders添加css
    loaders.set("css", (packData) => {
        return new Promise((res, rej) => {
            // 给主体添加css
            let linkEle = document.createElement('link');
            linkEle.rel = "stylesheet";
            linkEle.href = packData.link;

            let isAddLink = false;

            linkEle.onload = () => {
                document.head.removeChild(linkEle);
                res(async (e) => {
                    // 在有获取内容的情况下，才重新加入link
                    if (!isAddLink && !e.param.includes("-getPath")) {
                        isAddLink = true;
                        document.head.appendChild(linkEle);
                    }
                    return linkEle
                });
            }

            linkEle.onerror = (e) => {
                rej({
                    desc: "load link error",
                    target: linkEle,
                    event: e
                });
            }

            // 添加到head
            document.head.appendChild(linkEle);
        });
    });

    // loaders添加json支持
    loaders.set("json", async (packData) => {
        let data = await fetch(packData.link);

        // 转换json格式
        data = await data.json();

        return async () => {
            return data;
        }
    });

    // loaders添加wasm支持
    loaders.set("wasm", async (packData) => {
        let data = await fetch(packData.link);

        // 转换arrayBuffer格式
        data = await data.arrayBuffer();

        // 转换wasm模块
        let module = await WebAssembly.compile(data);
        const instance = new WebAssembly.Instance(module);

        return async () => {
            return instance.exports;
        }
    });

    // loaders添加iframe辅助线程支持
    loaders.set("frame", async (packData) => {
        // 新建iframe
        let iframeEle = document.createElement("iframe");

        // 设置不可见样式
        Object.assign(iframeEle.style, {
            position: "absolute",
            "z-index": "-1",
            border: "none",
            outline: "none",
            opacity: "0",
            width: "0",
            height: "0"
        });

        // 转换并获取真实链接
        let {
            link,
            path
        } = packData;

        // 更新path
        let newPath = path.replace(/\.frame$/, "/frame.html");

        // 更新link
        let newLink = link.replace(path, newPath);

        // 设置链接
        iframeEle.src = newLink;

        // taskID记录器
        let taskIDs = new Map();

        // 添加计时器，当计算都完成时，计时10秒内，没有传入参数操作，就进行回收进程
        let clearer = () => {
            // 清除对象
            bag.delete(path);

            // 去除iframe
            document.body.removeChild(iframeEle);

            // 去除message监听
            window.removeEventListener("message", messageFun);

            // 快速内存回收
            messageFun = packData = clearer = null;
        };
        packData.timer = setTimeout(clearer, 10000);

        // 设置getPack函数
        let getPack = (urlData) => new Promise(res => {
            // 计算taskId
            let taskId = getRandomId();

            // 清除计时器
            clearTimeout(packData.timer);

            // 添加taskID和相应函数
            taskIDs.set(taskId, {
                res
            });

            // 发送数据过去
            iframeEle.contentWindow.postMessage({
                type: "drillFrameTask",
                taskId,
                data: urlData.data
            }, '*');
        })

        // 在 windows上设置接收器
        let messageFun;
        window.addEventListener("message", messageFun = e => {
            let {
                data,
                taskId
            } = e.data;

            // 判断是否在taskID内
            if (taskIDs.has(taskId)) {
                // 获取记录对象
                let taskObj = taskIDs.get(taskId);

                // 去除taskID
                taskIDs.delete(taskId);

                // 返回数据
                taskObj.res(data);
            }

            // 当库存为0时，计时清理函数
            if (!taskIDs.size) {
                packData.timer = setTimeout(clearer, 10000);
            }
        });

        return new Promise((res, rej) => {
            // 加载完成函数
            iframeEle.addEventListener('load', e => {
                res(getPack);
            });

            // 错误函数
            iframeEle.addEventListener('error', e => {
                clearer();
                rej();
            });

            // 添加到body
            document.body.appendChild(iframeEle);
        });
    });

    // loaders添加js加载方式
    loaders.set("js", (packData) => {
        return new Promise((resolve, reject) => {
            // 主体script
            let script = document.createElement('script');

            //填充相应数据
            script.type = 'text/javascript';
            script.async = true;
            script.src = packData.link;

            // 添加事件
            script.addEventListener('load', async () => {
                // 根据tempM数据设置type
                let {
                    tempM
                } = base;

                let getPack;

                // type:
                // file 普通文件类型
                // define 模块类型
                // task 进程类型
                let {
                    type,
                    moduleId
                } = tempM;

                // 判断是否有自定义id
                if (moduleId) {
                    bag.get(moduleId) || bag.set(moduleId, packData);
                }

                // 进行processors断定
                // 默认是file类型
                let process = processors.get(type || "file");

                if (process) {
                    getPack = await process(packData);
                } else {
                    throw "no such this processor => " + type;
                }

                resolve(getPack);
            });
            script.addEventListener('error', () => {
                // 加载错误
                reject();
            });

            // 添加进主体
            document.head.appendChild(script);
        });
    });

    // 对es6 module 支持
    loaders.set("mjs", async packData => {
        let d = await import(packData.link);

        return async () => {
            return d;
        }
    });
    // 直接返回缓存地址的类型
    const returnUrlSets = new Set(["png", "jpg", "jpeg", "bmp", "gif", "webp"]);

    const getLoader = (fileType) => {
        // 立即请求包处理
        let loader = loaders.get(fileType);

        if (!loader) {
            console.log("no such this loader => " + fileType);
            loader = getByUtf8;
        }

        // 判断是否图片
        if (returnUrlSets.has(fileType)) {
            loader = getByUrl;
        }

        return loader;
    }

    // 获取并通过utf8返回数据
    const getByUtf8 = async packData => {
        let data = await fetch(packData.link);

        // 转换text格式
        data = await data.text();

        // 重置getPack
        return async () => {
            return data;
        }
    }

    // 返回内存的地址
    const getByUrl = async packData => {
        // 判断是否已经在缓存内
        if (packData.offlineUrl) {
            return async () => {
                return packData.offlineUrl;
            }
        }

        let data = await fetch(packData.link);

        let fileBlob = await data.blob();

        let url = URL.createObjectURL(fileBlob);

        return async () => {
            return url;
        }
    }

    const isHttpFront = str => /^http/.test(str);

    let agent = async (urlObj) => {
        // getLink直接返回
        if (urlObj.param && (urlObj.param.includes("-getLink")) && !drill.cacheInfo.offline) {
            return Promise.resolve(urlObj.link);
        }

        // 根据url获取资源状态
        let packData = bag.get(urlObj.path);

        if (!packData) {
            packData = {
                // 加载状态
                // 1加载中
                // 2加载错误，重新装载中
                // 3加载完成
                // 4彻底加载错误，别瞎折腾了
                stat: 1,
                // 路径相关信息
                dir: urlObj.dir,
                path: urlObj.path,
                link: urlObj.link,
                // 记录装载状态
                fileType: urlObj.fileType,
                // 包的getter函数
                // 包加载完成时候，有特殊功能的，请替换掉async getPack函数
                // async getPack(urlObj) { }
            };

            // 等待通行的令牌
            packData.passPromise = new Promise((res, rej) => {
                packData._passResolve = res;
                packData._passReject = rej;
            });

            // 设置包数据
            bag.set(urlObj.path, packData);

            // 存储错误资源地址
            let errPaths = [packData.link];

            const errCall = () => {
                packData.stat = 4;
                packData._passReject({
                    desc: `load source error`,
                    link: errPaths,
                    packData
                });
            }

            while (true) {
                try {
                    // 文件link中转
                    packData.link = await cacheSource({
                        packData
                    });

                    // 立即请求包处理
                    packData.getPack = (await getLoader(urlObj.fileType)(packData)) || (async () => {});

                    packData.stat = 3;

                    packData._passResolve();
                    break;
                } catch (e) {
                    // console.error("load error =>", e);

                    packData.stat = 2;
                    if (isHttpFront(urlObj.str)) {
                        // http引用的就别折腾
                        break;
                    }
                    // 查看后备仓
                    let {
                        backups
                    } = errInfo;
                    if (!backups.length) {
                        errCall();
                        break;
                    } else {
                        // 查看当前用了几个后备仓
                        let backupId = (packData.backupId != undefined) ? packData.backupId : (packData.backupId = -1);

                        // 重新加载包
                        if (backupId < backups.length) {
                            // 获取旧的地址
                            let oldBaseUrl = backups[backupId] || base.baseUrl;
                            let frontUrl = location.href.replace(/(.+\/).+/, "$1")

                            if (!isHttpFront(oldBaseUrl)) {
                                // 补充地址
                                oldBaseUrl = frontUrl + oldBaseUrl;
                            }

                            // 下一个地址
                            backupId = ++packData.backupId;

                            // 补充下一个地址
                            let nextBaseUrl = backups[backupId];

                            if (!nextBaseUrl) {
                                // 没有下一个就跳出
                                errCall();
                                break;
                            }

                            if (!isHttpFront(nextBaseUrl)) {
                                nextBaseUrl = frontUrl + nextBaseUrl;
                            }

                            // 替换packData
                            packData.link = packData.link.replace(new RegExp("^" + oldBaseUrl), nextBaseUrl);
                            errPaths.push(packData.link);

                            await new Promise(res => setTimeout(res, errInfo.time));
                        } else {
                            packData.stat = 4;
                            errCall();
                            break;
                        }
                    }
                }
            }
        }

        // 等待通行证
        await packData.passPromise;

        // 在offline情况下，返回link
        if (urlObj.param && (urlObj.param.includes("-getLink")) && drill.cacheInfo.offline) {
            return Promise.resolve(packData.link);
        }

        return await packData.getPack(urlObj);
    }
    const drill = {
        load(...args) {
            return load(toUrlObjs(args));
        },
        remove(url) {
            let {
                path
            } = fixUrlObj({
                str: url
            });

            if (bag.has(path)) {
                bag.delete(path);

                //告示删除成功
                return !0;
            } else {
                console.warn(`pack %c${url}`, "color:red", `does not exist`);
            }
        },
        has(url) {
            let {
                path
            } = fixUrlObj({
                str: url
            });

            let packData = bag.get(path);

            return packData && packData.stat;
        },
        config(options) {
            options.baseUrl && (base.baseUrl = options.baseUrl);

            //配置paths
            let oPaths = options.paths;
            oPaths && Object.keys(oPaths).forEach(i => {
                if (/\/$/.test(i)) {
                    //属于目录类型
                    dirpaths[i] = {
                        // 正则
                        reg: new RegExp('^' + i),
                        // 值
                        value: oPaths[i]
                    };
                } else {
                    //属于资源类型
                    paths.set(i, oPaths[i]);
                }
            });

            // 后备仓
            if (base.baseUrl && options.backups) {
                options.backups.forEach(url => errInfo.backups.push(url));
            }
        },
        // 扩展开发入口
        ext(f_name, func) {
            if (isFunction(f_name)) {
                f_name(base);
            } else {
                // 旧的方法
                let oldFunc;

                // 中间件方法
                let middlewareFunc = (...args) => func(args, oldFunc, base);

                switch (f_name) {
                    case "fixUrlObj":
                        oldFunc = fixUrlObj;
                        fixUrlObj = middlewareFunc;
                        break;
                    case "load":
                        oldFunc = load;
                        load = middlewareFunc;
                        break;
                    case "agent":
                        oldFunc = agent;
                        agent = middlewareFunc;
                        break;
                    case "cacheSource":
                        oldFunc = cacheSource;
                        cacheSource = middlewareFunc;
                        break;
                }
            }
        },
        cacheInfo: {
            k: "d_ver",
            v: "",
            // 默认不缓存到本地
            offline: false
        },
        debug: {
            bag
        },
        version: "3.4.6",
        v: 3004006
    };
    // 设置加载器
    let setProcessor = (processName, processRunner) => {
        processors.set(processName, async (packData) => {
            let tempData = base.tempM.d;
            // 提前清空
            base.tempM = {};
            return await processRunner(packData, tempData, {
                // 相对的加载函数
                relativeLoad(...args) {
                    return load(toUrlObjs(args, packData.dir));
                }
            });
        });

        // 特定类型记录器
        let processDefineFunc = (d, moduleId) => {
            base.tempM = {
                type: processName,
                d,
                moduleId
            };
        }

        drill[processName] || (drill[processName] = processDefineFunc);
        glo[processName] || (glo[processName] = processDefineFunc);
    }

    // 主体加载函数
    let load = (urlObjs) => {
        let pendFunc;
        let p = new Promise((res, rej) => {
            // 要返回的数据
            let reValue = [];

            // 获取原来的长度
            let {
                length
            } = urlObjs;
            let sum = length;

            // 是否有出错
            let hasError = [];

            urlObjs.forEach(async (obj, i) => {
                // 载入的状态
                let stat = "succeed";

                // 中转加载资源
                let d;

                // 等待一次异步操作，确保post数据完整
                await new Promise(res => nextTick(res))

                d = await agent(obj).catch(e => {
                    stat = "error";
                    Object.assign(obj, {
                        type: "error",
                        descript: e
                    });
                    hasError.push(obj);
                });

                // 设置数据
                reValue[i] = d;

                // 触发pending
                pendFunc && pendFunc({
                    // 当前所处id
                    id: i,
                    // 总数
                    sum,
                    ready: sum - length + 1,
                    stat
                });

                // 计时减少
                length--;

                if (!length) {
                    if (!hasError.length) {
                        // 单个的话直接返回单个的数据
                        if (sum == 1) {
                            res(d);
                        } else {
                            res(reValue);
                        }
                    } else {
                        // 出错了
                        rej(hasError);
                    }
                    reValue = null;
                }
            });
        });

        // 挂载两个方法
        p.post = function(data) {
            urlObjs.forEach(e => e.data = data);
            return this;
        };
        p.pend = function(func) {
            pendFunc = func;
            return this;
        };

        return p;
    }

    // 转换出url字符串对象
    let fixUrlObj = (urlObj) => {
        let {
            str
        } = urlObj;

        // 判断是否注册在bag上的直接的id
        if (bag.has(str)) {
            let tarBag = bag.get(str);
            Object.assign(urlObj, {
                path: tarBag.path,
                link: tarBag.link,
                dir: tarBag.dir
            });
            return urlObj;
        }

        // 拆分空格数据
        let ndata = str.split(/\s/).filter(e => e && e);

        let param = ndata.slice(1);

        // 第一个参数是路径名
        let ori = ndata[0];

        // 拆分问号(?)后面的 url param
        let search = ori.match(/(.+)\?(\S+)$/) || "";
        if (search) {
            ori = search[1];
            search = search[2];
        }
        // 判断是否要加版本号
        let {
            k,
            v
        } = drill.cacheInfo;
        if (k && v) {
            search && (search += "&");
            search += k + '=' + v;
        }

        // 查看是否有映射路径
        let tarpath = paths.get(ori);
        if (tarpath) {
            ori = tarpath;
        } else {
            // 查看是否有映射目录
            // 判断是否注册目录
            for (let i in dirpaths) {
                let tar = dirpaths[i];
                if (tar.reg.test(ori)) {
                    ori = ori.replace(tar.reg, tar.value);
                    break
                }
            }
        }

        // 得出fileType
        let fileType = getFileType(ori) || "js";

        // ori去掉后缀
        ori = ori.replace(new RegExp('\\.' + fileType + "$"), "");

        // 主体path
        let path;

        // 判断是否有基于根目录参数
        if (param.includes('-r') || /^.+:\/\//.test(ori)) {
            path = ori;
        } else if (/^\./.test(ori)) {
            if (urlObj.relative) {
                // 添加相对路径
                path = ori = urlObj.relative + ori
                // path = urlObj.relative + ori;
            } else {
                path = ori.replace(/^\.\//, "");
            }
        } else {
            // 添加相对目录，得出资源地址
            path = base.baseUrl + ori;
        }

        // 判断是否带有 -pack 参数
        if (param.includes('-pack')) {
            let pathArr = path.match(/(.+)\/(.+)/);
            if (pathArr && (2 in pathArr)) {
                ori = path = pathArr[1] + "/" + pathArr[2] + "/" + pathArr[2];
            } else {
                ori = path = `${path}/${path}`
            }
        }

        // 判断不是协议开头的，加上当前的根目录
        if (!/^.+:\/\//.test(path)) {
            path = rootHref + path;
        }

        // 修正单点
        path = path.replace(/\/\.\//, "/");
        ori = ori.replace(/\/\.\//, "/");

        // 修正两点（上级目录）
        if (/\.\.\//.test(path)) {
            path = removeParentPath(path);
            ori = removeParentPath(ori);
        }

        // 添加后缀
        path += "." + fileType;

        // 根据资源地址计算资源目录
        let dir = getDir(path);

        // 写入最终请求资源地址
        let link = search ? (path + "?" + search) : path;

        // 对 -mjs 参数修正
        if (param.includes("-mjs")) {
            fileType = "mjs";
        }

        Object.assign(urlObj, {
            link,
            search,
            ori,
            fileType,
            path,
            dir,
            param
        });

        return urlObj;
    }

    // 轻转换函数
    const toUrlObjs = (args, relative) => {
        // 生成组id
        let groupId = getRandomId();

        // 转化成urlObj
        return args.map((url, id) => fixUrlObj({
            loadId: getRandomId(),
            id,
            str: url,
            groupId,
            relative
        }));
    }
    // processors添加普通文件加载方式
    processors.set("file", (packData) => {
        // 直接修改完成状态，什么都不用做
    });

    // 添加define模块支持
    setProcessor("define", async (packData, d, {
        relativeLoad
    }) => {
        let exports = {},
            module = {
                exports
            };

        // 根据内容填充函数
        if (isFunction(d)) {
            let {
                path,
                dir
            } = packData;

            // 函数类型
            d = d(relativeLoad, exports, module, {
                FILE: path,
                DIR: dir
            });
        }

        // Promise函数
        if (d instanceof Promise) {
            // 等待获取
            d = await d;
        }

        // 判断值是否在 exports 上
        if (!d && !isEmptyObj(module.exports)) {
            d = module.exports;
        }

        return async () => {
            return d;
        };
    });

    // 添加task模块支持
    setProcessor("task", (packData, d, {
        relativeLoad
    }) => {
        // 判断d是否函数
        if (!isFunction(d)) {
            throw 'task must be a function';
        }

        let {
            path,
            dir
        } = packData;

        // 修正getPack方法
        return async (urlData) => {
            let reData = await d(relativeLoad, urlData.data, {
                FILE: path,
                DIR: dir
            });

            return reData;
        }
    });

    // 添加init模块支持
    setProcessor("init", (packData, d, {
        relativeLoad
    }) => {
        // 判断d是否函数
        if (!isFunction(d)) {
            throw 'init must be a function';
        }

        let {
            path,
            dir
        } = packData;

        let isRun = 0;
        let redata;

        // 修正getPack方法
        return async (urlData) => {
            if (isRun) {
                return redata;
            }

            // 等待返回数据
            redata = await d(relativeLoad, urlData.data, {
                FILE: path,
                DIR: dir
            });

            // 设置已运行
            isRun = 1;

            return redata;
        }
    });

    const DBNAME = "drill-cache-db";
    const FILESTABLENAME = 'files';

    // 主体Database对象
    let mainDB;
    // 未处理的队列
    let isInitDB = new Promise((initDBResolve, reject) => {
        const indexedDB = glo.indexedDB || glo.webkitIndexedDB || glo.mozIndexedDB || glo.msIndexedDB;

        // 初始化数据库
        if (indexedDB) {
            // 初始打开
            let openRequest = indexedDB.open(DBNAME, drill.cacheInfo.v || 1);
            openRequest.onupgradeneeded = (e) => {
                // 升级中（初始化中）的db触发事件，db不暴露出去的
                let db = e.target.result;

                // 判断是否存在表
                // 判断是否存在
                if (!db.objectStoreNames.contains(FILESTABLENAME)) {
                    // 建立存储对象空间
                    db.createObjectStore(FILESTABLENAME, {
                        keyPath: "path"
                    });
                } else {
                    // 存在的话先删除
                    db.deleteObjectStore(FILESTABLENAME);

                    // 重新创建
                    db.createObjectStore(FILESTABLENAME, {
                        keyPath: "path"
                    });
                }
            };

            // 初始成功触发的callback
            openRequest.onsuccess = (e) => {
                // 挂载主体db
                mainDB = e.target.result;

                // 确认初始化
                initDBResolve();
            }
        } else {
            reject("rubish browser no indexDB");
        }
    });

    // 加载离线或者数据库文件数据
    // 每个路径文件，要确保只加载一次
    // blobCall 用于扩展程序二次更改使用
    let cacheSource = async ({
        packData
    }) => {
        // 离线处理
        if (!drill.cacheInfo.offline) {
            return packData.link;
        }

        // 等待数据库初始化完成
        await isInitDB;

        // 先从数据库获取数据
        let file = await getFile(packData.path);

        if (!file) {
            // 没有的话就在线下载
            // 请求链接内容
            let p = await fetch(packData.link);

            if (p.status != 200) {
                // 清空状态
                // 加载失败，抛出错误
                throw {
                    type: "cacheSource",
                    desc: "statusError",
                    status: p.status
                };
            }

            // 生成file前的两个重要数据
            let type = p.headers.get('Content-Type').replace(/;.+/, "");
            let fileName = packData.path.replace(/.+\//, "");

            // 生成file格式
            let blob = await p.blob();

            // 生成file
            file = new File([blob], fileName, {
                type
            })

            // 存储到数据库中
            await saveFile(packData.path, file);
        }

        // 挂载file文件
        packData.offlineFile = file;

        // 生成url
        let tempUrl = packData.offlineUrl = URL.createObjectURL(file);

        return tempUrl;
    }


    // 获取数据方法
    const getFile = path => new Promise((res, rej) => {
        // 新建事务
        var t = mainDB.transaction([FILESTABLENAME], "readonly");
        let store = t.objectStore(FILESTABLENAME);
        let req = store.get(path);
        req.onsuccess = () => {
            res(req.result && req.result.data);
        }
        req.onerror = (e) => {
            rej();
            console.error(`error load ${path}`, e);
        }
    });

    // 保存数据
    const saveFile = (path, file) => new Promise((res, rej) => {
        // 新建事务
        var t = mainDB.transaction([FILESTABLENAME], "readwrite");
        let store = t.objectStore(FILESTABLENAME);
        let req = store.put({
            path,
            data: file
        });
        req.onsuccess = () => {
            res({
                stat: 1
            });
            console.log(`save ${path} succeed`);
        };
        req.onerror = (e) => {
            res({
                stat: 0
            })
            console.error(`save (${path}) error`, e);
        };
    });

    // 挂载主体方法
    Object.defineProperty(base, "main", {
        value: {
            get agent() {
                return agent;
            },
            get load() {
                return load;
            },
            get fixUrlObj() {
                return fixUrlObj;
            },
            get toUrlObjs() {
                return toUrlObjs;
            },
            get setProcessor() {
                return setProcessor;
            }
        }
    });

    // init 
    glo.load || (glo.load = drill.load);

    // 初始化版本号
    let cScript = document.currentScript;
    !cScript && (cScript = document.querySelector(['drill-cache']));

    if (cScript) {
        let cacheVersion = cScript.getAttribute('drill-cache');
        cacheVersion && (drill.cacheInfo.v = cacheVersion);
    }

    // 判断全局是否存在变量 drill
    let oldDrill = glo.drill;

    // 定义全局drill
    Object.defineProperty(glo, 'drill', {
        get: () => drill,
        set(func) {
            if (isFunction(func)) {
                nextTick(() => func(drill));
            } else {
                console.error('drill type error =>', func);
            }
        }
    });

    // 执行全局的 drill函数
    oldDrill && nextTick(() => oldDrill(drill));
})(window);