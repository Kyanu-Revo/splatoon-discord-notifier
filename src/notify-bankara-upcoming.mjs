import { toJSTDate, getTimeSlotLabel, fetchSchedule, sendEmbed } from './utils.mjs';

const config = JSON.parse(process.env.DISCORD_CONFIG);
const bankara = config.bankara;

if (!bankara) { console.log('バンカラ設定なし'); process.exit(0); }

const now = new Date();
const testMode = process.env.TEST_MODE === 'true';
const schedule = await fetchSchedule();

const next = schedule.bankara_challenge
  .filter(e => e.rule && e.stages?.length >= 2)
  .map(e => ({ startTime: new Date(e.start_time), rule: e.rule.name, stages: e.stages }))
  .filter(e => testMode ? e.startTime > now : e.startTime > now && e.startTime <= new Date(now.getTime() + 20 * 60 * 1000))
  .sort((a, b) => a.startTime - b.startTime)[0];

if (!next) { console.log('通知対象なし'); process.exit(0); }

const openEntry = schedule.bankara_open.find(e => new Date(e.start_time).getTime() === next.startTime.getTime());

const timeLabel = getTimeSlotLabel(next.startTime);

const challengeStages = `${next.stages[0].name} / ${next.stages[1].name}`;
const openStages = openEntry?.stages?.length >= 2 ? `${openEntry.stages[0].name} / ${openEntry.stages[1].name}` : '不明';
const openRule = openEntry?.rule?.name || '不明';

const content = [
  `次のバンカラマッチのステージ`,
  `チャレンジ: ${next.rule}　${challengeStages}`,
  `オープン: ${openRule}　${openStages}`,
].filter(Boolean).join('\n');

console.log(`通知: バンカラ (${timeLabel})`);
await sendEmbed(bankara.webhook, { content });
