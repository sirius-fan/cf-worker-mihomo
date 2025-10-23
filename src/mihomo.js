import * as utils from './utils.js';
import getMihomo_Proxies_Data from './proxies.js';

import {SOME_CONST_PROXY_JSON_LIST} from './myproxy.js';


export async function getmihomo_config(e) {
    if (!/meta|curl|clash.meta|clash|clashverge|mihomo/i.test(e.userAgent)) {
        throw new Error('不支持的客户端');
    }
    e.urls = utils.splitUrlsAndProxies(e.urls);
    console.log(`URLs: ${e.urls.join(', ')}`);
    const [Mihomo_Top_Data, Mihomo_Rule_Data, Mihomo_Proxies_Data, Exclude_Package, Exclude_Address] = await Promise.all([
        utils.Top_Data(e.Mihomo_default),
        utils.Rule_Data(e.rule),
        getMihomo_Proxies_Data(e),
        e.exclude_package ? utils.fetchpackExtract() : null,
        e.exclude_address ? utils.fetchipExtract() : null,
    ]);
    console.log(`[${getmihomo_config.name}]: Fetched Mihomo Top Data with ${Mihomo_Top_Data?.data ? Object.keys(Mihomo_Top_Data.data).length : 0} keys`);
    console.log(`[${getmihomo_config.name}]: Fetched Mihomo Rule Data with ${Mihomo_Rule_Data?.data ? Object.keys(Mihomo_Rule_Data.data).length : 0} keys`);
    console.log(`[${getmihomo_config.name}]: Fetched Mihomo Proxies Data with ${Mihomo_Proxies_Data?.data?.proxies ? Mihomo_Proxies_Data.data.proxies.length : 0} proxies`);
    Mihomo_Proxies_Data.data.proxies.push(...SOME_CONST_PROXY_JSON_LIST); // Trigger re-indexing if necessary
    e.Exclude_Package = Exclude_Package;
    e.Exclude_Address = Exclude_Address;
    if (!Mihomo_Proxies_Data?.data?.proxies || Mihomo_Proxies_Data?.data?.proxies?.length === 0) throw new Error('节点为空');
    Mihomo_Rule_Data.data.proxies = [...(Mihomo_Rule_Data?.data?.proxies || []), ...Mihomo_Proxies_Data?.data?.proxies];
    Mihomo_Rule_Data.data['proxy-groups'] = getMihomo_Proxies_Grouping(Mihomo_Proxies_Data.data, Mihomo_Rule_Data.data);
    Mihomo_Rule_Data.data['proxy-providers'] = Mihomo_Proxies_Data?.data?.providers;
    applyTemplate(Mihomo_Top_Data.data, Mihomo_Rule_Data.data, e);
    return {
        status: Mihomo_Proxies_Data.status,
        headers: Mihomo_Proxies_Data.headers,
        data: JSON.stringify(Mihomo_Top_Data.data, null, 4),
    };
}

/**
 * 将模板中的 proxies、proxy-groups、rules 等字段合并到目标配置对象
 * @param {Object} target - 目标配置对象（基础配置）
 * @param {Object} template - 模板配置对象
 */
export function applyTemplate(top, rule, e) {
    top['proxy-providers'] = rule['proxy-providers'] || {};
    top.proxies = rule.proxies || [];
    top['proxy-groups'] = rule['proxy-groups'] || [];
    top.rules = rule.rules || [];
    top['sub-rules'] = rule['sub-rules'] || {};
    top['rule-providers'] = { ...(top['rule-providers'] || {}), ...(rule['rule-providers'] || {}) };

    if (e.tun && top.tun) {
        top.tun.enable = false;
    } else if (top.tun) {
        if (e.exclude_address && e.Exclude_Address) {
            top.tun['route-address'] = ['0.0.0.0/1', '128.0.0.0/1', '::/1', '8000::/1'];
            top.tun['route-exclude-address'] = e.Exclude_Address || [];
        }
        if (e.exclude_package && e.Exclude_Package) {
            top.tun['include-package'] = [];
            top.tun['exclude-package'] = e.Exclude_Package || [];
        }
    }
    if (e.adgdns) {
        top.dns.nameserver = ['https://dns.adguard-dns.com/dns-query'];
        top.dns['nameserver-policy']['RULE-SET:private_domain,cn_domain'] = ['quic://dns.18bit.cn'];
    }
}

/**
 * 获取 Mihomo 代理分组信息
 * @param {Array} proxies - 代理列表
 * @param {Array} groups - 策略组
 * @returns {Object} 分组信息
 */
export function getMihomo_Proxies_Grouping(proxies, groups) {
    const deletedGroups = []; // 用于记录已删除的组名
    const updatedGroups = groups['proxy-groups'].filter((group) => {
        let matchFound = false;
        // 确保 filter 存在并且是一个字符串
        let filter = group.filter;
        if (typeof filter !== 'string') {
            return true; // 保留没有 filter 的组
        }

        // 移除所有 (?i)，但保留后续内容
        const hasIgnoreCase = /\(\?i\)/i.test(filter);
        const cleanedFilter = filter.replace(/\(\?i\)/gi, '');

        let regex;
        try {
            regex = new RegExp(cleanedFilter, hasIgnoreCase ? 'i' : '');
        } catch (e) {
            console.warn(`无效的正则表达式: ${filter}`, e);
            return true; // 遇到错误时保留该组
        }

        // 遍历每个代理，检查是否与当前组的正则匹配
        for (let proxy of proxies.proxies) {
            if (regex.test(proxy.name)) {
                matchFound = true;
                break;
            }
        }

        // 如果没有匹配，记录删除的组并返回 false (删除该组)
        if (!matchFound && (!group.proxies || group.proxies.length === 0)) {
            deletedGroups.push(group.name);
            return false;
        }

        return true;
    });

    // 遍历所有策略组，删除 deletedGroups 中的代理
    updatedGroups.forEach((group) => {
        if (group.proxies) {
            group.proxies = group.proxies.filter((proxyName) => {
                // 只删除那些在 deletedGroups 中的代理
                return !deletedGroups.some((deletedGroup) => {
                    return deletedGroup.includes(proxyName); // 检查 deletedGroups 中是否包含该代理名称
                });
            });
        }
    });

    return updatedGroups;
}
