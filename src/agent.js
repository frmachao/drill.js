const getLoader = (fileType) => {
    // 立即请求包处理
    let loader = loaders.get(fileType);

    if (!loader) {
        console.log("no such this loader => " + fileType);
        loader = getByUtf8;
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

const isHttpFront = str => /^http/.test(str);

let agent = async (urlObj) => {
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

        while (true) {
            try {
                // 离线处理
                if (drill.cacheInfo.offline) {
                    packData.fileUrl = packData.link = await cacheSource(packData);
                }

                // 立即请求包处理
                packData.getPack = (await getLoader(urlObj.fileType)(packData)) || (async () => { });

                packData.stat = 3;

                packData._passResolve();
                break;
            } catch (e) {
                console.error("load error =>", e);

                packData.stat = 2;
                if (isHttpFront(urlObj.str)) {
                    // http引用的就别折腾
                    break;
                }
                // 查看后备仓
                let { backups } = errInfo;
                if (backups.length) {
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
                            packData.stat = 4;
                            packData._passReject();
                            break;
                        }

                        if (!isHttpFront(nextBaseUrl)) {
                            nextBaseUrl = frontUrl + nextBaseUrl;
                        }

                        // 替换packData
                        packData.link = packData.link.replace(new RegExp("^" + oldBaseUrl), nextBaseUrl);

                        await new Promise(res => setTimeout(res, errInfo.time));
                    } else {
                        break;
                    }
                }
            }
        }
    }

    // 等待通行证
    await packData.passPromise;

    return await packData.getPack(urlObj);
}