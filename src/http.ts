import { createServer, type OutgoingHttpHeaders, type Server } from "node:http";

import { cache } from "./db.js";
import { playerInfo, sessionTotals, sessionStart } from "./stats.js";
import { WEB_PORT } from "./utils/config.js";

const JSON_HEADERS: OutgoingHttpHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Potat Farmer</title>
<style>
* { margin:0; padding:0; box-sizing:border-box }
body { background:#0d0d0d; color:#ccc; font:13px/1.6 'Courier New',monospace; padding:16px }
#box { border:1px solid #333; max-width:520px; margin:0 auto }
.hdr { text-align:center; padding:6px 0; color:#fd0; font-weight:bold; border-bottom:1px solid #333; letter-spacing:2px }
.sec { padding:3px 0; border-top:1px solid #333; color:#0cc; font-weight:bold; text-align:center }
.row { display:flex; justify-content:space-between; padding:1px 14px }
.lbl { color:#666 }
.bt { border-top:1px solid #333 }
.green { color:#3c3 } .red { color:#c33 } .cyan { color:#0cc }
.yellow { color:#fd0 } .dim { color:#444 }
#foot { text-align:center; color:#444; font-size:11px; margin-top:8px }
</style>
</head>
<body>
<div id="box">
  <div class="hdr">POTAT FARMER</div>
  <div id="root">Loading&hellip;</div>
</div>
<div id="foot"></div>
<script>
const _esc = document.createElement('span')
function esc(s) { _esc.textContent = String(s || ''); return _esc.innerHTML }
function fmt(n) { return Number(n).toLocaleString() }
function pct(s, a) { return a ? Math.round(s / a * 100) + '%' : '0%' }
function delta(n) { return n > 0 ? '+' + fmt(n) : n < 0 ? '-' + fmt(-n) : '' }
function cls(n) { return n > 0 ? 'green' : n < 0 ? 'red' : '' }
function row(lbl, val, c) {
  return '<div class="row"><span class="lbl">' + lbl + '</span><span' + (c ? ' class="' + c + '"' : '') + '>' + val + '</span></div>'
}
function sec(label) { return '<div class="sec">' + label + '</div>' }
function statRows(s) {
  let out = ''
  if (s.farmAttempts > 0) {
    const fd = delta(s.farm)
    let fv = fmt(s.farmSuccesses) + ' / ' + fmt(s.farmAttempts) + ' (' + pct(s.farmSuccesses, s.farmAttempts) + ')'
    if (fd) fv += '&nbsp;&nbsp;<span class="' + cls(s.farm) + '">' + fd + '</span>'
    out += row('Farm:', fv)
  }
  if (s.stealAttempts > 0) {
    const sd = delta(s.steal)
    let sv = fmt(s.stealSuccesses) + ' / ' + fmt(s.stealAttempts) + ' (' + pct(s.stealSuccesses, s.stealAttempts) + ')'
    if (sd) sv += '&nbsp;&nbsp;<span class="' + cls(s.steal) + '">' + sd + '</span>'
    out += row('Steal:', sv)
  }
  if (s.rankups > 0) out += row('Rank Ups:', fmt(s.rankups), 'cyan')
  if (s.prestiges > 0) out += row('Prestiges:', fmt(s.prestiges), 'cyan')
  const total = s.farm + s.steal
  if (total !== 0) out += row('Total:', delta(total), cls(total))
  return out || row('', '&mdash;', 'dim')
}
function dur(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  if (h > 0) return h + 'h ' + m + 'm'
  if (m > 0) return m + 'm ' + s + 's'
  return s + 's'
}
async function refresh() {
  try {
    const d = await fetch('/stats').then(r => r.json())
    const p = d.player
    document.getElementById('root').innerHTML =
      row('User:', esc(p.username) || '&mdash;', 'yellow') +
      row('Potatoes:', fmt(p.potatoes), p.potatoes < 0 ? 'red' : 'green') +
      row('Prestige:', fmt(p.prestige)) +
      row('Farm:', esc(p.farmSize) || '&mdash;') +
      row('Rank:', '#' + fmt(p.leaderboardRank) + ' / ' + fmt(p.totalPlayers)) +
      row('Harvests:', fmt(p.harvests)) +
      row('Steals:', fmt(p.steals)) +
      row('Stolen From:', fmt(p.stolenFrom)) +
      sec('Session &nbsp; ' + dur(d.session.elapsedMs)) +
      statRows(d.session) +
      sec('Today') +
      statRows(d.today) +
      sec('Last 7 Days') +
      statRows(d.week) +
      sec('All Time') +
      statRows(d.allTime) +
      '<div class="bt">' +
      row('Last Command:', esc(p.lastCommand) || '&mdash;', 'yellow') +
      '</div>'
    document.getElementById('foot').textContent = 'updated ' + new Date().toLocaleTimeString()
  } catch(e) {
    document.getElementById('foot').textContent = 'error: ' + String(e)
  }
}
refresh()
setInterval(refresh, 1000)
</script>
</body>
</html>`;

const HTML_BUF = Buffer.from(HTML);
const HTML_HEADERS: OutgoingHttpHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Length": HTML_BUF.length,
};

export function startServer(): Server {
  const server = createServer((req, res) => {
    const url = req.url ?? "/";

    if (req.method === "GET" && url === "/") {
      res.writeHead(200, HTML_HEADERS);
      res.end(HTML_BUF);
      return;
    }

    if (req.method === "GET" && url === "/stats") {
      const body = JSON.stringify({
        player: playerInfo,
        session: { elapsedMs: Date.now() - sessionStart, ...sessionTotals },
        today: cache.today,
        week: cache.week,
        allTime: cache.totals,
      });
      res.writeHead(200, JSON_HEADERS);
      res.end(body);
      return;
    }

    res.writeHead(404, JSON_HEADERS);
    res.end('{"error":"not found"}');
  });

  server.on("error", (err: Error) => {
    process.stderr.write(`http server error: ${String(err)}\n`);
  });

  server.listen(WEB_PORT);
  return server;
}
