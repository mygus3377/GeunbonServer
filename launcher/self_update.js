// 런처 자동 업데이트: 저장소 manifest.json 의 launcher_files 와 내 파일(resources/app) 해시를 비교해
// 바뀐 파일만 받아 덮어쓰고 재시작한다. node_modules·Electron 자체는 대상 아님(그땐 zip 재배포).
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

async function selfUpdate(getRawBase, userAgent) {
    if (!app.isPackaged) return false;                       // npm start(개발) 중엔 건너뜀
    if (process.argv.includes('--self-updated')) return false; // 방금 갱신했으면 한 번만
    try {
        const base = await getRawBase();
        const opt = { headers: { 'User-Agent': userAgent, 'Cache-Control': 'no-cache' }, timeout: 8000 };
        const m = (await axios.get(`${base}/manifest.json`, opt)).data;
        const list = (m && m.launcher_files) || [];
        const dir = __dirname;
        const todo = list.filter(f => {
            if (!/^[\w.\-]+$/.test(f.path)) return false;      // 하위 폴더·경로 탈출 금지
            const p = path.join(dir, f.path);
            return !fs.existsSync(p) || sha(fs.readFileSync(p)) !== f.sha256;
        });
        if (!todo.length) return false;
        const got = [];                                        // 전부 받고 검증한 뒤에 한꺼번에 씀
        for (const f of todo) {
            const r = await axios.get(`${base}/launcher/${encodeURIComponent(f.path)}`, { ...opt, responseType: 'arraybuffer' });
            const buf = Buffer.from(r.data);
            if (sha(buf) !== f.sha256) throw new Error(`해시 불일치: ${f.path}`);
            got.push([f.path, buf]);
        }
        for (const [p, buf] of got) {
            const tmp = path.join(dir, p + '.new');
            fs.writeFileSync(tmp, buf);
            fs.renameSync(tmp, path.join(dir, p));
        }
        console.log(`[SelfUpdate] ${got.length}개 파일 갱신 → 재시작`);
        app.relaunch({ args: process.argv.slice(1).concat('--self-updated') });
        app.exit(0);
        return true;
    } catch (err) {
        console.warn('[SelfUpdate] 건너뜀:', err.message);   // 실패해도 런처는 그냥 켜짐
        return false;
    }
}

module.exports = { selfUpdate };
