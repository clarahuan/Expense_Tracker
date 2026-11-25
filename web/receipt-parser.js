/* Pure receipt parsing: shared by the browser and Node regression tests. */
(function (root) {
  'use strict';
  const rules = {
    '餐饮': /餐|咖啡|奶茶|外卖|美团|饿了么|麦当劳|肯德基/,
    '交通': /地铁|公交|打车|滴滴|车票|铁路|加油/,
    '购物': /淘宝|京东|拼多多|超市|商场/,
    '居住': /房租|水费|电费|燃气|物业/,
    '娱乐': /电影|游戏|会员|影院/,
    '健康': /医院|药店|诊所/,
    '学习': /书店|课程|学费/
  };
  const pad = n => String(n).padStart(2, '0');
  const summary = /总计|合计|共计|总支出|总收入|本月支出|本月收入|月支出|月收入|收入合计|支出合计|余额|优惠|原价|手续费|服务费|实收|本月消费/;
  const excluded = /退款|退回|收入|转账|充值|交易关闭|已关闭|支付失败|已撤销/;
  const fullDate = /(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})日?/;
  const shortDate = /(?:^|[^\d])(\d{1,2})[月/-](\d{1,2})(?:日|(?=\s|$|\d{1,2}:))/;
  const clock = /(?:^|[^\d])(\d{1,2}):(\d{2})(?::\d{2})?/;

  function dateParts(text, year, reference) {
    let m = text.match(fullDate), inferred = false;
    if (m) return { date: `${m[1]}-${pad(m[2])}-${pad(m[3])}`, inferred };
    m = text.match(shortDate);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= 31 && !/^[-+¥￥]?\d+\.\d{2}$/.test(text.trim())) return { date: `${year}-${pad(m[1])}-${pad(m[2])}`, inferred: true };
    if (/今天|昨天|前天/.test(text)) {
      const d = new Date(reference + 'T12:00:00');
      d.setDate(d.getDate() - (/前天/.test(text) ? 2 : /昨天/.test(text) ? 1 : 0));
      return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, inferred: true };
    }
    return null;
  }

  function amountIn(line) {
    if (summary.test(line)) return null;
    const clean = line.replace(/[−–—]/g, '-').replace(/，/g, ',');
    const pattern = /(?:[¥￥]\s*([+-]?)\s*|([+-])\s*[¥￥]?\s*)(\d{1,9}(?:,\d{3})*(?:\.\d{1,2})?)(?![\d.])/g;
    const matches = [...clean.matchAll(pattern)];
    let match = matches.find(m => !(m.index > 0 && /[\d年/月.-]/.test(clean[m.index - 1])));
    // A hyphen inside a date or order number is not a negative payment.
    if (match && match.index > 0 && /[\d年/月.-]/.test(clean[match.index - 1])) match = null;
    if (match) return { amount: match[3].replace(/,/g, ''), positive: (match[1] || match[2]) === '+', raw: match[0], charIndex: match.index };
    const labeled = clean.match(/(?:实付金额|付款金额|支付金额|支出金额|实付款|金额)[：:]?\s*(\d+(?:\.\d{1,2})?)/);
    if (labeled) return { amount: labeled[1], positive: false, raw: labeled[0], charIndex: labeled.index };
    const standalone = clean.match(/^\s*(\d{1,9}\.\d{2})\s*(?:元)?\s*$/);
    if (standalone) return { amount: standalone[1], positive: false, raw: standalone[0], charIndex: 0 };
    return null;
  }

  function merchantText(line, amount) {
    let s = amount ? line.slice(0, amount.charIndex) : line;
    s = s.replace(fullDate, '').replace(shortDate, '').replace(clock, '')
      .replace(/(?:商户全称|商户名称|收款方|收款商户)[：:]?/g, '').trim();
    if (!s || summary.test(s) || /^(?:微信|支付宝|账单|交易记录|交易详情|支付成功|付款成功|支付方式|付款方式|交易时间|付款时间|支付时间|创建时间|订单|交易单号|商户单号|商品|金额|支出|收入|全部|筛选|统计|分类|零钱|银行卡|信用卡|今天|昨天|前天|更多|完成|服务|当前|已退款|退款成功)/.test(s)) return '';
    if (/^[\d\s:年月日/.,+\-]+$/.test(s) || !/[\p{L}]/u.test(s)) return '';
    return s.slice(0, 100);
  }

  function parse(text, options = {}) {
    const reference = options.referenceDate || new Date().toLocaleDateString('sv-SE');
    const defaultYear = String(options.year || reference.slice(0, 4));
    const lines = text.normalize('NFKC').replace(/\r/g, '').split('\n')
      .map(s => s.replace(/[ \t]+/g, ' ').replace(/([\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g, '$1').trim()).filter(Boolean);
    // OCR sometimes separates the currency glyph from the numeric line.
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^[¥￥+-]$/.test(lines[i]) && /^\d+(?:\.\d{1,2})?$/.test(lines[i + 1])) {
        lines[i] += lines[i + 1]; lines.splice(i + 1, 1);
      }
    }
    let year = defaultYear, context = null;
    const contexts = lines.map(line => {
      const heading = line.match(/(20\d{2})年/) || line.match(fullDate);
      if (heading) year = heading[1];
      const date = dateParts(line, year, reference);
      if (date) context = date;
      return { year, date: context };
    });
    const anchors = lines.map((line, index) => ({ index, ...amountIn(line) }))
      .filter(a => a.amount && Number(a.amount) > 0);
    const rows = anchors.map((anchor, n) => {
      const previous = n ? anchors[n - 1].index : -1;
      const next = anchors[n + 1]?.index ?? lines.length;
      let merchant = merchantText(lines[anchor.index], anchor), merchantIndex = anchor.index;
      if (!merchant) {
        for (let i = anchor.index - 1; i > previous; i--) {
          const candidate = merchantText(lines[i]);
          if (candidate) { merchant = candidate; merchantIndex = i; break; }
        }
      }
      if (!merchant && anchors.length === 1) {
        const label = lines.find(line => /商户全称|商户名称|收款方|收款商户/.test(line));
        merchant = label ? merchantText(label) : '';
      }
      // The next merchant starts the next transaction: do not steal its date.
      let end = next;
      for (let i = anchor.index + 1; i < next; i++) {
        if (contexts[anchor.index].date && dateParts(lines[i], contexts[i].year, reference) && !clock.test(lines[i]) && lines[i + 1] && merchantText(lines[i + 1], amountIn(lines[i + 1]))) { end = i; break; }
        if (merchantText(lines[i])) { end = i; break; }
      }
      const before = lines.slice(Math.min(merchantIndex, anchor.index), anchor.index + 1);
      const after = lines.slice(anchor.index + 1, end);
      let date = null, time = null;
      for (const line of (anchors.length === 1 ? lines : [...before, ...after])) {
        date = dateParts(line, contexts[anchor.index].year, reference) || date;
        const t = line.match(clock);
        if (t) time = `${pad(t[1])}:${t[2]}`;
      }
      // Common list layout: merchant / date / amount.
      if (!time) {
        for (let i = anchor.index - 1; i >= merchantIndex; i--) {
          const t = lines[i].match(clock);
          if (t) { time = `${pad(t[1])}:${t[2]}`; break; }
        }
      }
      date = date || contexts[anchor.index].date;
      // A single detail receipt may put its date before its merchant.
      if (!date && anchors.length === 1) {
        const found = lines.map(line => dateParts(line, year, reference)).find(Boolean);
        if (found) date = found;
      }
      const raw = lines.slice(Math.max(previous + 1, merchantIndex), end).join('\n');
      const warnings = [];
      if (!date) warnings.push('未识别到日期，请补全');
      if (date?.inferred) warnings.push('年份或相对日期按参考日期推断，请核对');
      if (!time) warnings.push('未识别到时刻，暂填 00:00，请核对');
      if (!merchant) warnings.push('未识别到商户');
      const nonExpense = anchor.positive || excluded.test(raw);
      if (nonExpense) warnings.push('可能是收入、退款、转账或未完成交易，默认不导入');
      const category = Object.keys(rules).find(c => rules[c].test(merchant)) || '其他';
      return {
        amount: anchor.amount, date: date ? `${date.date}T${time || '00:00'}` : '',
        merchant, category, note: '', included: !nonExpense, warnings, raw,
        source: options.source || '截图', order: n
      };
    });
    return sort(rows);
  }

  function sort(rows) {
    return rows.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.order - b.order);
  }
  const api = { parse, sort };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReceiptParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
