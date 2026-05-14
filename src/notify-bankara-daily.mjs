import { toJSTDate, formatTimeJST, getDayWindow, fetchSchedule, sendEmbed, deleteMessage, loadIds, saveIds } from './utils.mjs';

const TRACKING_PATH = 'data/bankara-message-ids.json';
const config = JSON.parse(process.env.DISCORD_CONFIG);
const bankara = config.bankara;

if (!bankara) { console.log('バンカラ設定なし'); process.exit(0); }

const RULE_EMOJI = {
  'ガチエリア':    '<:Rarea:1504326652098777318>',
  'ガチヤグラ':    '<:Ryagura:1504326778389266582>',
  'ガチホコバトル': '<:Rhoko:1504326737780015196>',
  'ガチアサリ':    '<:Rasari:1504326606758481931>',
};

const prev = await loadIds(TRACKING_PATH);
if (prev.daily) await deleteMessage(bankara.webhook, prev.daily);
for (const id of (prev.upcoming || [])) await deleteMessage(bankara.webhook, id);

const now = new Date();
const nowJST = toJSTDate(now);
const { dayStart, dayEnd } = getDayWindow(nowJST);
const todayLabel = nowJST.toLocaleDateString('ja-JP', {
  timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
});

const schedule = await fetchSchedule();

const challengeMap = {};
for (const e of schedule.bankara_challenge) {
  const startTime = new Date(e.start_time);
  if (startTime < dayStart || startTime >= dayEnd || !e.rule || !e.stages?.length) continue;
  challengeMap[startTime.getTime()] = { startTime, rule: e.rule.name, stages: `${e.stages[0].name} / ${e.stages[1].name}` };
}
const openMap = {};
for (const e of schedule.bankara_open) {
  const startTime = new Date(e.start_time);
  if (startTime < dayStart || startTime >= dayEnd || !e.rule || !e.stages?.length) continue;
  openMap[startTime.getTime()] = { startTime, rule: e.rule.name, stages: `${e.stages[0].name} / ${e.stages[1].name}` };
}

const times = [...new Set([...Object.keys(challengeMap), ...Object.keys(openMap)])].sort((a, b) => a - b);

const descLines = [todayLabel, ''];
for (const t of times) {
  const c = challengeMap[t];
  const o = openMap[t];
  const startTime = (c || o).startTime;
  descLines.push(`**${formatTimeJST(startTime)}〜**`);
  if (c) descLines.push(`${RULE_EMOJI[c.rule] || ''} チャレンジ`, c.stages);
  if (o) descLines.push(`${RULE_EMOJI[o.rule] || ''} オープン`, o.stages);
  descLines.push('');
}

const newId = await sendEmbed(bankara.webhook, {
  content: [bankara.fixedRole, '本日のバンカラマッチスケジュール'].filter(Boolean).join('\n'),
  embeds: [{
    description: descLines.join('\n').trimEnd(),
    color: 0xFF1900,
    thumbnail: { url: 'https://cdn.discordapp.com/emojis/1504325821245165588.png' },
    footer: { text: 'バンカラマッチ スケジュール' },
  }],
});

await saveIds({ daily: newId, upcoming: [] }, TRACKING_PATH);
console.log('バンカラデイリー通知完了');
