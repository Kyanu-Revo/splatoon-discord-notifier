import { fetchCoopSchedule, sendEmbed, deleteMessage, loadIds, saveIds } from './utils.mjs';

const TRACKING_PATH = 'data/salmon-message-ids.json';
const config = JSON.parse(process.env.DISCORD_CONFIG);
const salmon = config.salmon;

if (!salmon) { console.log('サーモン設定なし'); process.exit(0); }

const now = new Date();
const testMode = process.env.TEST_MODE === 'true';
const shifts = await fetchCoopSchedule();

function formatShiftTime(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const h = jst.getUTCHours();
  const min = String(jst.getUTCMinutes()).padStart(2, '0');
  const dow = ['日','月','火','水','木','金','土'][jst.getUTCDay()];
  return `${m}/${d}(${dow}) ${h}:${min}`;
}

const next = shifts
  .map(e => ({ ...e, startTime: new Date(e.start_time), endTime: new Date(e.end_time) }))
  .filter(e => testMode ? e.startTime > now : e.startTime > now && e.startTime <= new Date(now.getTime() + 20 * 60 * 1000))
  .sort((a, b) => a.startTime - b.startTime)[0];

if (!next) { console.log('通知対象なし'); process.exit(0); }

const prev = await loadIds(TRACKING_PATH);
if (prev.last) await deleteMessage(salmon.webhook, prev.last);

const isBigRun = next.is_big_run;
const weapons = next.weapons.map(w => w.name).join(' / ');
const descLines = [
  `${formatShiftTime(next.startTime)} 〜 ${formatShiftTime(next.endTime)}`,
  `**ステージ:** ${next.stage.name}`,
  `**オカシラシャケ:** ${next.boss?.name || '不明'}`,
  `**ブキ:** ${weapons}`,
];
if (isBigRun) descLines.unshift('⚠️ **ビッグラン開催中！**');

const newId = await sendEmbed(salmon.webhook, {
  content: [salmon.role, isBigRun ? 'ビッグランが始まります！' : 'サーモンランのシフトが始まります！'].filter(Boolean).join('\n'),
  embeds: [{
    description: descLines.join('\n'),
    color: isBigRun ? 0xFFD700 : 0xFF7700,
    image: { url: next.stage.image },
    thumbnail: { url: 'https://cdn.discordapp.com/emojis/1504325897920970752.png' },
    footer: { text: 'サーモンラン' },
  }],
});

await saveIds({ last: newId }, TRACKING_PATH);
console.log('サーモン通知完了');
