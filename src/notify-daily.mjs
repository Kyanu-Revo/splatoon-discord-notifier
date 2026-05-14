const API_URL = 'https://spla3.yuu26.com/api/x/schedule';
const config = JSON.parse(process.env.DISCORD_CONFIG);

const VALID_RULES = ['ガチエリア', 'ガチヤグラ', 'ガチホコバトル', 'ガチアサリ'];

const RULE_COLORS = {
  'ガチエリア':    0x1CE3BB,
  'ガチヤグラ':    0xB457FF,
  'ガチホコバトル': 0xF1C40F,
  'ガチアサリ':    0x34B4DB,
};

const RULE_EMOJI = {
  'ガチエリア':    '<:Rarea:1504326652098777318>',
  'ガチヤグラ':    '<:Ryagura:1504326778389266582>',
  'ガチホコバトル': '<:Rhoko:1504326737780015196>',
  'ガチアサリ':    '<:Rasari:1504326606758481931>',
};
const RULE_EMOJI_ID = {
  'ガチエリア':    '1504326652098777318',
  'ガチヤグラ':    '1504326778389266582',
  'ガチホコバトル': '1504326737780015196',
  'ガチアサリ':    '1504326606758481931',
};

const TRACKING_PATH = 'data/message-ids.json';

function toJSTDate(date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function formatTimeJST(date) {
  const jst = toJSTDate(date);
  const hour = jst.getUTCHours();
  const min = String(jst.getUTCMinutes()).padStart(2, '0');
  const prefix = hour < 9 ? '翌' : '';
  return `${prefix}${hour}:${min}`;
}

function toDisplayName(name) {
  return name.replace('ガチホコバトル', 'ガチホコ');
}

async function sendToDiscord(webhookUrl, payload) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(webhookUrl + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`送信成功: ${webhookUrl.slice(0, 60)}...`);
      return data.id;
    }
    if (res.status === 429) {
      const retryAfter = parseFloat(res.headers.get('retry-after') || attempt * 10);
      console.log(`レート制限 (試行${attempt}/3): ${retryAfter}秒待機`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
    } else {
      console.error(`送信失敗: ${res.status} ${await res.text()}`);
      return null;
    }
  }
  return null;
}

async function deleteMessage(webhookUrl, messageId) {
  if (!messageId) return;
  const base = webhookUrl.split('?')[0];
  const res = await fetch(`${base}/messages/${messageId}`, { method: 'DELETE' });
  if (res.ok || res.status === 404) {
    console.log(`削除成功 (ID: ${messageId})`);
  } else {
    console.error(`削除失敗: ${res.status}`);
  }
}

async function loadIds() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return { daily: {}, upcoming: {} };

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${TRACKING_PATH}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
  });
  if (!res.ok) return { daily: {}, upcoming: {} };
  const file = await res.json();
  return JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
}

async function saveIds(data) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${TRACKING_PATH}`, { headers });
  const sha = getRes.ok ? (await getRes.json()).sha : undefined;

  const content = Buffer.from(JSON.stringify(data)).toString('base64');
  const body = { message: 'chore: update message ids [skip ci]', content, ...(sha && { sha }) };

  const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${TRACKING_PATH}`, {
    method: 'PUT', headers, body: JSON.stringify(body),
  });
  if (putRes.ok) {
    console.log('メッセージID保存完了');
  } else {
    console.error(`メッセージID保存失敗: ${putRes.status} ${await putRes.text()}`);
  }
}

// 前回のメッセージIDを取得して削除
const prevData = await loadIds();
const prevIds = prevData.daily || {};
const prevUpcomingIds = prevData.upcoming || {};

if (prevIds.daily) await deleteMessage(config.daily.webhook, prevIds.daily);
for (const rule of VALID_RULES) {
  if (prevIds[rule] && config.modes[rule]) {
    await deleteMessage(config.modes[rule].webhook, prevIds[rule]);
  }
  for (const id of (prevUpcomingIds[rule] || [])) {
    if (config.modes[rule]) await deleteMessage(config.modes[rule].webhook, id);
  }
}

// スケジュール取得
const res = await fetch(API_URL, { headers: { 'user-agent': 'splatoon-discord-notifier' } });
const data = await res.json();
const now = new Date();
const nowJST = toJSTDate(now);

// 今日9:00 JST〜翌日9:00 JST
const jstDateStr = nowJST.toISOString().slice(0, 10);
const dayStart = new Date(`${jstDateStr}T09:00:00+09:00`);
const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

const todayLabel = nowJST.toLocaleDateString('ja-JP', {
  timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
});

// ルールごとにグループ化
const grouped = {};
for (const rule of VALID_RULES) grouped[rule] = [];

for (const e of data.results) {
  const rule = e.rule?.name;
  if (!grouped[rule]) continue;
  const startTime = new Date(e.start_time);
  if (startTime < dayStart || startTime >= dayEnd) continue;
  if (!Array.isArray(e.stages) || e.stages.length < 2) continue;
  grouped[rule].push({
    startTime,
    name: `${e.stages[0].name} / ${e.stages[1].name}`,
    stageImages: [e.stages[0].image, e.stages[1].image],
  });
}
for (const rule of VALID_RULES) {
  grouped[rule].sort((a, b) => a.startTime - b.startTime);
}

const newIds = {};

// ① デイリーwebhook：時間順まとめ
const allEntries = [];
for (const rule of VALID_RULES) {
  for (const e of grouped[rule]) allEntries.push({ rule, ...e });
}
allEntries.sort((a, b) => a.startTime - b.startTime || VALID_RULES.indexOf(a.rule) - VALID_RULES.indexOf(b.rule));

const descLines = [todayLabel, ''];
for (const e of allEntries) {
  descLines.push(`${formatTimeJST(e.startTime)}〜 ${toDisplayName(e.rule)}`);
  descLines.push(`${RULE_EMOJI[e.rule]} ${e.name}`);
  descLines.push('');
}

newIds.daily = await sendToDiscord(config.daily.webhook, {
  content: [config.daily.role, '本日のXマッチスケジュール'].filter(Boolean).join('\n'),
  embeds: [{
    description: descLines.join('\n').trimEnd(),
    color: 0x19D719,
    footer: { text: 'Xマッチ スケジュール' },
  }],
});

// ② 各モードのwebhook：個別送信
for (const rule of VALID_RULES) {
  const entries = grouped[rule];
  const modeConfig = config.modes[rule];
  if (!modeConfig || entries.length === 0) continue;

  const fields = entries.map(e => ({
    name: `${formatTimeJST(e.startTime)}〜`,
    value: e.name,
    inline: true,
  }));
  if (fields.length % 2 !== 0) fields.push({ name: '​', value: '​', inline: true });

  newIds[rule] = await sendToDiscord(modeConfig.webhook, {
    content: [modeConfig.fixedRole, `本日の${toDisplayName(rule)}スケジュール`].filter(Boolean).join('\n'),
    embeds: [{
      description: `${todayLabel}`,
      color: RULE_COLORS[rule],
      fields,
      image: { url: entries[0].stageImages[0] },
      thumbnail: { url: `https://cdn.discordapp.com/emojis/${RULE_EMOJI_ID[rule]}.png` },
      footer: { text: 'Xマッチ スケジュール' },
    }],
  });

  await new Promise(r => setTimeout(r, 500));
}

await saveIds({ daily: newIds, upcoming: {} });
console.log('デイリー通知完了');
