const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BENCH = { 'Itaim Bibi': 22500, 'Vila Nova Conceicao': 26000, 'Jardim Europa': 28000 };
const OUT = path.join(__dirname, 'imoveis.json');
const LOG = path.join(__dirname, 'agente.log');
const CONFIG_FILE = path.join(__dirname, 'config.json');

var CONFIG = {};
if (fs.existsSync(CONFIG_FILE)) {
  try { CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch(e) {}
}

const BAIRROS = [
  { label: 'Itaim Bibi', url_zap: 'https://www.zapimoveis.com.br/venda/imoveis/sp+sao-paulo+zona-sul+itaim-bibi/?tipo=coberturas&preco=0,8000000', url_vr: 'https://www.vivareal.com.br/venda/sp/sao-paulo/zona-sul/itaim-bibi/cobertura_residencial/?preco-ate=8000000' },
  { label: 'Vila Nova Conceicao', url_zap: 'https://www.zapimoveis.com.br/venda/imoveis/sp+sao-paulo+zona-sul+vl-nv-conceicao/?tipo=coberturas&preco=0,8000000', url_vr: 'https://www.vivareal.com.br/venda/sp/sao-paulo/zona-sul/vila-nova-conceicao/cobertura_residencial/?preco-ate=8000000' },
  { label: 'Jardim Europa', url_zap: 'https://www.zapimoveis.com.br/venda/imoveis/sp+sao-paulo+zona-oeste+jd-europa/?tipo=coberturas&preco=0,8000000', url_vr: 'https://www.vivareal.com.br/venda/sp/sao-paulo/zona-oeste/jardim-europa/cobertura_residencial/?preco-ate=8000000' },
];

const SITES_PREMIUM = ['jardins-co.com.br','taylorimoveis.com','poloresidencial.com.br','oneluxo.com.br','ph15.com','lopesprime.com.br','npiconsultoria.com.br','kazaboutique.com.br','uprealestate.com.br','coelhodafonseca.com.br','bnsir.com.br','lpslopes.com.br','kauffmann.com.br','luxuryestate.com'];

function log(msg) {
  const line = '[' + new Date().toLocaleString('pt-BR') + '] ' + msg;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch(e) {}
}
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
function calcScore(preco, area, bairro) {
  const bench = BENCH[bairro] || 22000;
  const m2 = Math.round(preco / area);
  const diff = Math.round((1 - m2 / bench) * 100);
  return { m2: m2, diff: diff, isOpp: m2 < bench * 0.88, score: diff >= 12 ? 'A' : diff >= 5 ? 'B' : 'C' };
}

async function buscarSite(browser, bairro, fonte) {
  const label = bairro.label;
  const url = fonte === 'ZAP' ? bairro.url_zap : bairro.url_vr;
  const base = fonte === 'ZAP' ? 'https://www.zapimoveis.com.br' : 'https://www.vivareal.com.br';
  log('[' + fonte + '] Buscando ' + label + '...');
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });
  const results = [];
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('.typo-body-large', { timeout: 20000 }).catch(function() {});
    await sleep(4000);
    await page.evaluate(function() { window.scrollTo(0, 1500); });
    await sleep(2000);
    await page.evaluate(function() { window.scrollTo(0, 3000); });
    await sleep(2000);
    const raw = await page.evaluate(function(baseUrl) {
      var items = Array.from(document.querySelectorAll('li, article')).filter(function(el) {
        return el.innerText && el.innerText.indexOf('quarto') > -1 && el.innerText.indexOf('R$') > -1;
      });
      return items.map(function(el) {
        var txt = el.innerText || '';
        var priceEl = el.querySelector('.typo-body-large, [class*="price"], [class*="Price"]');
        var aM = txt.match(/(\d+)\s*m/i);
        var qM = txt.match(/(\d+)\s*quarto/i);
        var vM = txt.match(/(\d+)\s*vaga/i);
        var addrEl = el.querySelector('[class*="address"], [class*="Address"], .text-1-75, [class*="location"]');
        var linkEl = el.querySelector('a[href*="/imovel/"]') || el.querySelector('a');
        if (!priceEl) return null;
        var preco = parseInt(priceEl.innerText.replace(/\D/g, ''));
        var link = '';
        if (linkEl) {
          var href = linkEl.getAttribute('href') || '';
          link = href.startsWith('http') ? href.split('?')[0] : baseUrl + href.split('?')[0];
        }
        return { preco: preco, area: aM ? parseInt(aM[1]) : 0, quartos: qM ? parseInt(qM[1]) : 2, vagas: vM ? parseInt(vM[1]) : 0, rua: addrEl ? addrEl.innerText.trim().split('\n')[0] : '', link: link };
      }).filter(function(x) { return x && x.preco > 100000 && x.area > 0; });
    }, base);
    raw.forEach(function(im) {
      if (im.preco > 8000000 || im.area < 200 || im.quartos < 2) return;
      if (!im.link || im.link.length < 10) return;
      if (im.link.indexOf('apartamento') > -1 && im.link.indexOf('cobertura') === -1) return;
      results.push({ addr: im.rua ? im.rua + ', ' + label : label, bairro: label, tipo: 'Cobertura', preco: im.preco, area: im.area, quartos: im.quartos, vagas: im.vagas, link: im.link, fonte: fonte });
    });
    log('[' + fonte + '] ' + label + ': ' + results.length + ' imoveis');
  } catch(err) { log('[' + fonte + '] Erro: ' + err.message); }
  await page.close().catch(function() {});
  return results;
}

