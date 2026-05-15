import { getTimeSlotLabel, fetchSchedule, sendEmbed } from './utils.mjs';

const config = JSON.parse(process.env.DISCORD_CONFIG);
const event = config.event;

if (!event) { console.log('イベント設定なし'); process.exit(0); }

const now = new Date();
const testMode = process.env.TEST_MODE === 'true';
const schedule = await fetchSchedule();

const next = schedule.event
  .filter(e => e.event && e.stages?.length >= 2)
  .map(e => ({ startTime: new Date(e.start_time), rule: e.rule?.name || '', stages: e.stages, eventName: e.event.name }))
  .filter(e => testMode ? e.startTime > now : e.startTime > now && e.startTime <= new Date(now.getTime() + 20 * 60 * 1000))
  .sort((a, b) => a.startTime - b.startTime)[0];

if (!next) { console.log('通知対象なし'); process.exit(0); }

const timeLabel = getTimeSlotLabel(next.startTime);
const stages = `${next.stages[0].name} / ${next.stages[1].name}`;

const content = [`次の「${next.eventName}」のステージ`, `${next.rule}　${stages}`].join('\n');

console.log(`通知: イベントマッチ ${next.eventName} (${timeLabel})`);
await sendEmbed(event.webhook, { content });
