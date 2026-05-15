import { toJSTDate, formatTimeJST, getDayWindow, fetchSchedule, sendEmbed, clearChannelBefore } from './utils.mjs';

const config = JSON.parse(process.env.DISCORD_CONFIG);
const fest = config.fest;

if (!fest) { console.log('フェス設定なし'); process.exit(0); }

const now = new Date();
const nowJST = toJSTDate(now);
const { dayStart, dayEnd, refDateStr } = getDayWindow(nowJST);

const schedule = await fetchSchedule();

const inWindow = e => {
  const t = new Date(e.start_time);
  return t >= dayStart && t < dayEnd;
};

const openEntries = schedule.fest
  .filter(e => inWindow(e) && e.is_fest && e.stages?.length >= 2)
  .map(e => ({ startTime: new Date(e.start_time), stages: `${e.stages[0].name} / ${e.stages[1].name}` }))
  .sort((a, b) => a.startTime - b.startTime);

const challengeEntries = schedule.fest_challenge
  .filter(e => inWindow(e) && e.is_fest && e.stages?.length >= 2)
  .map(e => ({ startTime: new Date(e.start_time), stages: `${e.stages[0].name} / ${e.stages[1].name}` }))
  .sort((a, b) => a.startTime - b.startTime);

const tricolorEntries = schedule.fest
  .filter(e => inWindow(e) && e.is_tricolor && e.tricolor_stages?.length >= 1)
  .map(e => ({ startTime: new Date(e.start_time), stages: e.tricolor_stages.map(s => s.name).join(' / ') }))
  .sort((a, b) => a.startTime - b.startTime);

if (openEntries.length === 0 && challengeEntries.length === 0) {
  console.log('本日のフェスマッチなし');
  process.exit(0);
}

const todayLabel = nowJST.toLocaleDateString('ja-JP', {
  timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
});

const descLines = [todayLabel, ''];
for (const e of challengeEntries) {
  descLines.push(`${formatTimeJST(e.startTime, refDateStr)}〜 チャレンジ`);
  descLines.push(e.stages);
  descLines.push('');
}
for (const e of openEntries) {
  descLines.push(`${formatTimeJST(e.startTime, refDateStr)}〜 オープン`);
  descLines.push(e.stages);
  descLines.push('');
}
for (const e of tricolorEntries) {
  descLines.push(`${formatTimeJST(e.startTime, refDateStr)}〜 トリカラバトル`);
  descLines.push(`🌈 ${e.stages}`);
  descLines.push('');
}

const newId = await sendEmbed(fest.webhook, {
  content: [fest.role, '今後のフェスマッチスケジュール'].filter(Boolean).join('\n'),
  embeds: [{
    description: descLines.join('\n').trimEnd(),
    color: 0x6E5FBA,
    thumbnail: { url: 'https://cdn.discordapp.com/emojis/1504326247214219284.png' },
    footer: { text: 'フェスマッチ スケジュール' },
  }],
});

if (newId) await clearChannelBefore(fest.channelId, newId, config.botToken);
console.log('フェスデイリー通知完了');
