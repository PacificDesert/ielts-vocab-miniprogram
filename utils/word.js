const words = require('../data/words');

const byWord = {};
words.list.forEach((it, i) => {
  it.i = i;
  byWord[it.w.toLowerCase()] = it;
});

const chapters = words.chapters.map((name, idx) => ({
  name,
  idx,
  words: words.list.filter(it => it.ch === name)
}));

function all() {
  return words.list;
}

function get(word) {
  return byWord[String(word).toLowerCase()] || null;
}

function chapterList() {
  return chapters;
}

function chapterWords(name) {
  const c = chapters.find(it => it.name === name);
  return c ? c.words : [];
}

/** 按关键字搜索（英文前缀优先，其次中文释义） */
function search(keyword, limit) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return [];
  const out = [];
  for (const it of words.list) {
    if (it.w.toLowerCase().indexOf(kw) === 0) out.push(it);
    if (out.length >= limit) return out;
  }
  for (const it of words.list) {
    if (it.w.toLowerCase().indexOf(kw) > 0 || it.cn.indexOf(kw) >= 0) out.push(it);
    if (out.length >= limit) return out;
  }
  return out;
}

/** 取一段连续单词，用于学习 / 拼写任务 */
function slice(start, count) {
  return words.list.slice(start, start + count);
}

/** 章节主题配图 */
function themeImage(ch) {
  const i = words.chapters.indexOf(ch);
  if (i < 0) return '';
  const n = i + 1;
  return '/images/theme/' + (n < 10 ? '0' + n : '' + n) + '.jpg';
}

/** 章节配色：ink 用于文字，tint 是卡片底色（rgb 分量） */
const CHAPTER_STYLE = {
  '自然地理': { ink: '#2F5D45', tint: '231,240,234' },
  '植物研究': { ink: '#3B6234', tint: '234,243,231' },
  '动物保护': { ink: '#7A5620', tint: '247,241,229' },
  '太空探索': { ink: '#333F6B', tint: '234,237,246' },
  '学校教育': { ink: '#28527F', tint: '233,240,248' },
  '科技发明': { ink: '#33606F', tint: '233,242,245' },
  '文化历史': { ink: '#6B4E2E', tint: '246,241,233' },
  '语言演化': { ink: '#57407A', tint: '240,235,246' },
  '娱乐运动': { ink: '#8F4526', tint: '249,237,231' },
  '物品材料': { ink: '#4A4A4F', tint: '240,240,243' },
  '时尚潮流': { ink: '#833D5D', tint: '248,235,241' },
  '饮食健康': { ink: '#8A6220', tint: '249,243,230' },
  '建筑场所': { ink: '#3E4F60', tint: '236,241,245' },
  '交通旅行': { ink: '#245E82', tint: '232,242,248' },
  '国家政府': { ink: '#7E3D2C', tint: '248,236,232' },
  '社会经济': { ink: '#2F6B4E', tint: '233,244,238' },
  '法律法规': { ink: '#454565', tint: '238,238,245' },
  '沙场争锋': { ink: '#6B3229', tint: '247,234,231' },
  '社会角色': { ink: '#6B5A20', tint: '246,243,229' },
  '行为动作': { ink: '#246B5C', tint: '231,244,241' },
  '身心健康': { ink: '#8A3636', tint: '248,235,235' },
  '时间日期': { ink: '#414F60', tint: '238,242,245' }
};

function hexRgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mixTo(rgb, target, amt) {
  return rgb.map(c => Math.round(c + (target - c) * amt));
}

function rgbaStr(rgb, a) {
  return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
}

function rgbStr(rgb) {
  return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
}

/**
 * 词卡样式：每个单词都会拿到一张带章节底色与首字母水印的卡片。
 * dark=true 时把章节色调暗做底、把标签文字提亮，适配深色主题。
 */
function card(ch, w, dark) {
  const st = CHAPTER_STYLE[ch] || { ink: '#3E4F60', tint: '238,242,245' };
  const accent = hexRgb(st.ink);
  let tint, ink, veil;
  if (dark) {
    tint = mixTo(accent, 20, 0.86);
    // 深色下把章节色大幅提亮（接近白），保证标签文字和背景拉得开
    ink = mixTo(accent, 255, 0.68);
    veil = 'linear-gradient(180deg, ' + rgbaStr(tint, 0.34) + ' 0%, '
      + rgbaStr(tint, 0.72) + ' 46%, ' + rgbaStr(tint, 0.97) + ' 100%)';
  } else {
    tint = hexRgb(st.tint);
    ink = accent;
    veil = 'linear-gradient(180deg, ' + rgbaStr(tint, 0.12) + ' 0%, '
      + rgbaStr(tint, 0.62) + ' 46%, ' + rgbaStr(tint, 0.96) + ' 100%)';
  }
  return {
    img: themeImage(ch),
    ink: rgbStr(ink),
    tint: rgbStr(tint),
    veil,
    mono: String(w || ' ').charAt(0).toUpperCase(),
    /**
     * 卡片正文色：卡面按章节色调（深色下偏暗），直接用主题的 --text
     * 在深色卡面上会发灰、看不清，所以这里按主题给一套高对比的正文与次级色。
     * 浅色卡面偏白 → 正文用近黑、次级用 45% 灰；
     * 深色卡面接近纯黑 → 正文用纯白、次级用 78% 白（比 --text2 更亮，压在插图上也清楚）。
     */
    fg: dark ? '#FFFFFF' : '#1C1C1E',
    fg2: dark ? 'rgba(255, 255, 255, 0.80)' : 'rgba(60, 60, 67, 0.62)',
    // 音标：直接用章节强调色，深浅两套都够亮、也不依赖主题变量
    ph: rgbStr(ink),
    // 选项卡描边：卡面同色系的浅描边，深浅两套都看得见
    line: dark ? rgbaStr(ink.map(c => Math.round(c * 0.5)), 0.45) : rgbaStr(tint, 0.9)
  };
}

/** 相近 / 同源词 */
function similar(it) {
  if (!it || !it.sim) return [];
  return it.sim.map(i => words.list[i]).filter(Boolean);
}

/**
 * 词形拓展：把 dr 的 [词, 释义] 合并成一行展示文本，如 "shallow-hearted 薄情的"。
 * 没有词形拓展（或释义为空）时返回 ''。
 */
function forms(it, sep) {
  if (!it || !it.dr || !it.dr.length) return '';
  const s = sep === undefined ? ' ' : sep;
  return it.dr.map(p => {
    const w = String(p[0] || '').trim();
    const cn = String(p[1] || '').trim();
    if (w && cn) return w + s + cn;
    return w || cn;
  }).filter(Boolean).join(' / ');
}

/**
 * 上一张卡片左上角的标记，如 "thermal /ˈθɜːməl/ adj. 热量的"。
 * 只传下标（不传单词），越界或无效一律返回 '' —— 第一个单词天然是空的。
 * opts.forms = true 时额外拼上词形拓展（拼写页用）。
 */
function prevTag(list, prevIdx, opts) {
  const it = (list || [])[prevIdx];
  if (!it || !it.w) return '';
  const sep = ' ';
  let out = it.w;
  if (it.ph) out += sep + it.ph;
  if (it.cn) out += sep + it.cn;
  if (opts && opts.forms) {
    const f = forms(it, sep);
    if (f) out += sep + f;
  }
  return out;
}

