import { toJSTDate, formatTimeJST, getDayWindow, fetchSchedule, sendEmbed, clearChannelBefore } from './utils.mjs';

const config = JSON.parse(process.env.DISCORD_CONFIG);
const regular = config.regular;

if (!regular) { console.log('ナワバリ設定なし'); process.exit(0); }

const now = new Date();
const nowJST = toJSTDate(now);
const { dayStart, dayEnd, refDateStr } = getDayWindow(nowJST);
const todayLabel = nowJST.toLocaleDateString('ja-JP', {
  timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
});

const schedule = await fetchSchedule();

const entries = schedule.regular
  .filter(e => e.stages?.length >= 2)
  .map(e => ({ startTime: new Date(e.start_time), stages: `${e.stages[0].name} / ${e.stages[1].name}` }))
  .filter(e => e.startTime >= dayStart && e.startTime < dayEnd)
  .sort((a, b) => a.startTime - b.startTime);

const descLines = [todayLabel, ''];
for (const e of entries) {
  descLines.push(`**${formatTimeJST(e.startTime, refDateStr)}〜**`);
  descLines.push(e.stages);
  descLines.push('');
}

const newId = await sendEmbed(regular.webhook, {
  content: [regular.fixedRole, '今後のレギュラーマッチスケジュール'].filter(Boolean).join('\n'),
  embeds: [{
    description: descLines.join('\n').trimEnd(),
    color: 0x00C954,
    thumbnail: { url: 'https://cdn.discordapp.com/emojis/1504325681679433829.png' },
    footer: { text: 'レギュラーマッチ スケジュール' },
  }],
});

if (newId) await clearChannelBefore(regular.channelId, newId, config.botToken);
console.log('ナワバリデイリー通知完了');
