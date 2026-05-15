import { clearChannelBefore, toJSTDate, formatTimeJST, getDayWindow } from './utils.mjs';

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

// スケジュール取得
const res = await fetch(API_URL, { headers: { 'user-agent': 'splatoon-discord-notifier' } });
const data = await res.json();
const now = new Date();
const nowJST = toJSTDate(now);
const { dayStart, dayEnd, refDateStr } = getDayWindow(nowJST);

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

// ① デイリーwebhook：時間順まとめ
const allEntries = [];
for (const rule of VALID_RULES) {
  for (const e of grouped[rule]) allEntries.push({ rule, ...e });
}
allEntries.sort((a, b) => a.startTime - b.startTime || VALID_RULES.indexOf(a.rule) - VALID_RULES.indexOf(b.rule));

const descLines = [todayLabel, ''];
for (const e of allEntries) {
  descLines.push(`${formatTimeJST(e.startTime, refDateStr)}〜 ${toDisplayName(e.rule)}`);
  descLines.push(`${RULE_EMOJI[e.rule]} ${e.name}`);
  descLines.push('');
}

const dailyId = await sendToDiscord(config.daily.webhook, {
  content: [config.daily.role, '今後のXマッチスケジュール'].filter(Boolean).join('\n'),
  embeds: [{
    description: descLines.join('\n').trimEnd(),
    color: 0x19D719,
    footer: { text: 'Xマッチ スケジュール' },
  }],
});
if (dailyId) await clearChannelBefore(config.daily.channelId, dailyId, config.botToken);

// ② 各モードのwebhook：個別送信
for (const rule of VALID_RULES) {
  const entries = grouped[rule];
  const modeConfig = config.modes[rule];
  if (!modeConfig || entries.length === 0) continue;

  const fields = entries.map(e => ({
    name: `${formatTimeJST(e.startTime, refDateStr)}〜`,
    value: e.name,
    inline: true,
  }));
  if (fields.length % 2 !== 0) fields.push({ name: '​', value: '​', inline: true });

  const modeId = await sendToDiscord(modeConfig.webhook, {
    content: [modeConfig.fixedRole, `今後の${toDisplayName(rule)}スケジュール`].filter(Boolean).join('\n'),
    embeds: [{
      description: `${todayLabel}`,
      color: RULE_COLORS[rule],
      fields,
      image: { url: entries[0].stageImages[0] },
      thumbnail: { url: `https://cdn.discordapp.com/emojis/${RULE_EMOJI_ID[rule]}.png` },
      footer: { text: 'Xマッチ スケジュール' },
    }],
  });
  if (modeId) await clearChannelBefore(modeConfig.channelId, modeId, config.botToken);

  await new Promise(r => setTimeout(r, 500));
}

console.log('デイリー通知完了');