/** 词性标注：词库里 2120 条释义自带 "n. / adj. / v." 这类前缀 */
const POS_LEAD = /^(n|adj|adv|v|vt|vi|prep|conj|pron|num|int|art|aux|abbr|ord)\.\s*/;

/**
 * 常见词 → 词性。词库释义本身没写词性的 1210 个词全在这里，
 * 由释义语义逐条人工标注（见 2026-09-22 的记忆）。
 * 匹配页与记忆卡的选项都要靠它把词性补齐 —— 不补的话
 * 只有一部分选项带词性，用户一眼就能挑出答案。
 */
const POS_MAP = {
  "Stuff": "n.",  "abandon": "v.",  "aboard": "adv./prep.",  "abortion": "n.",  "absorb": "v.",
  "academy": "n.",  "accommodation": "n.",  "accompany": "v.",  "accord": "v./n.",  "account": "n.",
  "accurate": "adj.",  "accuse": "v.",  "accustom": "v.",  "act": "n./v.",  "adequate": "adj.",
  "admire": "v.",  "admission": "n.",  "admit": "v.",  "adopt": "v.",  "adventure": "n./v.",
  "advertise": "v.",  "advise": "v.",  "aesthetic": "adj./n.",  "affluent": "adj.",
  "aggressive": "adj.",  "agreeable": "adj.",  "agreement": "n.",  "agriculture": "n.",
  "aisle": "n.",  "alga": "n.",  "allure": "v.",  "altitude": "n.",  "ambassador": "n.",
  "amphibian": "n./adj.",  "analogy": "n.",  "analyse": "v.",  "anatomy": "n.",  "anger": "n./v.",
  "announcer": "n.",  "anxiety": "n.",  "apartment": "n.",  "apologise": "v.",  "apology": "n.",
  "appearance": "n.",  "appliance": "n.",  "appointment": "n.",  "appreciate": "v.",
  "approach": "n./v.",  "arable": "adj.",  "archaeology": "n.",  "architecture": "n.",
  "argument": "n.",  "arid": "adj.",  "arrest": "v./n.",  "artery": "n.",  "article": "n.",
  "ash": "n.",  "ashamed": "adj.",  "asleep": "adj.",  "aspire": "v.",  "assert": "v.",
  "assignment": "n.",  "astound": "v.",  "astrology": "n.",  "astronaut": "n.",  "asylum": "n.",
  "atmosphere": "n.",  "attack": "v./n.",  "attend": "v.",  "attraction": "n.",  "auction": "n./v.",
  "aural": "adj.",  "authority": "n.",  "avalanche": "n.",  "avenue": "n.",  "awake": "adj.",
  "award": "n.",  "awesome": "adj.",  "bachelor": "n.",  "bacteria": "n.",  "bake": "v.",
  "balcony": "n.",  "banner": "n.",  "bar": "n.",  "bare": "adj.",  "barrier": "n.",  "basin": "n.",
  "battle": "n./v.",  "beard": "n.",  "beat": "v./n.",  "behave": "v.",  "belief": "n.",
  "bell": "n.",  "belt": "n.",  "bench": "n.",  "benchmark": "n.",  "betray": "v.",
  "bewilder": "v.",  "billion": "num.",  "bind": "v.",  "biologist": "n.",  "biology": "n.",
  "biscuit": "n.",  "bitter": "adj.",  "blade": "n.",  "blame": "v./n.",  "blanket": "n.",
  "blast": "n./v.",  "bleed": "v.",  "blot": "n.",  "blueprint": "n.",  "boil": "v./n.",
  "bomb": "n./v.",  "bombard": "v.",  "booth": "n.",  "border": "n./v.",  "boss": "n./v.",
  "bounce": "v.",  "bowl": "n.",  "boycott": "v.",  "brake": "n./v.",  "branch": "n.",
  "breed": "v./n.",  "breeze": "n.",  "brochure": "n.",  "broom": "n./v.",  "browser": "n.",
  "bruise": "n./v.",  "brute": "n.",  "bud": "n.",  "build": "v.",  "bulb": "n.",  "bull": "n.",
  "bunch": "n.",  "bundle": "n.",  "burden": "v./n.",  "bureaucracy": "n.",  "burst": "v./n.",
  "butcher": "n.",  "cabinet": "n.",  "cage": "n.",  "calendar": "n.",  "calf": "n.",
  "camel": "n.",  "camp": "n.",  "campaign": "n./v.",  "canteen": "n.",  "canvas": "n.",
  "carbon dioxide": "n.",  "career": "n.",  "cargo": "n.",  "carnivore": "n.",  "carrier": "n.",
  "cash": "n./v.",  "category": "n.",  "cattle": "n.",  "cause": "n./v.",  "century": "n.",
  "ceremony": "n.",  "certify": "v.",  "challenge": "n./v.",  "chamber": "n.",  "chapter": "n.",
  "character": "n.",  "charcoal": "n.",  "charter": "n./v.",  "chase": "v./n.",  "cheap": "adj.",
  "cheat": "v./n.",  "cheer": "v.",  "chemistry": "n.",  "cheque": "n.",  "chin": "n.",
  "chronology": "n.",  "circle": "n.",  "circuit": "n.",  "circulation": "n.",
  "circumstance": "n.",  "citizen": "n.",  "claim": "v./n.",  "clan": "n.",  "clause": "n.",
  "client": "n.",  "cliff": "n.",  "clinic": "n.",  "cloak": "n.",  "cock": "n.",  "coin": "n./v.",
  "college": "n.",  "collision": "n.",  "colour": "n.",  "command": "v./n.",  "commentary": "n.",
  "commentator": "n.",  "commercial": "adj./n.",  "communism": "n.",  "community": "n.",
  "compare": "v.",  "competitor": "n.",  "complain": "v.",  "composition": "n.",
  "comprehend": "v.",  "conclude": "v.",  "concrete": "n./adj.",  "condemn": "v.",
  "condense": "v.",  "condition": "n.",  "cone": "n.",  "conference": "n.",  "confess": "v.",
  "conform": "v.",  "confuse": "v.",  "congratulate": "v.",  "considerable": "adj.",
  "conspiracy": "n.",  "consume": "v.",  "contain": "v.",  "contemporary": "adj.",
  "contempt": "n.",  "context": "n.",  "continent": "n.",  "contingency": "n.",
  "controversy": "n.",  "convention": "n.",  "cook": "v./n.",  "copper": "n.",  "copyright": "n.",
  "core": "n.",  "corn": "n.",  "corpus": "n.",  "correspondent": "n.",  "corridor": "n.",
  "cosmos": "n.",  "cost": "v./n.",  "cottage": "n.",  "couple": "n.",  "courtship": "n.",
  "cousin": "n.",  "cover": "n.",  "cradle": "n.",  "crew": "n.",  "cripple": "n./v.",
  "criteria": "n.",  "critic": "n.",  "crop": "n.",  "cross": "n./v.",  "crude": "adj./n.",
  "crust": "n.",  "culture": "n.",  "curative": "adj./n.",  "cure": "v./n.",  "cushion": "n.",
  "custom": "n.",  "cutlery": "n.",  "cycle": "v./n.",  "cycling": "n.",  "dam": "n./v.",
  "daring": "adj.",  "darling": "n.",  "data": "n.",  "deadline": "n.",  "death": "n.",
  "debt": "n.",  "deceive": "v.",  "decide": "v.",  "decimal": "adj./n.",  "decimation": "n.",
  "deck": "n./v.",  "decompose": "v.",  "deduce": "v.",  "deed": "n.",  "deficit": "n.",
  "deflation": "n.",  "deforest": "v.",  "degree": "n.",  "delight": "v./n.",  "delta": "n.",
  "demand": "v./n.",  "demise": "n./v.",  "democracy": "n.",  "demographic": "adj.",
  "density": "n.",  "dental": "adj.",  "dependent": "adj.",  "deploy": "v.",  "deposit": "n.",
  "depression": "n.",  "describe": "v.",  "desire": "n./v.",  "destructive": "adj.",
  "determine": "v.",  "devil": "n.",  "diagnose": "v.",  "diagonal": "adj./n.",  "dial": "v.",
  "dialect": "n.",  "diameter": "n.",  "diligent": "adj.",  "dilute": "v./adj.",  "dioxide": "n.",
  "dip": "v.",  "diploma": "n.",  "diplomat": "n.",  "direct": "adj.",  "disappoint": "v.",
  "disaster": "n.",  "discourage": "v.",  "discrimination": "n.",  "dish": "n.",  "displace": "v.",
  "dispute": "n./v.",  "dissolve": "v.",  "distant": "adj.",  "distil": "v.",  "distinguish": "v.",
  "dizzy": "adj./v.",  "doctor": "n.",  "doctrine": "n.",  "doom": "n./v.",  "dorm": "n.",
  "dormant": "adj.",  "dot": "n./v.",  "doze": "v./n.",  "dozen": "n.",  "draft": "n./v.",
  "dragon": "n.",  "drift": "v./n.",  "drill": "n./v.",  "drum": "n.",  "dumb": "adj.",
  "dusk": "n.",  "dust": "n.",  "duty": "n.",  "dwarf": "n./adj.",  "eager": "adj.",  "eagle": "n.",
  "eccentric": "adj.",  "echo": "n./v.",  "ecliptic": "n.",  "economics": "n.",  "editor": "n.",
  "education": "n.",  "effective": "adj.",  "efficient": "adj.",  "effort": "n.",
  "egalitarian": "adj./n.",  "ego": "n.",  "elbow": "n./v.",  "elective": "adj./n.",
  "element": "n.",  "elephant": "n.",  "elevator": "n.",  "embark": "v.",  "eminent": "adj.",
  "emission": "n.",  "emit": "v.",  "emperor": "n.",  "empirical": "adj.",  "enclose": "v.",
  "encounter": "v./n.",  "endow": "v.",  "enemy": "n.",  "enforce": "v.",  "engagement": "n.",
  "engrave": "v.",  "enlarge": "v.",  "enormity": "n.",  "enrich": "v.",  "enter": "v.",
  "entitle": "v.",  "entry": "n.",  "environment": "n.",  "enzyme": "n.",  "epic": "n./adj.",
  "epidemic": "n./adj.",  "equation": "n.",  "equip": "v.",  "equity": "n.",  "erection": "n.",
  "error": "n.",  "erupt": "v.",  "escalate": "v.",  "establish": "v.",  "ethic": "n.",
  "ethnic": "adj.",  "etiquette": "n.",  "evacuate": "v.",  "evidence": "n.",  "examination": "n.",
  "excavate": "v.",  "exceed": "v.",  "excessive": "adj.",  "execute": "v.",  "exercise": "n./v.",
  "exhale": "v.",  "exit": "n./v.",  "expand": "v.",  "expense": "n.",  "experiment": "n.",
  "experimental": "adj.",  "explain": "v.",  "explosion": "n.",  "exponent": "n.",  "extent": "n.",
  "exterior": "n./adj.",  "extinction": "n.",  "extravagant": "adj.",  "fabric": "n.",
  "facility": "n.",  "fade": "v.",  "failure": "n.",  "fair": "adj.",  "fan": "n./v.",
  "fare": "n.",  "farewell": "int./n.",  "fashion": "n./v.",  "fatal": "adj.",  "fault": "n./v.",
  "federal": "adj.",  "fee": "n.",  "fellowship": "n.",  "female": "n./adj.",  "fence": "n.",
  "ferry": "n./v.",  "fertile": "adj.",  "festival": "n.",  "feudalism": "n.",  "fibre": "n.",
  "field": "n.",  "fierce": "adj.",  "figure": "n./v.",  "filter": "v./n.",  "fire": "v./n.",
  "first": "num./adv.",  "fisherman": "n.",  "flame": "n.",  "flashlight": "n.",  "flatter": "v.",
  "flavour": "n.",  "flaw": "n.",  "flesh": "n.",  "float": "v.",  "flour": "n.",  "flourish": "v.",
  "flute": "n.",  "fold": "v.",  "folk": "n.",  "fool": "n./v.",  "foreign": "adj.",
  "forestry": "n.",  "forgive": "v.",  "forgo": "v.",  "fork": "n.",  "fossil": "n.",
  "foul": "adj./v.",  "found": "v.",  "fox": "n.",  "frame": "n.",  "franchise": "v./n.",
  "frank": "adj.",  "fraud": "n.",  "freight": "n./v.",  "friction": "n.",  "friendship": "n.",
  "frost": "n.",  "frown": "v./n.",  "fulfil": "v.",  "fun": "n./adj.",  "fund": "v./n.",
  "furnish": "v.",  "galaxy": "n.",  "gallery": "n.",  "garage": "n.",  "garbage": "n.",
  "gauge": "n./v.",  "gender": "n.",  "gene": "n.",  "general": "n./adj.",  "generation": "n.",
  "geography": "n.",  "germ": "n.",  "gesture": "n.",  "gist": "n.",  "gizmo": "n.",
  "glacier": "n.",  "glass": "n.",  "glide": "v./n.",  "global": "adj.",  "gloomy": "adj.",
  "glue": "n.",  "goods": "n.",  "goose": "n.",  "gorge": "n./v.",  "government": "n.",
  "grab": "v.",  "grain": "n.",  "grammar": "n.",  "granite": "n.",  "grateful": "adj.",
  "gratitude": "n.",  "gravity": "n.",  "greenhouse": "n.",  "grid": "n.",  "gross": "adj.",
  "growth": "n.",  "guarantee": "v./n.",  "guardian": "n./adj.",  "guideline": "n.",
  "guilty": "adj.",  "gulf": "n.",  "gust": "n.",  "hamburger": "n.",  "handout": "n.",
  "handwriting": "n.",  "happen": "v.",  "harmony": "n.",  "hate": "v.",  "haunt": "v./n.",
  "headquarters": "n.",  "heal": "v.",  "heap": "n.",  "heaven": "n.",  "hedge": "n.",
  "heir": "n.",  "helmet": "n.",  "herald": "n./v.",  "herbivore": "n.",  "hesitate": "v.",
  "hierarchy": "n.",  "history": "n.",  "hollow": "adj.",  "honk": "n./v.",  "horizon": "n.",
  "horn": "n.",  "hospital": "n.",  "humid": "adj.",  "hurricane": "n.",  "hurry": "v./n.",
  "husband": "n.",  "hygiene": "n.",  "hypertension": "n.",  "icon": "n.",  "ideology": "n.",
  "idol": "n.",  "ignorance": "n.",  "illustrate": "v.",  "immense": "adj.",  "impede": "v.",
  "impetus": "n.",  "impulse": "n.",  "incidentally": "adv.",  "index": "n./v.",  "indignity": "n.",
  "inductive": "adj.",  "indulge": "v.",  "industry": "n.",  "inert": "adj.",  "infer": "v.",
  "inflation": "n.",  "inflection": "n.",  "influx": "n.",  "ingredient": "n.",  "ink": "n.",
  "innovate": "v.",  "inquire": "v.",  "insist": "v.",  "insomnia": "n.",  "instalment": "n.",
  "institute": "n.",  "institution": "n.",  "instruct": "v.",  "instrument": "n.",  "insure": "v.",
  "intake": "n.",  "integrate": "v.",  "intelligent": "adj.",  "intensity": "n.",
  "interbreed": "v.",  "intersection": "n.",  "intervene": "v.",  "intestine": "n.",
  "intonation": "n.",  "intrude": "v.",  "invade": "v.",  "invoice": "n./v.",  "invoke": "v.",
  "irritate": "v.",  "itch": "v./n.",  "item": "n.",  "itinerary": "n.",  "jail": "n./v.",
  "jaw": "n.",  "jewel": "n.",  "joke": "n./v.",  "judge": "n.",  "jump": "v./n.",  "jungle": "n.",
  "jury": "n.",  "just": "adj./adv.",  "justify": "v.",  "kangaroo": "n.",  "ketchup": "n.",
  "kettle": "n.",  "kin": "n./adj.",  "king": "n.",  "kit": "n.",  "kitchen": "n.",  "kiwi": "n.",
  "knee": "n.",  "knight": "n./v.",  "knit": "v.",  "knot": "n.",  "laboratory": "n.",
  "lag": "v./n.",  "landmark": "n.",  "landscape": "n./v.",  "lane": "n.",  "language": "n.",
  "lantern": "n.",  "lap": "n.",  "laptop": "n.",  "latitude": "n.",  "lavatory": "n.",
  "law": "n.",  "lay": "v.",  "layout": "n.",  "league": "n.",  "leap": "v./n.",  "lease": "n./v.",
  "leather": "n.",  "legislate": "v.",  "lesson": "n.",  "lethal": "adj.",  "levy": "n./v.",
  "liar": "n.",  "library": "n.",  "license": "n.",  "light": "n./v.",  "limb": "n.",
  "liner": "n.",  "linguistics": "n.",  "list": "n./v.",  "literature": "n.",  "livestock": "n.",
  "load": "v./n.",  "loaf": "n./v.",  "lobby": "n./v.",  "log": "n.",  "logic": "n.",
  "logistics": "n.",  "logo": "n.",  "longitude": "n.",  "lord": "n.",  "loss": "n.",
  "loudspeaker": "n.",  "lover": "n.",  "luggage": "n.",  "lump": "n./v.",  "lunar": "adj.",
  "luxury": "n.",  "magnet": "n.",  "maid": "n.",  "maiden": "n.",  "mail": "n./v.",
  "majesty": "n.",  "mammal": "n.",  "manifest": "v.",  "manly": "adj.",  "manoeuvre": "n.",
  "mansion": "n.",  "mantle": "n.",  "manual": "n./adj.",  "marathon": "n.",  "marble": "n.",
  "marine": "adj./n.",  "mason": "n.",  "massacre": "n.",  "massive": "adj.",  "master": "n./v.",
  "mat": "n.",  "material": "n./adj.",  "materialism": "n.",  "maximal": "adj.",  "mean": "n./adj.",
  "meanwhile": "adv.",  "mechanic": "n.",  "medical": "adj.",  "medieval": "adj.",
  "medium": "n./adj.",  "melon": "n.",  "melt": "v.",  "merchandise": "n.",  "mercy": "n.",
  "merry": "adj.",  "mess": "v./n.",  "messenger": "n.",  "metabolism": "n.",  "microbe": "n.",
  "microcomputer": "n.",  "midst": "n.",  "mild": "adj.",  "military": "adj.",  "milkshake": "n.",
  "million": "num.",  "mineral": "n.",  "minimal": "adj.",  "minister": "n.",  "mint": "n./v.",
  "minus": "adj./prep.",  "mishap": "n.",  "miss": "v.",  "missile": "n.",  "mistake": "n./v.",
  "model": "n./v.",  "moist": "adj.",  "monsoon": "n.",  "monthly": "adj./adv./n.",  "mood": "n.",
  "mortal": "adj./n.",  "mortgage": "v./n.",  "mosquito": "n.",  "motive": "n.",  "mountain": "n.",
  "mourn": "v.",  "multiple": "n./adj.",  "museum": "n.",  "mutual": "adj.",  "mysterious": "adj.",
  "nap": "n.",  "nasty": "adj.",  "nation": "n.",  "necessity": "n.",  "neck": "n.",
  "needle": "n.",  "neglect": "v.",  "negotiation": "n.",  "nerve": "n.",  "network": "n.",
  "nobility": "n.",  "norm": "n.",  "notify": "v.",  "nourish": "v.",  "nursery": "n./adj.",
  "oar": "n./v.",  "oasis": "n.",  "obey": "v.",  "objective": "n./adj.",  "observatory": "n.",
  "observe": "v.",  "occupation": "n.",  "ocean": "n.",  "offend": "v.",  "offer": "v./n.",
  "offspring": "n.",  "operation": "n.",  "opinion": "n.",  "optimal": "adj.",  "orbit": "n.",
  "organism": "n.",  "outcome": "n.",  "outfit": "n./v.",  "outlook": "n.",  "outward": "adj./adv.",
  "oversee": "v.",  "overtake": "v.",  "owl": "n.",  "oxygen": "n.",  "ozone": "n.",
  "pacific": "adj.",  "package": "n./v.",  "packet": "n.",  "pail": "n.",  "pain": "n./v.",
  "painstaking": "adj.",  "painting": "n.",  "panda": "n.",  "parade": "n./v.",  "paradise": "n.",
  "parameter": "n.",  "parcel": "v./n.",  "parliament": "n.",  "parlour": "n.",  "partner": "n.",
  "passage": "n.",  "paste": "n.",  "patriot": "n.",  "pattern": "n.",  "pave": "v.",
  "pebble": "n.",  "penalty": "n.",  "per cent": "n.",  "peripheral": "adj./n.",  "persist": "v.",
  "personality": "n.",  "perspective": "n.",  "pest": "n.",  "petition": "n./v.",  "petrol": "n.",
  "phenomenon": "n.",  "philosophy": "n.",  "phone": "n.",  "phonetics": "n.",  "photograph": "n.",
  "photosynthesis": "n.",  "physician": "n.",  "physics": "n.",  "pierce": "v.",  "pill": "n.",
  "pillow": "n.",  "pin": "n./v.",  "pinpoint": "v./n.",  "pipe": "n.",  "pitch": "n.",
  "placement": "n.",  "plain": "n./adj.",  "plantation": "n.",  "plough": "n./v.",  "plume": "n.",
  "point": "n.",  "poison": "n./v.",  "police": "n.",  "political": "adj.",  "pollution": "n.",
  "popularity": "n.",  "population": "n.",  "porcelain": "n.",  "porch": "n.",  "pore": "n./v.",
  "porridge": "n.",  "portfolio": "n.",  "portrait": "n.",  "postage": "n.",  "precise": "adj.",
  "predator": "n.",  "preference": "n.",  "prejudice": "n.",  "premier": "n./adj.",
  "prepare": "v.",  "prerequisite": "n./adj.",  "presentation": "n.",  "president": "n.",
  "press": "n.",  "prestige": "n.",  "presume": "v.",  "pretend": "v.",  "prevail": "v.",
  "prevent": "v.",  "prey": "n./v.",  "primary": "adj.",  "primate": "n.",  "prince": "n.",
  "prison": "n.",  "private": "adj.",  "privilege": "n.",  "prize": "n./v.",  "productive": "adj.",
  "profession": "n.",  "prominent": "adj.",  "promising": "adj.",  "pronounce": "v.",
  "proof": "n.",  "propeller": "n.",  "prophet": "n.",  "proposal": "n.",  "propose": "v.",
  "prosecute": "v.",  "protein": "n.",  "protocol": "n.",  "proud": "adj.",  "prove": "v.",
  "provide": "v.",  "psychology": "n.",  "pudding": "n.",  "punishment": "n.",  "pupil": "n.",
  "purple": "adj./n.",  "purse": "n.",  "pursue": "v.",  "puzzle": "n./v.",  "quality": "n.",
  "quantity": "n.",  "quarrel": "v./n.",  "quartz": "n.",  "queen": "n.",  "query": "n./v.",
  "questionnaire": "n.",  "quilt": "n.",  "quote": "v.",  "race": "n.",  "racial": "adj.",
  "radiate": "v.",  "radiator": "n.",  "radius": "n.",  "raft": "n.",  "rage": "n.",  "raid": "n.",
  "rainforest": "n.",  "rake": "n./v.",  "rat": "n.",  "rational": "adj.",  "razor": "n./v.",
  "react": "v.",  "reap": "v.",  "reasonable": "adj.",  "receipt": "n.",  "recession": "n.",
  "recite": "v.",  "reckless": "adj.",  "rectify": "v.",  "reduce": "v.",  "reef": "n.",
  "reference": "n.",  "refrigerator": "n.",  "refuge": "n.",  "regard": "n./v.",  "regime": "n.",
  "regulation": "n.",  "relative": "n./adj.",  "reliable": "adj.",  "relieve": "v.",
  "religion": "n.",  "reluctant": "adj.",  "remainder": "n.",  "remarkable": "adj.",
  "renaissance": "n.",  "reproach": "v./n.",  "reptile": "n.",  "republic": "n.",
  "resident": "n./adj.",  "respond": "v.",  "result": "n./v.",  "retire": "v.",  "revenue": "n.",
  "revise": "v.",  "revolt": "n./v.",  "reward": "n./v.",  "rid": "v.",  "rigid": "adj.",
  "rigorous": "adj.",  "rim": "n.",  "risk": "n./v.",  "ritual": "n.",  "round": "adj./v.",
  "route": "n.",  "rug": "n.",  "rule": "n./v.",  "rust": "v./n.",  "sacrifice": "n./v.",
  "saddle": "n.",  "safari": "n.",  "safeguard": "v./n.",  "sail": "v.",  "sale": "n.",
  "sample": "n.",  "sanitary": "adj.",  "satisfactory": "adj.",  "saturate": "v.",  "sauce": "n.",
  "saucer": "n.",  "savage": "adj./n.",  "scan": "v./n.",  "scar": "n.",  "schedule": "n.",
  "scholarship": "n.",  "screw": "n.",  "seal": "n./v.",  "seaman": "n.",  "seasonal": "adj.",
  "secretary": "n.",  "seismic": "adj.",  "seize": "v.",  "selective": "adj.",  "selfish": "adj.",
  "semantic": "adj.",  "senate": "n.",  "sensor": "n.",  "sentence": "n./v.",  "series": "n.",
  "service": "n.",  "session": "n.",  "setback": "n.",  "severe": "adj.",  "sex": "n.",
  "shabby": "adj.",  "sheet": "n.",  "shelter": "n./v.",  "shield": "n./v.",  "shilling": "n.",
  "shore": "n.",  "shoulder": "n.",  "siege": "n.",  "sign": "n./v.",  "simplify": "v.",
  "site": "n.",  "situated": "adj.",  "ski": "n./v.",  "skill": "n.",  "skim": "v.",
  "slice": "v./n.",  "slogan": "n.",  "smash": "v.",  "smog": "n.",  "snatch": "v.",
  "socialism": "n.",  "sock": "n.",  "software": "n.",  "solar": "adj.",  "soldier": "n.",
  "sort": "n./v.",  "soul": "n.",  "sound": "adj./n./v.",  "soup": "n.",  "sour": "adj.",
  "source": "n.",  "souvenir": "n.",  "soviet": "adj./n.",  "spade": "n.",  "spark": "n.",
  "sparrow": "n.",  "specimen": "n.",  "spectacle": "n.",  "spend": "v.",  "spend time": "v.",
  "sphere": "n.",  "spice": "n.",  "spin": "v./n.",  "spirit": "n.",  "sponsor": "n./v.",
  "spotlight": "n.",  "spouse": "n.",  "spur": "v./n.",  "squirrel": "n.",  "stability": "n.",
  "stage": "n.",  "stain": "v./n.",  "stair": "n.",  "staircase": "n.",  "stale": "adj.",
  "standard": "n.",  "standpoint": "n.",  "statesman": "n.",  "stature": "n.",  "steady": "adj.",
  "steel": "n.",  "stereotype": "n.",  "stigma": "n.",  "stitch": "n./v.",  "stock": "n.",
  "stocking": "n.",  "storey": "n.",  "straight": "adj./adv.",  "stranger": "n.",
  "stream": "n./v.",  "strenuous": "adj.",  "structure": "n.",  "stubborn": "adj.",  "stuff": "n.",
  "style": "n.",  "submerge": "v.",  "submit": "v.",  "substance": "n.",  "substitute": "v./n.",
  "subtract": "v.",  "succeed": "v.",  "successor": "n.",  "sufficient": "adj.",  "suffix": "n.",
  "suggest": "v.",  "suicide": "n.",  "suitable": "adj.",  "sunlight": "n.",  "sunset": "n.",
  "supervise": "v.",  "supervisor": "n.",  "support": "v./n.",  "suppose": "v.",  "surgeon": "n.",
  "surname": "n./v.",  "surrounding": "adj.",  "swallow": "n./v.",  "swamp": "n.",  "sweet": "adj.",
  "switch": "n./v.",  "sword": "n.",  "syllable": "n.",  "symbol": "n.",  "syntax": "n.",
  "take up": "v.",  "tariff": "n.",  "tasty": "adj.",  "tax": "n./v.",  "technique": "n.",
  "technology": "n.",  "teenager": "n.",  "telescope": "n.",  "temper": "n./v.",
  "temperature": "n.",  "temple": "n.",  "tempt": "v.",  "tender": "adj./v.",  "tense": "n./adj.",
  "term": "n.",  "terrace": "n.",  "terrain": "n.",  "terror": "n.",  "therapy": "n.",
  "thief": "n.",  "thigh": "n.",  "thirsty": "adj.",  "thoughtful": "adj.",  "thrill": "n./v.",
  "throat": "n.",  "tide": "n.",  "tile": "n.",  "tilt": "v.",  "timber": "n.",  "timetable": "n.",
  "tin": "n.",  "toe": "n.",  "toilet": "n.",  "tongue": "n.",  "tornado": "n.",  "tortoise": "n.",
  "torture": "n./v.",  "trace": "v./n.",  "track": "v./n.",  "tractor": "n.",  "trade": "n./v.",
  "tradition": "n.",  "training": "n.",  "traitor": "n.",  "transmit": "v.",  "trap": "n./v.",
  "tray": "n.",  "treason": "n.",  "treasure": "n.",  "treatment": "n.",  "trench": "v./n.",
  "trend": "n.",  "trespass": "v./n.",  "trial": "n.",  "triangle": "n.",  "trick": "n./v.",
  "triumph": "n./v.",  "tropics": "n.",  "tube": "n.",  "tulip": "n.",  "tumble": "v.",
  "turkey": "n.",  "turtle": "n.",  "typhoon": "n.",  "typist": "n.",  "undergo": "v.",
  "undermine": "v.",  "understand": "v.",  "union": "n.",  "unique": "adj.",  "unite": "v.",
  "university": "n.",  "unstable": "adj.",  "uptake": "n.",  "utensil": "n.",  "vacuum": "n./adj.",
  "vague": "adj.",  "vegetable": "n.",  "vegetation": "n.",  "ventilation": "n.",  "venue": "n.",
  "vertebrate": "n.",  "vessel": "n.",  "vest": "n.",  "victim": "n.",  "viewpoint": "n.",
  "vine": "n.",  "violate": "v.",  "violence": "n.",  "violin": "n.",  "virus": "n.",
  "vogue": "n.",  "volatile": "adj.",  "volcano": "n.",  "vote": "n./v.",  "voyage": "n.",
  "vulgar": "adj.",  "wallet": "n.",  "way": "n.",  "wealth": "n.",  "wedding": "n.",
  "wedge": "n.",  "whale": "n./v.",  "wheat": "n.",  "whistle": "n./v.",  "white": "adj./n.",
  "wholesale": "n./adj.",  "wireless": "adj.",  "wish": "v./n.",  "wither": "v.",
  "witness": "n./v.",  "worm": "n.",  "worship": "n./v.",  "wrap": "n./v.",  "wretched": "adj.",
  "wrist": "n.",  "yawn": "v./n.",  "yearn": "v.",  "yellow": "adj./n.",  "youngster": "n.",
  "youth": "n.",  "yummy": "adj.",  "zebra": "n.",  "zoologist": "n.",
};

