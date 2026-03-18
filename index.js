const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = '$';
const ADMINS = ['1280969207042801755', '1457424883645550815'];

// guildId -> userId -> { carteira, banco }
const economia = new Map();
// cooldowns: userId -> { trabalho, roubo, preso }
const cooldowns = new Map();

// Config global (admins podem editar)
const config = {
  chanceRoubo: 45,        // % de chance de roubo dar certo
  multTrabalhoMin: 50,
  multTrabalhoMax: 200,
  multRouboMin: 10,
  multRouboMax: 50,
  cdTrabalho: 30,         // minutos
  cdRoubo: 60,            // minutos
  cdPreso: 10,            // minutos preso se falhar roubo
  salarioInicial: 100
};

function getSaldo(gid, uid) {
  if (!economia.has(gid)) economia.set(gid, new Map());
  const g = economia.get(gid);
  if (!g.has(uid)) g.set(uid, { carteira: 0, banco: 0 });
  return g.get(uid);
}

function setSaldo(gid, uid, dados) {
  if (!economia.has(gid)) economia.set(gid, new Map());
  economia.get(gid).set(uid, dados);
}

function getCd(uid) {
  if (!cooldowns.has(uid)) cooldowns.set(uid, {});
  return cooldowns.get(uid);
}

function temCd(uid, tipo) {
  const cd = getCd(uid);
  if (!cd[tipo]) return 0;
  const restante = cd[tipo] - Date.now();
  return restante > 0 ? restante : 0;
}

function setCd(uid, tipo, minutos) {
  const cd = getCd(uid);
  cd[tipo] = Date.now() + minutos * 60 * 1000;
}

function formatMs(ms) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  if (min > 0) return min + 'm ' + sec + 's';
  return sec + 's';
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isAdmin(uid) {
  return ADMINS.includes(uid);
}

function embedBase(titulo, cor) {
  return new EmbedBuilder().setTitle(titulo).setColor(cor || '#2b2d31').setTimestamp();
}

client.once('ready', function(c) {
  console.log('Online: ' + c.user.tag);
});

