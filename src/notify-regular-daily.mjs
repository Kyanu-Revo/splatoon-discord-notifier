import { toJSTDate, formatTimeJST, getDayWindow, fetchSchedule, sendEmbed, deleteMessage, loadIds, saveIds } from './utils.mjs';

const TRACKING_PATH = 'data/regular-message-ids.json';
const config = JSON.parse(process.env.DISCORD_CONFIG);
const regular = config.regular;

if (!regular) { console.log('ナワバリ設定なし'); process.exit(0); }

const prev = await loadIds(TRACKING_PATH);
if (prev.daily) await deleteMessage(regular.webhook, prev.daily);
for (const id of (prev.upcoming || [])) await deleteMessage(regular.webhook, id);

const now = new Date();
const nowJST = toJSTDate(now);
const { dayStart, dayEnd } = getDayWindow(nowJST);
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
  descLines.push(`**${formatTimeJST(e.startTime)}〜**`);
  descLines.push(e.stages);
  descLines.push('');
}

const newId = await sendEmbed(regular.webhook, {
  content: [regular.fixedRole, '本日のレギュラーマッチスケジュール'].filter(Boolean).join('\n'),
  embeds: [{
    description: descLines.join('\n').trimEnd(),
    color: 0x00C954,
    thumbnail: { url: 'https://cdn.discordapp.com/emojis/1504325681679433829.png' },
    footer: { text: 'レギュラーマッチ スケジュール' },
  }],
});

await saveIds({ daily: newId, upcoming: [] }, TRACKING_PATH);
console.log('ナワバリデイリー通知完了');
