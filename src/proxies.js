import * as utils from './utils.js';
export default async function getMihomo_Proxies_Data(e) {
    // 处理单个URL的情况
    if (e.urls.length === 1) {
        return await handleSingleUrl(e);
    }

    // 处理多个URL的情况
    return await handleMultipleUrls(e);
}

// 处理单个URL的辅助函数
async function handleSingleUrl(e) {
    let res = await fetchWithFallback(e.urls[0], e.userAgent, e.sub);
    console.log(`[${handleSingleUrl.name}]: Fetching proxies from URL 1: ${e.urls[0]}`);
    console.log(`[${handleSingleUrl.name}]: Fetched ${res?.data?.proxies?.length || 0} proxies from URL 1`);

    if (res?.data?.proxies && Array.isArray(res.data.proxies) && res.data.proxies.length > 0) {
        processProxies(res.data.proxies, e.udp);
        return formatResponse(res, { providers: {} });
    }

    return null;
}

// 处理多个URL的辅助函数
async function handleMultipleUrls(e) {
    const data = {
        proxies: [],
        providers: {},
    };

    const responseList = [];

    for (let i = 0; i < e.urls.length; i++) {
        console.log(`[${handleMultipleUrls.name}]: Fetching proxies from URL ${i + 1}: ${e.urls[i]}`);
        const res = await fetchWithFallback(e.urls[i], e.userAgent, e.sub);

        if (res?.data?.proxies && Array.isArray(res.data.proxies)) {
            processProxies(res.data.proxies, e.udp, i + 1);
            responseList.push({
                status: res.status,
                headers: res.headers,
            });
            console.log(`Fetched ${res.data.proxies.length} proxies from URL ${i + 1}`);
            data.proxies.push(...res.data.proxies);
        }
    }

    if (responseList.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * responseList.length);
    const selectedResponse = responseList[randomIndex];

    return {
        status: selectedResponse.status,
        headers: selectedResponse.headers,
        data: data,
    };
}

// 通用获取响应函数，支持回退机制
async function fetchWithFallback(url, userAgent, sub) {
    console.log(`[${fetchWithFallback.name}]: Fetching response from ${url}`);
    let res = await utils.fetchResponse(url, userAgent);

    if (res?.data?.proxies && Array.isArray(res.data.proxies) && res.data.proxies.length > 0) {
        return res;
    }

    // 如果第一次请求失败，尝试使用构建的API URL
    // const apiUrl = utils.buildApiUrl(url, sub, 'clash.meta');
    // console.log(`[${fetchWithFallback.name}]: Fetching response from API URL: ${apiUrl}`);
    // return await utils.fetchResponse(apiUrl, userAgent);
}

// 处理代理数组的辅助函数
function processProxies(proxies, udpEnabled, index = null) {
    proxies.forEach((proxy) => {
        console.log(`[${processProxies.name}]: Processing proxy: ${proxy.name}`);
        if (index !== null) {
            proxy.name = `${proxy.name} [${index}]`;
        }
        if (udpEnabled) {
            proxy.udp = true;
        }
    });
}

// 格式化响应的辅助函数
function formatResponse(originalResponse, additionalData = {}) {
    return {
        status: originalResponse.status,
        headers: originalResponse.headers,
        data: {
            ...originalResponse.data,
            ...additionalData,
        },
    };
}
