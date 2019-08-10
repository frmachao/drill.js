((glo) => {
    "use strict";
    //<!--public-->
    //<!--loaders-->
    //<!--processors-->
    //<!--main-->
    //<!--drillObj-->

    // init 
    glo.load || (glo.load = drill.load);
    glo.define || (glo.define = drill.define);
    glo.task || (glo.task = drill.task);
    glo.init || (glo.init = drill.init);

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
                func(drill);
            } else {
                console.error('drill type error =>', func);
            }
        }
    });

    // 执行全局的 drill函数
    oldDrill && oldDrill(drill);
})(window);