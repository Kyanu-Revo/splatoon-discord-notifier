const API_URL = 'https://spla3.yuu26.com/api/x/schedule';
const config = JSON.parse(process.env.DISCORD_CONFIG);

const VALID_RULES = ['ガチエリア', 'ガチヤグラ', 'ガチホコバトル', 'ガチアサリ'];
const RULE_EMOJI = {
  'ガチエリア':    '<:Rarea:1504326652098777318>',
  'ガチヤグラ':    '<:Ryagura:1504326778389266582>',
  'ガチホコバトル': '<:Rhoko:1504326737780015196>',
  'ガチアサリ':    '<:Rasari:1504326606758481931>',
};
function toDisplayName(name) {
  return name.replace('ガチホコバトル', 'ガチホコ');
}

function getTimeSlotLabel(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const hour = jst.getUTCHours();
  return `${hour}:00 - ${hour + 1}:59`;
}

async function sendToDiscord(webhookUrl, content) {
  const formData = new FormData();
  formData.append('payload_json', JSON.stringify({ content }));

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(webhookUrl + '?wait=true', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      console.log('通知送信成功');
      return data.id;
    }
    if (res.status === 429) {
      const retryAfter = parseFloat(res.headers.get('retry-after') || attempt * 10);
      console.log(`レート制限 (試行${attempt}/3): ${retryAfter}秒待機`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
    } else {
      console.error(`送信失敗: ${res.status} ${await res.text()}`);
      return null;
    }
  }
  return null;
}

const res = await fetch(API_URL, { headers: { 'user-agent': 'splatoon-discord-notifier' } });
const data = await res.json();
const now = new Date();

// TEST_MODE=true のときは時間制限なしで次のイベントを対象
const testMode = process.env.TEST_MODE === 'true';
const upcoming = data.results
  .filter(e => e.rule?.name && Array.isArray(e.stages) && e.stages.length >= 2)
  .map(e => ({
    name: `${e.rule.name} ${e.stages[0].name} ${e.stages[1].name}`,
    rule: e.rule.name,
    startTime: new Date(e.start_time),
    stage1Image: e.stages[0].image,
    stage2Image: e.stages[1].image,
  }))
  .filter(e => VALID_RULES.includes(e.rule))
  .filter(e => testMode
    ? e.startTime > now
    : e.startTime > now && e.startTime <= new Date(now.getTime() + 20 * 60 * 1000)
  )
  .sort((a, b) => a.startTime - b.startTime)[0];

if (!upcoming) {
  console.log('通知対象のイベントなし');
  process.exit(0);
}

const modeConfig = config.modes[upcoming.rule];
if (!modeConfig) {
  console.log(`モード設定なし: ${upcoming.rule}`);
  process.exit(0);
}

const timeLabel = getTimeSlotLabel(upcoming.startTime);
const timeRole = modeConfig.timeRoles[timeLabel] || '';
const mentions = [modeConfig.fixedRole, timeRole].filter(Boolean).join(' ');

console.log(`通知: ${upcoming.name} (${timeLabel})`);
const content = `${mentions}\nもうすぐ ${toDisplayName(upcoming.name)} の時間です！`;
await sendToDiscord(modeConfig.webhook, content);
