import 'dotenv/config';
import express from 'express';
import { getmihomo_config } from './src/mihomo.js';
import { getsingbox_config } from './src/singbox.js';
import { getv2ray_config } from './src/v2ray.js';
import { getFakePage } from './src/page.js';
import * as utils from './src/utils.js';

const app = express();
const PORT = process.env.PORT || 3000;
const ADDR = process.env.ADDR || 'localhost';
console.log(`Binding to address: ${ADDR}`);
// 环境变量配置
const config = {
    IMG: process.env.IMG || utils.backimg,
    SUB: process.env.SUB || utils.subapi,
    MIHOMOTOP: process.env.MIHOMOTOP || utils.mihomo_top,
    SINGBOX_1_11: process.env.SINGBOX_1_11 || utils.singbox_1_11,
    SINGBOX_1_12: process.env.SINGBOX_1_12 || utils.singbox_1_12,
    SINGBOX_1_12_ALPHA: process.env.SINGBOX_1_12_ALPHA || utils.singbox_1_12_alpha,
    SINGBOX_1_13: process.env.SINGBOX_1_13 || utils.singbox_1_13,
    BEIAN: process.env.BEIAN || utils.beiantext,
    BEIANURL: process.env.BEIANURL || utils.beiandizi,
    MIHOMO: process.env.MIHOMO || '',
    SINGBOX: process.env.SINGBOX || '',
};

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 主路由处理
app.get('/', async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        
        // 构建请求参数
        const e = {
            url,
            urls: url.searchParams.getAll('url'),
            userAgent: req.headers['user-agent'] || '',
            rule: url.searchParams.get('template'),
            singbox: url.searchParams.get('singbox') === 'true',
            mihomo: url.searchParams.get('mihomo') === 'true',
            v2ray: url.searchParams.get('v2ray') === 'true',
            udp: url.searchParams.get('udp') === 'true',
            udp_fragment: url.searchParams.get('udp_frag') === 'true',
            tls_fragment: url.searchParams.get('tls_frag') === 'true',
            exclude_package: url.searchParams.get('ep') === 'true',
            exclude_address: url.searchParams.get('ea') === 'true',
            tailscale: url.searchParams.get('tailscale') === 'true',
            tun: url.searchParams.get('tun') === 'true',
            adgdns: url.searchParams.get('adgdns') === 'true',
            IMG: config.IMG,
            sub: config.SUB,
            Mihomo_default: config.MIHOMOTOP,
            singbox_1_11: config.SINGBOX_1_11,
            singbox_1_12: config.SINGBOX_1_12,
            singbox_1_12_alpha: config.SINGBOX_1_12_ALPHA,
            singbox_1_13: config.SINGBOX_1_13,
            beian: config.BEIAN,
            beianurl: config.BEIANURL,
            configs: utils.configs(config.MIHOMO, config.SINGBOX),
        };

        e.modes = utils.modes(e.sub, e.userAgent);
        // console.log(`Processing request with modes: ${e.modes}`);
        console.log(`URL: ${e.url}`);
        console.log(`URLs: ${e.urls.join(', ')}`);
        // 处理逗号分隔的多个 URL
        if (e.urls.length === 1 && e.urls[0].includes(',')) {
            e.urls = e.urls[0].split(',').map((u) => u.trim());
        }

        // 如果没有提供 URL，返回配置页面
        if (e.urls.length === 0 || e.urls[0] === '') {
            const html = await getFakePage(e);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(html);
        }

        // 处理配置生成请求
        let result;
        if (e.singbox) {
            result = await getsingbox_config(e);
        } else if (e.mihomo) {
            result = await getmihomo_config(e);
        } else if (e.v2ray) {
            result = await getv2ray_config(e);
        } else {
            throw new Error('请指定配置类型: singbox, mihomo 或 v2ray');
        }

        // 设置响应头
        const headersToIgnore = ['transfer-encoding', 'content-length', 'content-encoding', 'connection'];
        const responseHeaders = result.headers || {};
        for (const [key, value] of Object.entries(responseHeaders)) {
            if (!headersToIgnore.includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Profile-web-page-url', url.origin);
        res.status(result.status || 200);
        res.send(result.data);

    } catch (error) {
        console.error('请求处理错误:', error);
        res.status(400).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, ADDR, () => {
    console.log(`🚀 服务器启动成功！`);
    console.log(`📍 监听地址: http://${ADDR}:${PORT}`);
    console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⚙️  配置:`);
    console.log(`   - 后端转换: ${config.SUB}`);
    console.log(`   - Mihomo模板: ${config.MIHOMOTOP ? '已配置' : '使用默认'}`);
    console.log(`   - Singbox模板: ${config.SINGBOX_1_13 ? '已配置' : '使用默认'}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭服务器...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，正在关闭服务器...');
    process.exit(0);
});