/**
 * 释义正文：带上词性标注。
 * 词库里有 2120 条释义自带 "n. / adj. / v." 前缀，其余 1208 条没有 ——
 * 不补齐的话，测验里会出现「只有正确项没写词性」的反常现象，一眼就能猜出答案。
 * 取词顺序：① 词库释义自带 → ② 手工表 POS_MAP；两处都没有就退回原释义，**绝不硬编**。
 * @param {string} cn 释义
 * @param {string} [word] 对应的单词（大小写不敏感；不传则只走第 ① 级）
 */
function cnText(cn, word) {
  const s = tidyCn(cn);
  if (!s) return '';
  if (POS_LEAD.test(s)) return s;
  const key = String(word || '').trim();
  const pos = POS_MAP[key] || POS_MAP[key.toLowerCase()];
  return pos ? pos + ' ' + s : s;
}

/** 编辑距离，超过 max 就提前收手（用于找拼写相近的词） */
function editDistance(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= n; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    const t = prev; prev = cur; cur = t;
  }
  return prev[n];
}

/** 去掉释义开头的杂标点（OCR 常把「（」吃掉，留下孤零零的「，」「、」）并压掉空白 */
function tidyCn(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/^[，,、；;：:]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 两个词是否高度重形（同前缀 / 包含关系）——这类干扰项太容易排除，不算「形近」 */
function tooClose(a, b) {
  if (a === b) return true;
  if (a.length >= 3 && b.indexOf(a) === 0) return true;
  if (b.length >= 3 && a.indexOf(b) === 0) return true;
  return false;
}

/**
 * 记忆卡的「选释义」四个选项：正确释义 + 3 个形近词的释义。
 * 干扰项优先取拼写相近的词（让选项真正难分辨），出处书的 sim 列表、
 * 编辑距离邻域、同章节顺延三级兜底；释义去重且保证凑满 count 个。
 * 返回 [{ cn, ok }]，ok 标记正确项，且数组第一项一定是正确项（由调用方打乱）。
 */
function options(it, n) {
  const count = n && n > 1 ? n : 4;
  if (!it || !it.cn) return [];
  const list = words.list;
  const target = String(it.w || '').toLowerCase();
  const answer = cnText(it.cn);
  // 正确释义先占位：像 spacecraft / spaceship 这类同义项释义完全一样，
  // 必须当成重复直接剔除，否则选项里会出现两个「n. 宇宙飞船」。
  const picked = [];
  const seen = {};
  seen[answer] = 1;
  const push = cand => {
    if (picked.length >= count) return;
    if (!cand || !cand.cn || cand === it) return;
    if (tooClose(target, String(cand.w || '').toLowerCase())) return;
    const cn = tidyCn(cand.cn);
    if (!cn || seen[cn]) return;
    seen[cn] = 1;
    picked.push(cn);
  };

  // 1) 编辑距离邻域：与目标词最像的一批（拼写 1~2 个字母之差）
  const near = [];
  for (let k = 0; k < list.length; k += 1) {
    const cand = list[k];
    if (!cand || !cand.w || cand === it) continue;
    const cw = String(cand.w).toLowerCase();
    const d = editDistance(target, cw, 3);
    if (d <= 2) near.push([d, cand]);
  }
  near.sort((a, b) => a[0] - b[0]);
  for (let k = 0; k < near.length && picked.length < count; k += 1) push(near[k][1]);

  // 2) 出处书里的相近词
  const sims = it.sim || [];
  for (let k = 0; k < sims.length && picked.length < count; k += 1) push(list[sims[k]]);

  // 3) 同章节顺延，语境相近，凑数也不突兀
  const chapter = chapterWords(it.ch);
  const at = chapter.indexOf(it);
  for (let k = 1; k <= chapter.length && picked.length < count; k += 1) {
    push(chapter[(at + k) % chapter.length]);
  }

  // 4) 全表轮转兜底：前面几级都被同义词屏蔽掉时，保证任何词都能凑满选项
  //    从目标词的位置开始绕一圈（原来这里误用了不存在的 start 变量，
  //    导致兜底完全失效 —— 那些词只能拿到不足 4 个选项，页面上就有选项点不动）
  const origin = it.i >= 0 ? it.i : 0;
  for (let pass = 0; pass < 2 && picked.length < count - 1; pass += 1) {
    for (let k = 1; k <= list.length && picked.length < count - 1; k += 1) {
      push(list[(origin + k) % list.length]);
    }
  }

  return [Object.assign({}, { cn: answer, ok: true })]
    .concat(picked.slice(0, count - 1).map(cn => ({ cn, ok: false })));
}

/** 书中例句 */
function example(it) {
  if (!it || !it.ex || !it.ex.length) return null;
  return { en: it.ex[0], zh: it.ex[1] || '' };
}

/**
 * 例句正文（可发音）：把书名号的例词标记《word》剥掉，只留纯英文句子。
 * 书中例句用《》标出该词，但 TTS / 词典接口会把书名号一起念出来，
 * 所以朗读与显示都统一走这里。
 */
function exText(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/《([^》]*)》/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 末尾辅音是否需要双写（equip → equipped、stop → stopped、rain → raining）。
 * 条件：以「元音 + 单个末尾辅音」收尾，且末尾辅音前面不是会阻止双写的元音组合。
 * 元音组合只列真正阻断双写的那些（ai/ea/ee/oa/oo/ue…）；
 * 不能笼统判「末尾两个字母都是元音」—— equip 的 stem 是 equi，
 * 结尾 ui 也算双元音，那样会把 equipped 一起挡掉，所以 ui 单独放行。
 */
const VOWEL_DIGRAPH = /(ai|ay|ea|ee|ei|ey|ie|oa|oe|oi|oo|ou|oy|ue|au|eu|ew)$/;

function isDoubling(base) {
  if (!/[aeiou][^aeiouwxy]$/.test(base)) return false;
  const stem = base.slice(0, -1);          // 去掉末尾辅音
  const tail = stem.slice(-2);
  // ui 结尾：equip → equipped 需要双写（quit / fruit 之类不在词库的例句里，
  // 且这里生成的是「候选形式」，多一个候选只会多一次尝试，不会误伤）
  if (tail === 'ui') return true;
  return !VOWEL_DIGRAPH.test(stem);
}

/**
 * 例句里目标词的屈折形式候选。
 * 例句中该词大多不是原形（circulate → Circulating、undergo → underwent），
 * 所以按词根 + 常见后缀生成候选，再配合 IRREGULAR 补不规则形式。
 */
function inflections(w) {
  const base = String(w || '').toLowerCase();
  const set = {};
  const add = s => { if (s && s.length >= 2) set[s] = 1; };
  add(base);
  add(base + 's');
  add(base + 'es');
  // y → ies / ied（carry → carries / carried）
  if (/[^aeiou]y$/.test(base)) { add(base.slice(0, -1) + 'ies'); add(base.slice(0, -1) + 'ied'); }
  if (/[^aeiou]o$/.test(base)) add(base + 'es');
  add(base + 'ed');
  add(base + 'd');
  add(base + 'ing');
  // 以 e 结尾：去 e 加 ing / ed（revise → revising）
  if (/e$/.test(base)) { add(base.slice(0, -1) + 'ing'); add(base.slice(0, -1) + 'ed'); }
  // 双写末尾辅音（equip → equipped / equipping、stop → stopped）
  // 条件：以「元音 + 单个末尾辅音」结尾，且末尾辅音前面不是两个相邻元音
  //（rain → raining，不双写 n）。
  // 别写成 [^aeiou][aeiou][^aeiouwxy]$：equip 里的 u 是元音，会被这个式子误判掉。
  if (isDoubling(base)) {
    add(base + base.slice(-1) + 'ing');
    add(base + base.slice(-1) + 'ed');
  }
  // -ic 加 k（mimic → mimicked）
  if (/ic$/.test(base)) { add(base + 'k'); add(base + 'ked'); add(base + 'king'); }
  add(base + 'ly');
  add(base + 'er');
  add(base + 'est');
  if (/e$/.test(base)) { add(base.slice(0, -1) + 'er'); add(base.slice(0, -1) + 'est'); }
  if (isDoubling(base)) {
    add(base + base.slice(-1) + 'er');
    add(base + base.slice(-1) + 'est');
  }
  // 连字符词：shade-tolerant → shade tolerant / shade- tolerant（例句常在连字符后插空格）
  if (base.indexOf('-') > 0) {
    add(base.replace(/-/g, ''));
    add(base.replace(/-/g, ' '));
    add(base.replace(/-/g, '- '));
  }
  /*
   * 短语（take up / spend time）：例句里往往只有动词在变位，后面的虚词不动，
   * 于是 "takes up" 匹配不上原形 "take up"。这里把每个词分别变位后再拼回来。
   * 只对动词那一部分（第一段）做常见变位，够覆盖 take/spend/look 这类高频动词。
   */
  if (base.indexOf(' ') > 0) {
    const segs = base.split(' ');
    const head = segs[0];
    const tail = segs.slice(1).join(' ');
    const variants = [head + 's', head + 'es', head + 'ed', head + 'd', head + 'ing'];
    if (/[^aeiou]y$/.test(head)) variants.push(head.slice(0, -1) + 'ies', head.slice(0, -1) + 'ied');
    if (/e$/.test(head)) variants.push(head.slice(0, -1) + 'ing');
    if (isDoubling(head)) variants.push(head + head.slice(-1) + 'ing', head + head.slice(-1) + 'ed');
    variants.forEach(v => add(v + ' ' + tail));
    /*
     * 短语可能被别的词打断：spend time 在例句里是 "spends a lot of time"，
     * 连写形式匹配不上。**退一步只匹配首段动词**（spend / spends），
     * 这样至少能把动词标出来，而不是整句不加粗。
     * 只加变位形式、不加原形 —— 原形太短太常见（take/look/get），会误命中别处。
     */
    variants.forEach(v => add(v));
  }
  /*
   * 派生词（southern ← south、northern ← north、easily ← easy…）：
   * 目标词往往是另一个词的派生形式，例句里用的是词根。只补最常见的几组后缀，
   * 确保「目标词不在例句里、但词根在」时也能定位到，不至于整句不加粗。
   */
  const DERIVE = [
    [/^(south|north|east|west)ern$/, m => m[1]],
    [/^(north|south|east|west)$/, m => m[1] + 'ern'],
    [/^(.+)ly$/, m => m[1]],
    [/^(.+)ness$/, m => m[1]],
    [/^un(.+)$/, m => m[1]],
    [/^(.+)ment$/, m => m[1]],
    [/^(.+)ity$/, m => m[1]]
  ];
  DERIVE.forEach(([re, fn]) => {
    const m = re.exec(base);
    if (m) add(fn(m));
  });
  return Object.keys(set);
}

/** 不规则变化补充表（只收常见词，取不到就退回「不高亮」，不会硬编） */
const IRREGULAR = {
  alga: ['algae'], craftsman: ['craftsmen'], man: ['men'], woman: ['women'],
  undergo: ['underwent', 'undergone'], understand: ['understood'],
  arise: ['arose', 'arisen'], bear: ['bore', 'borne'], begin: ['began', 'begun'],
  bind: ['bound'], bite: ['bit', 'bitten'], bleed: ['bled'], blow: ['blew', 'blown'],
  break: ['broke', 'broken'], bring: ['brought'], build: ['built'], buy: ['bought'],
  catch: ['caught'], choose: ['chose', 'chosen'], come: ['came'], cost: ['cost'],
  cut: ['cut'], deal: ['dealt'], dig: ['dug'], do: ['did', 'done'],
  draw: ['drew', 'drawn'], drink: ['drank', 'drunk'], drive: ['drove', 'driven'],
  eat: ['ate', 'eaten'], fall: ['fell', 'fallen'], feed: ['fed'], feel: ['felt'],
  fight: ['fought'], find: ['found'], fly: ['flew', 'flown'],
  forbid: ['forbade', 'forbidden'], forget: ['forgot', 'forgotten'],
  forgive: ['forgave', 'forgiven'], freeze: ['froze', 'frozen'], get: ['got', 'gotten'],
  give: ['gave', 'given'], go: ['went', 'gone'], grow: ['grew', 'grown'],
  hang: ['hung'], have: ['had'], hear: ['heard'], hide: ['hid', 'hidden'],
  hit: ['hit'], hold: ['held'], hurt: ['hurt'], keep: ['kept'],
  know: ['knew', 'known'], lay: ['laid'], lead: ['led'], leave: ['left'],
  lend: ['lent'], let: ['let'], lie: ['lay', 'lain'], lose: ['lost'],
  make: ['made'], mean: ['meant'], meet: ['met'], pay: ['paid'], put: ['put'],
  read: ['read'], ride: ['rode', 'ridden'], ring: ['rang', 'rung'],
  rise: ['rose', 'risen'], run: ['ran'], say: ['said'], see: ['saw', 'seen'],
  seek: ['sought'], sell: ['sold'], send: ['sent'], set: ['set'],
  shake: ['shook', 'shaken'], shine: ['shone'], shoot: ['shot'],
  show: ['showed', 'shown'], shrink: ['shrank', 'shrunk'], shut: ['shut'],
  sing: ['sang', 'sung'], sink: ['sank', 'sunk'], sit: ['sat'], sleep: ['slept'],
  slide: ['slid'], speak: ['spoke', 'spoken'], spend: ['spent'], split: ['split'],
  spread: ['spread'], stand: ['stood'], steal: ['stole', 'stolen'],
  stick: ['stuck'], strike: ['struck'], swear: ['swore', 'sworn'],
  sweep: ['swept'], swim: ['swam', 'swum'], swing: ['swung'],
  /* 常见但易漏的：体检发现例句里用了这些形式却没进表（bent/knelt/upheld…） */
  bend: ['bent'], kneel: ['knelt'], bury: ['buried'], uphold: ['upheld'],
  leap: ['leapt'], creep: ['crept'], weep: ['wept'], flee: ['fled'],
  grind: ['ground'], bind: ['bound'], spin: ['spun'], spit: ['spat'],
  mistake: ['mistook', 'mistaken'], overcome: ['overcame'], foresee: ['foresaw', 'foreseen'],
  sink: ['sank', 'sunk'], spring: ['sprang'], sting: ['stung'],  take: ['took', 'taken'], teach: ['taught'], tear: ['tore', 'torn'],
  tell: ['told'], think: ['thought'], throw: ['threw', 'thrown'],
  wake: ['woke', 'woken'], wear: ['wore', 'worn'], win: ['won'],
  wind: ['wound'], withdraw: ['withdrew', 'withdrawn'], write: ['wrote', 'written'],
  analysis: ['analyses'], crisis: ['crises'], thesis: ['theses'],
  phenomenon: ['phenomena'], criterion: ['criteria'], datum: ['data'],
  bacterium: ['bacteria'], medium: ['media'], stimulus: ['stimuli'],
  nucleus: ['nuclei'], radius: ['radii'], fungus: ['fungi'], cactus: ['cacti'],
  appendix: ['appendices'], index: ['indices', 'indexes'], matrix: ['matrices'],
  syllabus: ['syllabi'], life: ['lives'], knife: ['knives'], wife: ['wives'],
  leaf: ['leaves'], half: ['halves'], shelf: ['shelves'], wolf: ['wolves'],
  thief: ['thieves'], self: ['selves'], foot: ['feet'], tooth: ['teeth'],
  goose: ['geese'], mouse: ['mice'], louse: ['lice'], child: ['children'],
  sheep: ['sheep'], deer: ['deer'], fish: ['fish', 'fishes'],
  species: ['species'], series: ['series'], means: ['means'],
  equipment: ['equipment'], furniture: ['furniture'], information: ['information'],
  knowledge: ['knowledge'], advice: ['advice'], luggage: ['luggage'],
  baggage: ['baggage']
};

/**
 * 在例句中定位目标词（含各种屈折形式），返回 [start, end) 或 null。
 * 优先「整词边界」匹配（避免 equip 命中 expedition 里的片段）；
 * 都找不到时退一步按子串找 —— 词库里有 OCR 粘连（"mistoftears"）。
 */
function exSpan(sentence, w) {
  const s = String(sentence === undefined || sentence === null ? '' : sentence);
  const base = String(w || '').toLowerCase();
  if (!s || !base) return null;
  const cands = inflections(base);
  const irr = IRREGULAR[base];
  if (irr) irr.forEach(x => { if (cands.indexOf(x) < 0) cands.push(x); });
  // 长的优先：先试 underwent 再试 undergo，避免只切到词根
  cands.sort((a, b) => b.length - a.length);
  const low = s.toLowerCase();

  for (let k = 0; k < cands.length; k += 1) {
    const c = cands[k];
    if (c.length < 2) continue;
    const re = new RegExp('(^|[^a-z])(' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=[^a-z]|$)', 'i');
    const m = re.exec(low);
    if (m) {
      const start = m.index + m[1].length;
      return [start, start + c.length];
    }
  }
  // 兜底：无边界子串（OCR 粘连），但仍要求长度 >= 4 以免误命中
  for (let k = 0; k < cands.length; k += 1) {
    const c = cands[k];
    if (c.length < 4) continue;
    const at = low.indexOf(c);
    if (at >= 0) return [at, at + c.length];
  }
  return null;
}

/**
 * 把例句切成若干段，标出目标词那一段，供页面加黑加粗。
 * 返回 [{ t: '文本', b: true|false }]，拼起来等于 exText(sentence)。
 * 定位不到目标词时返回单段（整句都不加粗），绝不猜。
 * 注意：切分基于 exText 之后的文本，所以朗读用的字符串与显示完全一致。
 */
function exParts(sentence, w) {
  const text = exText(sentence);
  if (!text) return [];
  const span = exSpan(text, w);
  if (!span) return [{ t: text, b: false }];
  const out = [];
  if (span[0] > 0) out.push({ t: text.slice(0, span[0]), b: false });
  out.push({ t: text.slice(span[0], span[1]), b: true });
  if (span[1] < text.length) out.push({ t: text.slice(span[1]), b: false });
  return out;
}

module.exports = {
  all, get, chapterList, chapterWords, search, slice,
  themeImage, card, similar, forms, prevTag, options, example, exText, exSpan, exParts,
  total: words.list.length
};
