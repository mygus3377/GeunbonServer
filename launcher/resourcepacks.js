// 리소스팩 자동 설치: Modrinth 원본에서 직접 받고(재배포 X), options.txt 에 적용 순서를 맞춘다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

function fileSha1(p) {
    return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
}

async function resolvePack(p, mcVersion, userAgent) {
    if (!p.modrinth) return { url: p.url, sha1: p.sha1, filename: p.filename };
    const res = await axios.get(`https://api.modrinth.com/v2/project/${p.modrinth}/version`, {
        params: { game_versions: JSON.stringify([mcVersion]) },
        headers: { 'User-Agent': userAgent },
        timeout: 10000
    });
    const v = res.data && res.data[0];
    if (!v) throw new Error(`${mcVersion} 버전이 없습니다`);
    const f = v.files.find(x => x.primary) || v.files[0];
    return { url: f.url, sha1: f.hashes && f.hashes.sha1, filename: f.filename };
}

async function download(url, dest, onPercent) {
    const res = await axios({ method: 'get', url, responseType: 'stream', timeout: 30000 });
    const total = Number(res.headers['content-length']) || 0;
    let got = 0, last = -1;
    const tmp = dest + '.part';
    await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(tmp);
        res.data.on('data', c => {
            got += c.length;
            const pct = total ? Math.floor(got / total * 100) : 0;
            if (pct !== last && pct % 10 === 0) { last = pct; onPercent(pct); }
        });
        res.data.pipe(w);
        w.on('finish', resolve);
        w.on('error', reject);
    });
    fs.renameSync(tmp, dest);
}

/** options.txt 의 resourcePacks 에 우리 팩을 맨 위(목록 끝)로 넣는다. 사용자가 추가한 다른 팩은 유지. */
function applyToOptions(minecraftDir, packs, names) {
    const optPath = path.join(minecraftDir, 'options.txt');
    let text = fs.existsSync(optPath) ? fs.readFileSync(optPath, 'utf8') : '';
    const m = text.match(/^resourcePacks:(.*)$/m);
    let list = [];
    try { list = m ? JSON.parse(m[1]) : []; } catch (e) { list = []; }
    const prefixes = packs.map(p => 'file/' + (p.prefix || p.filename || ''));
    list = list.filter(x => !prefixes.some(pre => pre !== 'file/' && x.startsWith(pre)));
    for (const base of ['mod_resources', 'vanilla']) if (!list.includes(base)) list.unshift(base);
    list.push(...names.map(n => 'file/' + n));
    const line = 'resourcePacks:' + JSON.stringify(list);
    text = m ? text.replace(/^resourcePacks:.*$/m, line) : (text + (text.endsWith('\n') || !text ? '' : '\n') + line + '\n');
    fs.writeFileSync(optPath, text, 'utf8');
}

async function ensureResourcePacks(minecraftDir, packs, mcVersion, userAgent, onLog) {
    if (!packs || !packs.length) return;
    const dir = path.join(minecraftDir, 'resourcepacks');
    fs.mkdirSync(dir, { recursive: true });
    const names = [];
    for (const p of packs) {
        const label = p.modrinth || p.filename;
        try {
            const { url, sha1, filename } = await resolvePack(p, mcVersion, userAgent);
            const dest = path.join(dir, filename);
            const ok = fs.existsSync(dest) && (!sha1 || fileSha1(dest) === sha1);
            if (!ok) {
                onLog(`[리소스팩] ${filename} 받는 중...`);
                await download(url, dest, pct => onLog(`[리소스팩] ${filename} ${pct}%`));
                if (sha1 && fileSha1(dest) !== sha1) throw new Error('해시 불일치');
            }
            names.push(filename);
            onLog(`[리소스팩] ${filename} 준비 완료`);
        } catch (e) {
            onLog(`[리소스팩] ${label} 실패: ${e.message}`, 'error');
        }
    }
    applyToOptions(minecraftDir, packs, names);
}

module.exports = { ensureResourcePacks };
