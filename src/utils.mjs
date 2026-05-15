export function toJSTDate(date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

export function formatTimeJST(date) {
  const jst = toJSTDate(date);
  const hour = jst.getUTCHours();
  const min = String(jst.getUTCMinutes()).padStart(2, '0');
  const prefix = hour < 9 ? '翌' : '';
  return `${prefix}${hour}:${min}`;
}

export function getTimeSlotLabel(date) {
  const jst = toJSTDate(date);
  const hour = jst.getUTCHours();
  return `${hour}:00 - ${hour + 1}:59`;
}

export function getDayWindow(nowJST) {
  const str = nowJST.toISOString().slice(0, 10);
  const dayStart = new Date(`${str}T09:00:00+09:00`);
  return { dayStart, dayEnd: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) };
}

export async function fetchSchedule() {
  const res = await fetch('https://spla3.yuu26.com/api/schedule', {
    headers: { 'user-agent': 'splatoon-discord-notifier' },
  });
  return (await res.json()).result;
}

export async function fetchCoopSchedule() {
  const res = await fetch('https://spla3.yuu26.com/api/coop-grouping/schedule', {
    headers: { 'user-agent': 'splatoon-discord-notifier' },
  });
  return (await res.json()).results;
}

export async function sendEmbed(webhookUrl, payload) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(webhookUrl + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const { id } = await res.json();
      console.log(`送信成功: ${webhookUrl.slice(0, 60)}...`);
      return id;
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

export async function deleteMessage(webhookUrl, messageId) {
  if (!messageId) return;
  const res = await fetch(`${webhookUrl.split('?')[0]}/messages/${messageId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) console.error(`削除失敗: ${res.status}`);
}

export async function clearChannelBefore(channelId, beforeId, botToken) {
  const headers = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  let before = beforeId;
  while (true) {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?before=${before}&limit=100`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    if (!res.ok) {
      console.error(`メッセージ取得失敗 [channel=${channelId}]: ${res.status} ${await res.text()}`);
      break;
    }
    const messages = await res.json();
    if (!messages.length) break;
    const recent = messages.filter(m => Number(BigInt(m.id) >> 22n) + 1420070400000 > twoWeeksAgo).map(m => m.id);
    const old    = messages.filter(m => Number(BigInt(m.id) >> 22n) + 1420070400000 <= twoWeeksAgo).map(m => m.id);
    if (recent.length >= 2) {
      const delRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/bulk-delete`, {
        method: 'POST', headers, body: JSON.stringify({ messages: recent }),
      });
      if (!delRes.ok) console.error(`一括削除失敗 [channel=${channelId}]: ${delRes.status} ${await delRes.text()}`);
      else console.log(`一括削除: ${recent.length}件 [channel=${channelId}]`);
    } else if (recent.length === 1) {
      const delRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${recent[0]}`, { method: 'DELETE', headers });
      if (!delRes.ok) console.error(`削除失敗 [channel=${channelId}]: ${delRes.status}`);
    }
    for (const id of old) {
      await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${id}`, { method: 'DELETE', headers });
    }
    if (messages.length < 100) break;
    before = messages[messages.length - 1].id;
  }
}

export async function deleteMessages(channelId, messageIds, botToken) {
  const ids = messageIds.filter(Boolean);
  if (ids.length === 0) return;
  const headers = {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json',
  };
  if (ids.length === 1) {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${ids[0]}`, {
      method: 'DELETE', headers,
    });
    if (!res.ok && res.status !== 404) console.error(`削除失敗: ${res.status}`);
    return;
  }
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/bulk-delete`, {
    method: 'POST', headers, body: JSON.stringify({ messages: ids }),
  });
  if (!res.ok) console.error(`一括削除失敗: ${res.status} ${await res.text()}`);
}

export async function loadIds(path) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return {};
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return {};
  const file = await res.json();
  return JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
}

export async function saveIds(data, path) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
  const sha = getRes.ok ? (await getRes.json()).sha : undefined;
  const content = Buffer.from(JSON.stringify(data)).toString('base64');
  const body = { message: 'chore: update message ids [skip ci]', content, ...(sha && { sha }) };
  const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT', headers, body: JSON.stringify(body),
  });
  if (!putRes.ok) console.error(`ID保存失敗: ${putRes.status} ${await putRes.text()}`);
  else console.log('メッセージID保存完了');
}
