// Modrinth 에서 직접 받는 추가 모드·셰이더팩 (Lost Cities, Iris+Sodium, 셰이더팩).
// 버전은 실행 시점 최신 호환판을 고르되, config 에 version(버전 번호 또는 id)을 적으면 고정된다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const API = 'https://api.modrinth.com/v2';

function sha1(p) {
    return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
}

async function api(url, ua, params) {
    const res = await axios.get(API + url, { params, headers: { 'User-Agent': ua }, timeout: 15000 });
    return res.data;
}

/** 프로젝트에서 조건에 맞는 버전 하나 고르기. */
async function pickVersion(project, { loader, version }, mcVersion, ua) {
    const params = { game_versions: JSON.stringify([mcVersion]) };
    if (loader) params.loaders = JSON.stringify([loader]);
    const list = await api(`/project/${project}/version`, ua, params);
    if (!list.length) throw new Error(`${mcVersion}${loader ? '/' + loader : ''} 버전 없음`);
    if (version) {
        const v = list.find(x => x.id === version || x.version_number === version);
        if (!v) throw new Error(`고정 버전 ${version} 을 찾을 수 없음`);
        return v;
    }
    return list.find(x => x.version_type === 'release') || list[0];
}

function primaryFile(v) {
    return v.files.find(f => f.primary) || v.files[0];
}

async function download(url, dest, onLog, label) {
    const res = await axios({ method: 'get', url, responseType: 'stream', timeout: 30000 });
    const total = Number(res.headers['content-length']) || 0;
    let got = 0, last = -1;
    const tmp = dest + '.part';
    await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(tmp);
        res.data.on('data', c => {
            got += c.length;
            const pct = total ? Math.floor(got / total * 100) : 0;
            if (pct % 25 === 0 && pct !== last) { last = pct; onLog(`[추가 설치] ${label} ${pct}%`); }
        });
        res.data.pipe(w);
        w.on('finish', resolve);
        w.on('error', reject);
    });
    fs.renameSync(tmp, dest);
}

/** 같은 프로젝트의 옛 버전 파일 정리 (prefix 로 시작하고 새 파일이 아닌 것). */
function removeOld(dir, prefix, keep, onLog) {
    if (!prefix) return;
    for (const f of fs.readdirSync(dir)) {
        if (f !== keep && f.toLowerCase().startsWith(prefix.toLowerCase())) {
            try { fs.unlinkSync(path.join(dir, f)); onLog(`[추가 설치] 옛 버전 제거: ${f}`); } catch (e) { /* 사용 중이면 다음에 */ }
        }
    }
}

async function installVersion(v, dir, prefix, onLog) {
    const f = primaryFile(v);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, f.filename);
    const want = f.hashes && f.hashes.sha1;
    if (!(fs.existsSync(dest) && (!want || sha1(dest) === want))) {
        await download(f.url, dest, onLog, f.filename);
        if (want && sha1(dest) !== want) throw new Error(`${f.filename} 해시 불일치`);
    }
    removeOld(dir, prefix, f.filename, onLog);
    return f.filename;
}

/**
 * extras: [{ modrinth, dir: 'mods'|'shaderpacks'|..., loader, version, prefix, deps }]
 * deps=true 면 필수 의존 모드(예: Iris → Sodium)를 같은 mods 폴더에 함께 설치. 의존이 버전 id 를 지정하면 그 버전으로.
 * 반환: { [modrinth]: 설치된 파일명 }
 */
async function ensureExtras(minecraftDir, extras, mcVersion, ua, onLog) {
    const installed = {};
    for (const e of extras || []) {
        try {
            const v = await pickVersion(e.modrinth, e, mcVersion, ua);
            const dir = path.join(minecraftDir, e.dir);
            installed[e.modrinth] = await installVersion(v, dir, e.prefix, onLog);
            onLog(`[추가 설치] ${installed[e.modrinth]} 준비 완료`);
            if (e.deps) {
                for (const d of (v.dependencies || []).filter(d => d.dependency_type === 'required' && d.project_id)) {
                    const dv = d.version_id
                        ? await api(`/version/${d.version_id}`, ua)
                        : await pickVersion(d.project_id, { loader: e.loader }, mcVersion, ua);
                    const name = await installVersion(dv, path.join(minecraftDir, 'mods'), null, onLog);
                    onLog(`[추가 설치] 의존 모드 ${name} 준비 완료`);
                }
            }
        } catch (err) {
            onLog(`[추가 설치] ${e.modrinth} 실패: ${err.message}`, 'error');
        }
    }
    return installed;
}

/**
 * Iris 첫 설정: 근본 셰이더(우리 팩, 저장소에서 동기화)가 있으면 그걸 켜고, 없으면 받은 팩을 골라두되 꺼둠.
 * 이미 iris.properties 가 있으면(사용자가 고른 설정) 건드리지 않는다.
 */
function initIris(minecraftDir, shaderFile) {
    const p = path.join(minecraftDir, 'config', 'iris.properties');
    if (fs.existsSync(p)) return;
    const ours = 'GeunbonShaders.zip';
    const hasOurs = fs.existsSync(path.join(minecraftDir, 'shaderpacks', ours));
    if (!hasOurs && !shaderFile) return;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, hasOurs ? `enableShaders=true\nshaderPack=${ours}\n` : `enableShaders=false\nshaderPack=${shaderFile}\n`, 'utf8');
}

module.exports = { ensureExtras, initIris };

/** 깃허브 저장소의 configs/<경로> 를 게임 config/<경로> 로 받아 덮어씀 (Lost Cities 프로필 등, 작은 파일). */
async function ensureConfigs(minecraftDir, rawBase, files, onLog) {
    for (const rel of files || []) {
        try {
            const res = await axios.get(`${rawBase}/configs/${rel}?nocache=${Date.now()}`, { responseType: 'text', timeout: 10000 });
            const dest = path.join(minecraftDir, 'config', ...rel.split('/'));
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
            fs.writeFileSync(dest, body, 'utf8');
            onLog(`[설정] ${rel} 적용`);
        } catch (e) {
            onLog(`[설정] ${rel} 실패: ${e.message}`, 'error');
        }
    }
}

module.exports.ensureConfigs = ensureConfigs;
