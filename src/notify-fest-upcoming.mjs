import { fetchSchedule, sendEmbed, loadIds, saveIds } from './utils.mjs';

const TRACKING_PATH = 'data/fest-message-ids.json';
const config = JSON.parse(process.env.DISCORD_CONFIG);
const fest = config.fest;

if (!fest) { console.log('フェス設定なし'); process.exit(0); }

const now = new Date();
const testMode = process.env.TEST_MODE === 'true';
const schedule = await fetchSchedule();

const inRange = e => {
  const t = new Date(e.start_time);
  return testMode ? t > now : t > now && t <= new Date(now.getTime() + 20 * 60 * 1000);
};

const nextOpen = schedule.fest
  .filter(e => e.is_fest && e.stages?.length >= 2 && inRange(e))
  .map(e => ({ startTime: new Date(e.start_time), stages: `${e.stages[0].name} / ${e.stages[1].name}` }))
  .sort((a, b) => a.startTime - b.startTime)[0];

const nextChallenge = schedule.fest_challenge
  .filter(e => e.is_fest && e.stages?.length >= 2 && inRange(e))
  .map(e => ({ startTime: new Date(e.start_time), stages: `${e.stages[0].name} / ${e.stages[1].name}` }))
  .sort((a, b) => a.startTime - b.startTime)[0];

const nextTricolor = schedule.fest
  .filter(e => e.is_tricolor && e.tricolor_stages?.length >= 1 && inRange(e))
  .map(e => ({ startTime: new Date(e.start_time), stages: e.tricolor_stages.map(s => s.name).join(' / ') }))
  .sort((a, b) => a.startTime - b.startTime)[0];

if (!nextOpen && !nextChallenge && !nextTricolor) {
  console.log('通知対象なし');
  process.exit(0);
}

const mentions = fest.role || '';
const lines = [mentions];

if (nextChallenge || nextOpen) {
  lines.push('次のフェスマッチのステージ');
  if (nextChallenge) lines.push(`チャレンジ: ${nextChallenge.stages}`);
  if (nextOpen) lines.push(`オープン: ${nextOpen.stages}`);
}
if (nextTricolor) {
  if (nextChallenge || nextOpen) lines.push('');
  lines.push('次のトリカラバトルのステージ');
  lines.push(nextTricolor.stages);
}

const content = lines.filter(Boolean).join('\n');

console.log('通知: フェスマッチ');
const messageId = await sendEmbed(fest.webhook, { content });

if (messageId) {
  const prev = await loadIds(TRACKING_PATH);
  const upcoming = [...(prev.upcoming || []), messageId];
  await saveIds({ ...prev, upcoming }, TRACKING_PATH);
}