client.on('messageCreate', async function(msg) {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;
  if (!msg.guild) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const gid = msg.guild.id;
  const uid = msg.author.id;

  // SALDO
  if (cmd === 'saldo' || cmd === 'bal') {
    const alvo = msg.mentions.users.first();
    const tid = alvo ? alvo.id : uid;
    const tnome = alvo ? alvo.username : msg.author.username;
    const s = getSaldo(gid, tid);
    const e = embedBase('💰 Saldo de ' + tnome, '#f1c40f');
    e.addFields(
      { name: '👛 Carteira', value: '🪙 ' + s.carteira, inline: true },
      { name: '🏦 Banco', value: '🪙 ' + s.banco, inline: true },
      { name: '💎 Total', value: '🪙 ' + (s.carteira + s.banco), inline: true }
    );
    return msg.reply({ embeds: [e] });
  }

  // DEPOSITAR
  if (cmd === 'dep' || cmd === 'depositar') {
    const s = getSaldo(gid, uid);
    const qtd = args[0] === 'tudo' ? s.carteira : parseInt(args[0]);
    if (!qtd || qtd <= 0) return msg.reply('Use: `$dep <valor>` ou `$dep tudo`');
    if (qtd > s.carteira) return msg.reply('Você não tem esse valor na carteira!');
    s.carteira -= qtd;
    s.banco += qtd;
    setSaldo(gid, uid, s);
    const e = embedBase('🏦 Depósito', '#2ecc71');
    e.setDescription('Depositado **🪙 ' + qtd + '** no banco!\nSaldo banco: 🪙 ' + s.banco);
    return msg.reply({ embeds: [e] });
  }

  // SACAR
  if (cmd === 'sac' || cmd === 'sacar') {
    const s = getSaldo(gid, uid);
    const qtd = args[0] === 'tudo' ? s.banco : parseInt(args[0]);
    if (!qtd || qtd <= 0) return msg.reply('Use: `$sac <valor>` ou `$sac tudo`');
    if (qtd > s.banco) return msg.reply('Você não tem esse valor no banco!');
    s.banco -= qtd;
    s.carteira += qtd;
    setSaldo(gid, uid, s);
    const e = embedBase('💵 Saque', '#2ecc71');
    e.setDescription('Sacado **🪙 ' + qtd + '** do banco!\nSaldo carteira: 🪙 ' + s.carteira);
    return msg.reply({ embeds: [e] });
  }

  // TRANSFERIR
  if (cmd === 'pagar' || cmd === 'pay') {
    const alvo = msg.mentions.members.first();
    if (!alvo) return msg.reply('Use: `$pagar @user <valor>`');
    const qtd = parseInt(args[1]);
    if (!qtd || qtd <= 0) return msg.reply('Valor inválido!');
    const s = getSaldo(gid, uid);
    if (qtd > s.carteira) return msg.reply('Sem saldo na carteira!');
    const sa = getSaldo(gid, alvo.id);
    s.carteira -= qtd;
    sa.carteira += qtd;
    setSaldo(gid, uid, s);
    setSaldo(gid, alvo.id, sa);
    const e = embedBase('💸 Transferência', '#3498db');
    e.setDescription('Você enviou **🪙 ' + qtd + '** para ' + alvo.toString());
    return msg.reply({ embeds: [e] });
  }

  // TRABALHAR
  if (cmd === 'trabalhar' || cmd === 'work') {
    const restante = temCd(uid, 'trabalho');
    if (restante > 0) {
      return msg.reply('⏳ Aguarde **' + formatMs(restante) + '** para trabalhar novamente!');
    }
    if (temCd(uid, 'preso') > 0) {
      return msg.reply('🔒 Você está preso! Aguarde **' + formatMs(temCd(uid, 'preso')) + '**');
    }
    const ganho = rand(config.multTrabalhoMin, config.multTrabalhoMax);
    const s = getSaldo(gid, uid);
    s.carteira += ganho;
    setSaldo(gid, uid, s);
    setCd(uid, 'trabalho', config.cdTrabalho);
    const trabalhos = [
      'Você fez hora extra na fábrica',
      'Você deu aula de reforço',
      'Você entregou pizzas',
      'Você lavou carros',
      'Você fez bico de motorista',
      'Você vendeu salgados',
      'Você trabalhou no mercado'
    ];
    const t = trabalhos[rand(0, trabalhos.length - 1)];
    const e = embedBase('💼 Trabalho', '#2ecc71');
    e.setDescription(t + ' e ganhou **🪙 ' + ganho + '**!\nCarteira: 🪙 ' + s.carteira);
    return msg.reply({ embeds: [e] });
  }

  // ROUBAR
  if (cmd === 'roubar' || cmd === 'rob') {
    const alvo = msg.mentions.members.first();
    if (!alvo) return msg.reply('Use: `$roubar @user`');
    if (alvo.id === uid) return msg.reply('Você não pode se roubar!');
    const restante = temCd(uid, 'roubo');
    if (restante > 0) return msg.reply('⏳ Aguarde **' + formatMs(restante) + '** para roubar!');
    const presoCd = temCd(uid, 'preso');
    if (presoCd > 0) return msg.reply('🔒 Você está preso! Aguarde **' + formatMs(presoCd) + '**');
    const salvo = getSaldo(gid, alvo.id);
    if (salvo.carteira <= 0) return msg.reply('Essa pessoa não tem dinheiro na carteira!');
    const sucesso = rand(1, 100) <= config.chanceRoubo;
    setCd(uid, 'roubo', config.cdRoubo);
    if (sucesso) {
      const pct = rand(config.multRouboMin, config.multRouboMax);
      const qtd = Math.max(1, Math.floor(salvo.carteira * pct / 100));
      const sr = getSaldo(gid, uid);
      salvo.carteira -= qtd;
      sr.carteira += qtd;
      setSaldo(gid, alvo.id, salvo);
      setSaldo(gid, uid, sr);
      const e = embedBase('🦹 Roubo bem-sucedido!', '#e74c3c');
      e.setDescription('Você roubou **🪙 ' + qtd + '** de ' + alvo.toString() + '!');
      return msg.reply({ embeds: [e] });
    } else {
      setCd(uid, 'preso', config.cdPreso);
      const multa = Math.min(rand(20, 80), getSaldo(gid, uid).carteira);
      const sm = getSaldo(gid, uid);
      sm.carteira -= multa;
      setSaldo(gid, uid, sm);
      const e = embedBase('🚔 Você foi preso!', '#95a5a6');
      const msg_preso = 'Você tentou roubar ' + alvo.toString() + ' mas foi pego!';
      const msg_multa = 'Pagou **🪙 ' + multa + '** de multa e ficará preso por **' + config.cdPreso + ' min**.';
      e.setDescription(msg_preso + '\n' + msg_multa);
      return msg.reply({ embeds: [e] });
    }
  }

  // CARA OU COROA
  if (cmd === 'coc' || cmd === 'coin') {
    const s = getSaldo(gid, uid);
    const qtd = args[1] === 'tudo' ? s.carteira : parseInt(args[1]);
    const escolha = args[0] ? args[0].toLowerCase() : null;
    if (!escolha || !['cara', 'coroa'].includes(escolha)) {
      return msg.reply('Use: `$coc <cara/coroa> <valor>`');
    }
    if (!qtd || qtd <= 0) return msg.reply('Valor inválido!');
    if (qtd > s.carteira) return msg.reply('Sem saldo na carteira!');
    const resultado = rand(0, 1) === 0 ? 'cara' : 'coroa';
    const ganhou = resultado === escolha;
    if (ganhou) { s.carteira += qtd; } else { s.carteira -= qtd; }
    setSaldo(gid, uid, s);
    const e = embedBase('🪙 Cara ou Coroa', ganhou ? '#2ecc71' : '#e74c3c');
    e.addFields(
      { name: 'Resultado', value: resultado === 'cara' ? '👆 Cara' : '👇 Coroa', inline: true },
      { name: 'Você escolheu', value: escolha === 'cara' ? '👆 Cara' : '👇 Coroa', inline: true },
      { name: ganhou ? '✅ Ganhou!' : '❌ Perdeu!', value: '🪙 ' + (ganhou ? '+' : '-') + qtd, inline: true }
    );
    e.setFooter({ text: 'Carteira: 🪙 ' + s.carteira });
    return msg.reply({ embeds: [e] });
  }

  // DADO
  if (cmd === 'dado' || cmd === 'dice') {
    const s = getSaldo(gid, uid);
    const qtd = args[0] === 'tudo' ? s.carteira : parseInt(args[0]);
    if (!qtd || qtd <= 0) return msg.reply('Use: `$dado <valor>`');
    if (qtd > s.carteira) return msg.reply('Sem saldo na carteira!');
    const meu = rand(1, 6);
    const bot = rand(1, 6);
    let ganhou = meu > bot;
    let empate = meu === bot;
    if (ganhou) { s.carteira += qtd; }
    else if (!empate) { s.carteira -= qtd; }
    setSaldo(gid, uid, s);
    const e = embedBase('🎲 Jogo de Dado', ganhou ? '#2ecc71' : empate ? '#f1c40f' : '#e74c3c');
    e.addFields(
      { name: 'Seu dado', value: '🎲 ' + meu, inline: true },
      { name: 'Bot', value: '🎲 ' + bot, inline: true },
      { name: empate ? '🤝 Empate!' : ganhou ? '✅ Ganhou!' : '❌ Perdeu!',
        value: empate ? 'Devolvido' : '🪙 ' + (ganhou ? '+' : '-') + qtd, inline: true }
    );
    e.setFooter({ text: 'Carteira: 🪙 ' + s.carteira });
    return msg.reply({ embeds: [e] });
  }

  // BLACKJACK
  if (cmd === 'bj' || cmd === 'blackjack') {
    const s = getSaldo(gid, uid);
    const qtd = args[0] === 'tudo' ? s.carteira : parseInt(args[0]);
    if (!qtd || qtd <= 0) return msg.reply('Use: `$bj <valor>`');
    if (qtd > s.carteira) return msg.reply('Sem saldo na carteira!');
    const cartas = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const naipes = ['♠','♥','♦','♣'];
    function carta() { return cartas[rand(0,12)] + naipes[rand(0,3)]; }
    function valor(c) {
      const v = c.replace(/[♠♥♦♣]/g,'');
      if (['J','Q','K'].includes(v)) return 10;
      if (v === 'A') return 11;
      return parseInt(v);
    }
    function total(mao) {
      let t = mao.reduce(function(a,c){ return a + valor(c); }, 0);
      let ases = mao.filter(function(c){ return c.startsWith('A'); }).length;
      while (t > 21 && ases > 0) { t -= 10; ases--; }
      return t;
    }
    const mjog = [carta(), carta()];
    const mbot = [carta(), carta()];
    const tj = total(mjog);
    let tb = total(mbot);
    while (tb < 17) { mbot.push(carta()); tb = total(mbot); }
    let res;
    if (tj > 21) res = 'perda';
    else if (tb > 21) res = 'ganho';
    else if (tj > tb) res = 'ganho';
    else if (tj === tb) res = 'empate';
    else res = 'perda';
    if (res === 'ganho') s.carteira += qtd;
    else if (res === 'perda') s.carteira -= qtd;
    setSaldo(gid, uid, s);
    const e = embedBase('🃏 Blackjack', res === 'ganho' ? '#2ecc71' : res === 'empate' ? '#f1c40f' : '#e74c3c');
    e.addFields(
      { name: 'Sua mão (' + tj + ')', value: mjog.join(' '), inline: true },
      { name: 'Mão do bot (' + tb + ')', value: mbot.join(' '), inline: true },
      { name: res === 'ganho' ? '✅ Ganhou!' : res === 'empate' ? '🤝 Empate!' : '❌ Perdeu!',
        value: res === 'empate' ? 'Devolvido' : '🪙 ' + (res === 'ganho' ? '+' : '-') + qtd, inline: true }
    );
    e.setFooter({ text: 'Carteira: 🪙 ' + s.carteira });
    return msg.reply({ embeds: [e] });
  }

  // SLOT MACHINE
  if (cmd === 'slot' || cmd === 'slots') {
    const s = getSaldo(gid, uid);
    const qtd = args[0] === 'tudo' ? s.carteira : parseInt(args[0]);
    if (!qtd || qtd <= 0) return msg.reply('Use: `$slot <valor>`');
    if (qtd > s.carteira) return msg.reply('Sem saldo na carteira!');
    const simbolos = ['🍒','🍋','🍊','⭐','💎','7️⃣','🎰'];
    const rodada = [
      simbolos[rand(0,6)], simbolos[rand(0,6)], simbolos[rand(0,6)]
    ];
    let mult = 0;
    if (rodada[0] === rodada[1] && rodada[1] === rodada[2]) {
      if (rodada[0] === '💎') mult = 10;
      else if (rodada[0] === '7️⃣') mult = 7;
      else if (rodada[0] === '⭐') mult = 5;
      else mult = 3;
    } else if (rodada[0] === rodada[1] || rodada[1] === rodada[2] || rodada[0] === rodada[2]) {
      mult = 1.5;
    }
    const ganho = mult > 0 ? Math.floor(qtd * mult) : 0;
    if (ganho > 0) s.carteira += ganho - qtd;
    else s.carteira -= qtd;
    setSaldo(gid, uid, s);
    const ganhou = ganho > 0;
    const e = embedBase('🎰 Slot Machine', ganhou ? '#2ecc71' : '#e74c3c');
    e.setDescription('┃ ' + rodada.join(' ┃ ') + ' ┃');
    if (ganhou) {
      e.addFields({ name: '✅ Ganhou! (x' + mult + ')', value: '🪙 +' + (ganho - qtd) });
    } else {
      e.addFields({ name: '❌ Perdeu!', value: '🪙 -' + qtd });
    }
    e.setFooter({ text: 'Carteira: 🪙 ' + s.carteira });
    return msg.reply({ embeds: [e] });
  }

  // RANKING
  if (cmd === 'top' || cmd === 'ranking') {
    const gmap = economia.get(gid);
    if (!gmap || gmap.size === 0) return msg.reply('Ninguém tem saldo ainda!');
    const lista = Array.from(gmap.entries())
      .map(function(e) { return { id: e[0], total: e[1].carteira + e[1].banco }; })
      .sort(function(a,b) { return b.total - a.total; })
      .slice(0, 10);
    const e = embedBase('🏆 Ranking de Moedas', '#f1c40f');
    const medalhas = ['🥇','🥈','🥉'];
    const desc = lista.map(function(u, i) {
      return (medalhas[i] || (i+1)+'.') + ' <@' + u.id + '> — 🪙 ' + u.total;
    }).join('\n');
    e.setDescription(desc);
    return msg.reply({ embeds: [e] });
  }

  // ADMIN: editar moedas
  if (cmd === 'addmoney' || cmd === 'delmoney' || cmd === 'setmoney') {
    if (!isAdmin(uid)) return;
    const alvo = msg.mentions.members.first();
    if (!alvo) return msg.reply('Use: `$' + cmd + ' @user <valor>`');
    const qtd = parseInt(args[1]);
    if (!qtd) return msg.reply('Valor inválido!');
    const s = getSaldo(gid, alvo.id);
    if (cmd === 'addmoney') s.carteira += qtd;
    else if (cmd === 'delmoney') s.carteira = Math.max(0, s.carteira - qtd);
    else s.carteira = qtd;
    setSaldo(gid, alvo.id, s);
    return msg.reply('✅ Carteira de ' + alvo.toString() + ' atualizada! 🪙 ' + s.carteira);
  }

  // ADMIN: editar config
  if (cmd === 'config') {
    if (!isAdmin(uid)) return;
    const chave = args[0];
    const valor = parseFloat(args[1]);
    if (!chave || isNaN(valor)) {
      const desc = Object.entries(config).map(function(e) {
        return '`' + e[0] + '`: ' + e[1];
      }).join('\n');
      const e = embedBase('⚙️ Configurações', '#3498db');
      e.setDescription(desc);
      e.setFooter({ text: 'Use: $config <chave> <valor>' });
      return msg.reply({ embeds: [e] });
    }
    if (!(chave in config)) return msg.reply('Chave inválida!');
    config[chave] = valor;
    return msg.reply('✅ `' + chave + '` atualizado para `' + valor + '`');
  }

  // AJUDA
  if (cmd === 'ajuda' || cmd === 'help') {
    const e = embedBase('📖 Comandos — Prefixo: $', '#3498db');
    e.addFields(
      { name: '💰 Economia', value: '`$saldo` `$dep` `$sac` `$pagar @user <val>`' },
      { name: '💼 Ganhar', value: '`$trabalhar`' },
      { name: '🦹 Roubo', value: '`$roubar @user`' },
      { name: '🎲 Apostas', value: '`$coc <cara/coroa> <val>`\n`$dado <val>`\n`$bj <val>`\n`$slot <val>`' },
      { name: '🏆 Ranking', value: '`$top`' },
      { name: '⚙️ Admin', value: '`$addmoney` `$delmoney` `$setmoney` `$config`' }
    );
    return msg.reply({ embeds: [e] });
  }
});

client.login(process.env.TOKEN);
