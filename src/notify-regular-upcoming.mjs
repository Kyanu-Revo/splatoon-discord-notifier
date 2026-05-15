import { getTimeSlotLabel, fetchSchedule, sendEmbed } from './utils.mjs';

const config = JSON.parse(process.env.DISCORD_CONFIG);
const regular = config.regular;

if (!regular) { console.log('ナワバリ設定なし'); process.exit(0); }

const now = new Date();
const testMode = process.env.TEST_MODE === 'true';
const schedule = await fetchSchedule();

const next = schedule.regular
  .filter(e => e.stages?.length >= 2)
  .map(e => ({ startTime: new Date(e.start_time), stages: e.stages }))
  .filter(e => testMode ? e.startTime > now : e.startTime > now && e.startTime <= new Date(now.getTime() + 20 * 60 * 1000))
  .sort((a, b) => a.startTime - b.startTime)[0];

if (!next) { console.log('通知対象なし'); process.exit(0); }

const timeLabel = getTimeSlotLabel(next.startTime);
const timeRole = regular.timeRoles?.[timeLabel] || '';
const mentions = [regular.fixedRole, timeRole].filter(Boolean).join(' ');
const stages = `${next.stages[0].name} / ${next.stages[1].name}`;

const content = [mentions, `次のレギュラーマッチのステージ`, stages].filter(Boolean).join('\n');

console.log(`通知: ナワバリ (${timeLabel})`);
await sendEmbed(regular.webhook, { content });