async function buscarPremium(browser, site, bairro) {
  log('[Premium] ' + site + ' - ' + bairro);
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });
  const results = [];
  try {
    var q = encodeURIComponent('cobertura venda ' + bairro + ' 200m site:' + site);
    await page.goto('https://www.google.com/search?q=' + q, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1500);
    var links = await page.evaluate(function(s) {
      return Array.from(document.querySelectorAll('a[href]')).map(function(a) { return a.href; }).filter(function(h) { return h.indexOf(s) > -1 && h.indexOf('google') === -1; }).slice(0, 4);
    }, site);
    for (var i = 0; i < links.length; i++) {
      try {
        await page.goto(links[i], { waitUntil: 'domcontentloaded', timeout: 12000 });
        await sleep(1200);
        var dado = await page.evaluate(function(lnk, bl) {
          var txt = document.body.innerText || '';
          var pM = txt.match(/R\$\s*([\d.,]+)\s*(mil(?:hao|hoes)?|M|mi)?/i);
          var aM = txt.match(/(\d+)\s*m[2²]/i);
          var qM = txt.match(/(\d+)\s*quarto/i);
          var vM = txt.match(/(\d+)\s*vaga/i);
          if (!pM) return null;
          var preco = parseFloat(pM[1].replace(/\./g,'').replace(',','.'));
          if (pM[2]) preco = preco * 1000000;
          if (preco < 100000) preco = preco * 1000000;
          if (preco > 8000000 || preco < 500000) return null;
          var area = aM ? parseInt(aM[1]) : 0;
          if (area < 200) return null;
          return { preco: Math.round(preco), area: area, quartos: qM ? parseInt(qM[1]) : 3, vagas: vM ? parseInt(vM[1]) : 2, addr: document.title.slice(0,50) + ', ' + bl, link: lnk };
        }, links[i], bairro);
        if (dado && dado.link && dado.link.length > 10) { dado.bairro = bairro; dado.tipo = 'Cobertura'; dado.fonte = site.replace('www.','').split('.')[0]; results.push(dado); }
      } catch(e) {}
      await sleep(800);
    }
    log('[Premium] ' + site + ': ' + results.length + ' imoveis');
  } catch(err) { log('[Premium] Erro ' + site + ': ' + err.message); }
  await page.close().catch(function() {});
  return results;
}

async function enviarEmail(lista) {
  if (!CONFIG.email_user || !CONFIG.email_pass) { log('Email nao configurado'); return; }
  try {
    var nodemailer = require('nodemailer');
    var t = nodemailer.createTransport({ service: 'gmail', auth: { user: CONFIG.email_user, pass: CONFIG.email_pass } });
    var opps = lista.filter(function(i) { return i.isOpp; });
    var novos = lista.filter(function(i) { return i.novo; });
    var html = '<h2>Radar Imoveis - Resumo Semanal</h2><p><b>' + lista.length + '</b> monitorados | <b>' + opps.length + '</b> oportunidades | <b>' + novos.length + '</b> novos</p><h3>Top Oportunidades:</h3><ul>';
    opps.slice(0,10).forEach(function(im) {
      html += '<li><b>R$ ' + (im.preco/1e6).toFixed(1) + 'M</b> - ' + im.addr + ' | ' + im.area + 'm2 | Score ' + im.score + ' | ' + im.fonte;
      if (im.link) html += ' | <a href="' + im.link + '">Ver anuncio</a>';
      html += '</li>';
    });
    html += '</ul>';
    await t.sendMail({ from: CONFIG.email_user, to: CONFIG.email_dest || CONFIG.email_user, subject: 'Radar Imoveis - ' + opps.length + ' oportunidades | ' + novos.length + ' novos', html: html });
    log('Email enviado para ' + (CONFIG.email_dest || CONFIG.email_user));
  } catch(e) { log('Erro email: ' + e.message); }
}

async function main() {
  var headless = process.argv.indexOf('--visual') === -1 ? 'new' : false;
  log('==== AGENTE v8 - Puppeteer + Sites Premium | headless=' + headless + ' ====');
  var existing = [];
  if (fs.existsSync(OUT)) { try { existing = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch(e) {} log('Existentes: ' + existing.length); }
  var browser = await puppeteer.launch({ headless: headless, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'], defaultViewport: null });
  var novos = [];
  for (var i = 0; i < BAIRROS.length; i++) {
    novos = novos.concat(await buscarSite(browser, BAIRROS[i], 'ZAP')); await sleep(2000);
    novos = novos.concat(await buscarSite(browser, BAIRROS[i], 'VivaReal')); await sleep(2000);
  }
  for (var s = 0; s < SITES_PREMIUM.length; s++) {
    for (var b = 0; b < BAIRROS.length; b++) {
      novos = novos.concat(await buscarPremium(browser, SITES_PREMIUM[s], BAIRROS[b].label));
      await sleep(1000);
    }
  }
  await browser.close();
  log('Total encontrado: ' + novos.length);
  var hoje = new Date().toISOString().slice(0, 10);
  var keys = new Set(existing.map(function(i) { return i.preco + '-' + i.bairro + '-' + i.fonte; }));
  var add = novos.filter(function(im) { return !keys.has(im.preco + '-' + im.bairro + '-' + im.fonte); }).map(function(im) {
    var s = calcScore(im.preco, im.area, im.bairro);
    return Object.assign({ id: Date.now() + Math.random(), novo: true, fav: false, data: hoje }, s, im);
  });
  var lista = add.concat(existing.map(function(i) { return Object.assign({}, i, { novo: i.data === hoje }); }));
  fs.writeFileSync(OUT, JSON.stringify(lista, null, 2));
  log('CONCLUIDO: ' + add.length + ' novos | ' + lista.length + ' total | ' + lista.filter(function(i){return i.isOpp}).length + ' oportunidades');
  await enviarEmail(lista);
}
main().catch(function(err) { log('ERRO FATAL: ' + err.message); process.exit(1); });
