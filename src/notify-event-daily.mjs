import { toJSTDate, formatTimeJST, getDayWindow, fetchSchedule, sendEmbed, clearChannelBefore } from './utils.mjs';

const config = JSON.parse(process.env.DISCORD_CONFIG);
const event = config.event;

if (!event) { console.log('イベント設定なし'); process.exit(0); }

const now = new Date();
const nowJST = toJSTDate(now);
const { dayStart, dayEnd, refDateStr } = getDayWindow(nowJST);
const todayLabel = nowJST.toLocaleDateString('ja-JP', {
  timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
});

const schedule = await fetchSchedule();

const entries = schedule.event
  .filter(e => e.event && e.stages?.length >= 2)
  .map(e => ({ startTime: new Date(e.start_time), rule: e.rule?.name || '', stages: `${e.stages[0].name} / ${e.stages[1].name}`, eventName: e.event.name, eventDesc: e.event.desc }))
  .filter(e => e.startTime >= dayStart && e.startTime < dayEnd)
  .sort((a, b) => a.startTime - b.startTime);

if (entries.length === 0) {
  console.log('本日のイベントマッチなし');
  process.exit(0);
}

const eventName = entries[0].eventName;
const eventDesc = entries[0].eventDesc;

const descLines = [todayLabel, '', `**${eventName}**`, eventDesc, ''];
for (const e of entries) {
  descLines.push(`${formatTimeJST(e.startTime, refDateStr)}〜 ${e.rule}`);
  descLines.push(e.stages);
  descLines.push('');
}

const newId = await sendEmbed(event.webhook, {
  content: [event.fixedRole, '今後のイベントマッチスケジュール'].filter(Boolean).join('\n'),
  embeds: [{
    description: descLines.join('\n').trimEnd(),
    color: 0xFF4F8A,
    thumbnail: { url: 'https://cdn.discordapp.com/emojis/1504326016091558130.png' },
    footer: { text: 'イベントマッチ スケジュール' },
  }],
});

if (newId) await clearChannelBefore(event.channelId, newId, config.botToken);
console.log('イベントデイリー通知完了');
