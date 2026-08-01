// plugins/menu.js
// Helper module to build pretty menu strings for WhatsApp chat
// Exports: buildMenu(options), buildAllMenu(commandsByCategory, options)

function padCenter(s, width = 48) {
  if (!s) return ' '.repeat(width);
  if (s.length >= width) return s;
  const left = Math.floor((width - s.length) / 2);
  const right = width - s.length - left;
  return ' '.repeat(left) + s + ' '.repeat(right);
}

function boxHeader(title, sub) {
  const width = 48;
  const top = '╭' + '─'.repeat(width) + '╮';
  const midTitle = '┃' + padCenter(title, width) + '┃';
  const subLine = sub ? '┃' + padCenter(sub, width) + '┃' : null;
  const sep = '┣' + '─'.repeat(width) + '┫';
  return [top, midTitle, subLine, sep].filter(Boolean).join('\n');
}

function boxFooter() {
  const width = 48;
  return '\n╰' + '─'.repeat(width) + '╯';
}

function formatCategoryLine(name, sampleCmd, prefix, width = 48) {
  const left = ` ${name}`;
  const right = sampleCmd ? `${prefix}${sampleCmd}` : '';
  const maxLeft = 28;
  const leftTrim = left.length > maxLeft ? left.slice(0, maxLeft - 1) + '…' : left;
  const space = width - leftTrim.length - right.length;
  const spacer = space > 0 ? ' '.repeat(space) : ' ';
  return `┃${leftTrim}${spacer}${right}┃`;
}

function safeTrim(s, max = 8000) {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}

/**
 * Build a compact, pretty menu summary.
 * options: { prefix, ownerName, botName, version, userName, totals: {features}, categories: [{name, sample}] }
 */
export function buildMenu(options = {}) {
  const {
    prefix = '.',
    ownerName = 'Owner',
    botName = 'Bot',
    version = '',
    userName = '',
    totals = { features: 0 },
    categories = [
      { name: 'AI', sample: 'ai' },
      { name: 'Downloader', sample: 'ytmp3' },
      { name: 'Group', sample: 'antilink' },
      { name: 'Tools', sample: 'shorten' },
      { name: 'Games', sample: 'rpg' },
    ],
  } = options;

  const title = `${botName} • Menu Cepat`;
  const sub = `${ownerName} • v${version} • fitur ${totals.features || 0}`;
  const lines = [boxHeader(title, sub)];

  lines.push(`┃ Pengguna: ${userName || 'Tamu'}`.padEnd(50, ' ') + '┃');

  lines.push('┣' + '─'.repeat(48) + '┫');

  for (const cat of categories) {
    lines.push(formatCategoryLine(cat.name, cat.sample, prefix));
  }

  lines.push('┣' + '─'.repeat(48) + '┫');

  lines.push('┃ Tips: Ketik {prefix}{command} untuk menjalankan'.replace('{prefix}', prefix).padEnd(50, ' ') + '┃');
  lines.push('┃ Contoh:'.padEnd(50, ' ') + '┃');
  const example = `┃  ${prefix}menu  ${' '.repeat(30)}┃`;
  lines.push(example);
  lines.push(boxFooter());

  return safeTrim(lines.join('\n'), 4000);
}

/**
 * Build full menu text from commandsByCategory.
 * commandsByCategory: { "AI": ["ai", "ask"], "Downloader": ["ytmp3","ytmp4"], ... }
 * options: { prefix, ownerName, botName, version, userName, headerExtra }
 */
export function buildAllMenu(commandsByCategory = {}, options = {}) {
  const {
    prefix = '.',
    ownerName = 'Owner',
    botName = 'Bot',
    version = '',
    userName = '',
    headerExtra = '',
  } = options;

  const title = `${botName} • Semua Perintah`;
  const sub = `${ownerName} • v${version} ${headerExtra ? '• ' + headerExtra : ''}`;
  const width = 48;
  const out = [boxHeader(title, sub)];
  out.push(`┃ Pengguna: ${userName || 'Tamu'}`.padEnd(width + 2, ' ') + '┃');
  out.push('┣' + '─'.repeat(width) + '┫');

  for (const [cat, cmds] of Object.entries(commandsByCategory)) {
    const catTitle = `┃ ▶ ${cat}`.padEnd(width + 2, ' ') + '┃';
    out.push(catTitle);
    out.push('┃ ' + '-'.repeat(width) + ' ┃');
    if (!Array.isArray(cmds) || cmds.length === 0) {
      out.push(`┃   (tidak ada perintah terdaftar)`.padEnd(width + 2, ' ') + '┃');
    } else {
      for (const c of cmds) {
        const cmd = typeof c === 'string' ? c : (c.command || c.name);
        const desc = typeof c === 'object' ? (c.desc || '') : '';
        const left = `   ${prefix}${cmd}`;
        const right = desc ? ` - ${desc}` : '';
        const leftTrim = left.length > 34 ? left.slice(0, 31) + '…' : left;
        const restSpace = width - leftTrim.length - right.length;
        const spacer = restSpace > 0 ? ' '.repeat(restSpace) : ' ';
        out.push(`┃${leftTrim}${spacer}${right}┃`);
      }
    }
    out.push('┣' + '─'.repeat(width) + '┫');
  }

  out.push(`┃ Tips: Reply pesan dengan ${prefix}help <command> untuk detail.`.padEnd(width + 2, ' ') + '┃');
  out.push(boxFooter());
  return safeTrim(out.join('\n'), 19000);
}
