// 근본서버 런처 설정. 서버가 바뀌면 이 파일만 고친다.
module.exports = {
    serverName: '근본서버',
    // TODO: 근본서버용 GitHub 저장소를 만들면 이름 수정 (manifest.json, patch.txt, mods 해시를 여기서 받음)
    githubRepo: 'mygus3377/GeunbonServer',
    // TODO: 모드팩 zip 구글 드라이브 ID (manifest.json 의 gdrive_file_id 가 우선)
    gdriveFallbackId: '',
    dataFolder: '.geunbon_launcher',      // %APPDATA% 아래 설치 폴더
    mcVersion: '1.21.1',
    neoforgeVersion: '21.1.265',
    javaMajor: 21,
    protocol: 767,                         // 1.21.1 서버 핑 프로토콜
    mainModPrefix: 'geunbon',              // 우리 모드 jar 이름 앞부분 (구버전 정리용)
    userAgent: 'mygus3377/GeunbonLauncher',
    // 리소스팩: 아래 순서대로 위에 덮임. modrinth 는 원본에서 직접 받음(재배포 금지 팩 대응)
    // 추가 모드·셰이더팩: Modrinth 원본에서 받음. 테스트 후 문제 없으면 version 으로 고정할 것
    extras: [
        { modrinth: 'the-lost-cities', dir: 'mods', loader: 'neoforge', prefix: 'lostcities' },
        { modrinth: 'tacz-1.21.1', dir: 'mods', loader: 'neoforge', prefix: 'tacz', deps: true },          // 총기 (비공식 1.21.1 이식판) — docs/16_총기.md
        { modrinth: 'BCzBuhJ5', dir: 'mods', loader: 'neoforge', prefix: 'Immersive Vehicles' },   // 운전되는 차 (코어) — docs/14_차량_폐차.md
        { modrinth: 'C7TiPPJz', dir: 'mods', loader: 'neoforge', prefix: 'MTS Official Pack' },  // 공식 차량 팩 (ARR → 원본에서 직접 받음)
        { modrinth: 'iris', dir: 'mods', loader: 'neoforge', prefix: 'iris-neoforge', deps: true },          // Sodium 자동 동반
        // (11-20) complementary-reimagined 셰이더팩 뺌 — 자체 셰이더(GeunbonShaders)로 결정
        { modrinth: 'brewin-and-chewin', dir: 'mods', loader: 'neoforge', prefix: 'BrewinAndChewin', deps: true },        // 술·치즈 (FD 애드온)
        { modrinth: 'rustic-delight', dir: 'mods', loader: 'neoforge', prefix: 'rusticdelight', deps: true },            // 커피·면·피망 (FD 애드온) — 설정 configs/rusticdelight-common.toml
        { modrinth: 'modernfix', dir: 'mods', loader: 'neoforge', prefix: 'modernfix', deps: true },                     // 성능 (서버·클라)
        { modrinth: 'ferrite-core', dir: 'mods', loader: 'neoforge', prefix: 'ferritecore', deps: true },                // 메모리 (서버·클라)
        { modrinth: 'lithium', dir: 'mods', loader: 'neoforge', prefix: 'lithium', deps: true },                         // 서버 틱 (서버·클라)
        { modrinth: 'spark', dir: 'mods', loader: 'neoforge', prefix: 'spark', deps: true },                             // 렉 측정
        { modrinth: 'sound-physics-remastered', dir: 'mods', loader: 'neoforge', prefix: 'sound-physics-remastered', deps: true },   // 클라 전용 (메아리·막힘) — 1.21.1은 beta 판
        { modrinth: 'entityculling', dir: 'mods', loader: 'neoforge', prefix: 'entityculling', deps: true },             // 클라 전용
        { modrinth: 'immediatelyfast', dir: 'mods', loader: 'neoforge', prefix: 'ImmediatelyFast', deps: true }          // 클라 전용
    ],
    // 저장소 configs/ 아래에서 받아 게임 config/ 에 덮어쓸 파일
    configFiles: ['lostcities/profiles/geunbon.json', 'rusticdelight-common.toml'],
    resourcePacks: [
        { modrinth: 'patrix-32x', prefix: 'Patrix' },
        { modrinth: 'patrix-ctm-compatibility-override', prefix: 'Patrix_32x_CTMOverride' }   // CTM 없는 NeoForge에서 "ENABLE CONNECT TEXTURE" 자리 텍스처를 진짜 텍스처로 (Patrix 위에 깔림)
        // TODO: 근본서버 블록 덧씌우기 팩 { url, sha1, filename, prefix: 'geunbon_' }
    ]
};
