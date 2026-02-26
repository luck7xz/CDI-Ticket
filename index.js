const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder
} = require('discord.js');

const {
  handleOpcoes,
  handleModals,
  handleSelOp,
  menuPrincipal,
  menuConfig,
  menuOpcoes,
  montarEmbed
} = require('./handlers');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CARGO = '1474839295989780622';
const paineis = new Map();
const tickets = new Map();
const contadores = new Map();
const sessoes = new Map();

function temPerm(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.roles.cache.has(CARGO)) return true;
  return false;
}

function getPaineis(gid) {
  if (!paineis.has(gid)) paineis.set(gid, new Map());
  return paineis.get(gid);
}

function getNum(gid) {
  const n = (contadores.get(gid) || 0) + 1;
  contadores.set(gid, n);
  return String(n).padStart(4, '0');
}

function novaSessao() {
  return {
    titulo: 'Suporte',
    descricao: 'Selecione uma opcao para abrir seu ticket.',
    cor: '#2b2d31',
    autor: null,
    imagem: null,
    thumbnail: null,
    rodape: null,
    mensagem: 'Selecione o tipo de atendimento:',
    opcoes: [],
    categoriaId: null,
    logsId: null,
    cargoId: null
  };
}

function montarSelect(s, pid) {
  if (!s.opcoes || !s.opcoes.length) return null;
  const opts = s.opcoes.map(function(op, i) {
    const o = { label: op.label, value: String(i) };
    if (op.desc) o.description = op.desc;
    if (op.emoji) o.emoji = op.emoji;
    return o;
  });
  const sel = new StringSelectMenuBuilder()
    .setCustomId('abrir_' + pid)
    .setPlaceholder(s.mensagem)
    .addOptions(opts);
  return new ActionRowBuilder().addComponents(sel);
}

async function gerarTranscript(channel, td) {
  let msgs = [];
  try {
    const f = await channel.messages.fetch({ limit: 100 });
    msgs = Array.from(f.values()).reverse();
  } catch (_) {}
  const linhas = msgs.map(function(m) {
    const t = new Date(m.createdTimestamp).toLocaleString('pt-BR');
    const c = (m.content || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return '<div class="m"><span class="t">' + t
      + '</span> <span class="a">' + m.author.tag
      + '</span>: ' + c + '</div>';
  }).join('\n');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<title>Transcript</title><style>'
    + 'body{background:#36393f;color:#dcddde;font-family:sans-serif;padding:20px}'
    + 'h1{color:#fff}.info{background:#2f3136;padding:10px;border-radius:8px;margin-bottom:20px}'
    + '.m{padding:4px 0;border-bottom:1px solid #2f3136;font-size:14px}'
    + '.t{color:#72767d;font-size:12px}.a{font-weight:bold;color:#7289da}'
    + '</style></head><body><h1>Transcript</h1>'
    + '<div class="info">'
    + '<b>Canal:</b> #' + channel.name + '<br>'
    + '<b>Aberto por:</b> ' + (td.abrirPor || '?') + '<br>'
    + '<b>Tipo:</b> ' + (td.tipo || 'Geral') + '<br>'
    + '<b>Fechado:</b> ' + new Date().toLocaleString('pt-BR')
    + '</div>' + linhas + '</body></html>';
}

client.once(Events.ClientReady, async function(c) {
  console.log('Online: ' + c.user.tag);
  const cmds = [
    new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('Gerencia paineis de ticket')
  ].map(function(x) { return x.toJSON(); });
  try {
    await new REST({ version: '10' })
      .setToken(process.env.TOKEN)
      .put(Routes.applicationCommands(c.user.id), { body: cmds });
    console.log('Comandos registrados.');
  } catch (e) {
    console.error(e);
  }
});

client.on(Events.InteractionCreate, async function(i) {

  if (i.isChatInputCommand() && i.commandName === 'ticket') {
    if (!temPerm(i.member)) {
      return i.reply({ content: 'Sem permissao!', ephemeral: true });
    }
    return i.reply({
      content: '## Gerenciador de Tickets',
      components: [menuPrincipal()],
      ephemeral: true
    });
  }

  if (i.isButton() && i.customId.startsWith('fechar_')) {
    const chId = i.channel.id;
    const td = tickets.get(chId);
    const podeFechar = temPerm(i.member) || (td && i.user.id === td.abrirPorId);
    if (!podeFechar) {
      return i.reply({ content: 'Sem permissao.', ephemeral: true });
    }
    await i.reply({ content: 'Fechando ticket...' });
    try {
      const html = await gerarTranscript(i.channel, td || {});
      const buf = Buffer.from(html, 'utf-8');
      const nome = 'transcript-' + i.channel.name + '.html';
      const att = new AttachmentBuilder(buf, { name: nome });
      if (td && td.logsId) {
        const lch = i.guild.channels.cache.get(td.logsId);
        if (lch) {
          const le = new EmbedBuilder()
            .setTitle('Ticket Fechado').setColor('#ff4444')
            .addFields(
              { name: 'Canal', value: '#' + i.channel.name, inline: true },
              { name: 'Aberto por', value: td.abrirPor || '?', inline: true },
              { name: 'Tipo', value: td.tipo || 'Geral', inline: true },
              { name: 'Fechado por', value: i.user.tag, inline: true }
            ).setTimestamp();
          await lch.send({ embeds: [le], files: [att] });
        }
      }
      tickets.delete(chId);
      await i.channel.delete();
    } catch (e) { console.error(e); }
    return;
  }

  if (!i.isStringSelectMenu() && !i.isModalSubmit()) return;

  if (i.isModalSubmit()) return handleModals(i, sessoes);

  if (i.customId.startsWith('abrir_')) {
    const pid = i.customId.replace('abrir_', '');
    const painel = getPaineis(i.guild.id).get(pid);
    if (!painel) {
      return i.reply({ content: 'Painel nao encontrado.', ephemeral: true });
    }
    const jaAberto = Array.from(tickets.values()).find(function(t) {
      return t.abrirPorId === i.user.id && t.guildId === i.guild.id;
    });
    if (jaAberto) {
      return i.reply({
        content: 'Voce ja tem um ticket! <#' + jaAberto.channelId + '>',
        ephemeral: true
      });
    }
    await i.deferReply({ ephemeral: true });
    try {
      const opcao = painel.opcoes[parseInt(i.values[0])];
      const num = getNum(i.guild.id);
      const nome = i.user.username.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + num;
      const perms = [
        { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: i.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ];
      if (painel.cargoId) {
        perms.push({
          id: painel.cargoId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }
      const copts = {
        name: nome,
        type: ChannelType.GuildText,
        permissionOverwrites: perms
      };
      if (painel.categoriaId) copts.parent = painel.categoriaId;
      const ch = await i.guild.channels.create(copts);
      let desc = 'Ola ' + i.user.toString() + '!\n';
      desc += 'Aguarde a equipe responsavel lhe atender.';
      if (painel.cargoId) desc += '\n\n<@&' + painel.cargoId + '>';
      const te = new EmbedBuilder()
        .setTitle('Ticket #' + num + ' - ' + (opcao ? opcao.label : 'Suporte'))
        .setDescription(desc)
        .setFooter({ text: 'Aberto por ' + i.user.tag })
        .setTimestamp();
      try { if (painel.cor) te.setColor(painel.cor); } catch (_) {}
      const fb = new ButtonBuilder()
        .setCustomId('fechar_' + ch.id)
        .setLabel('Fechar Ticket')
        .setStyle(ButtonStyle.Danger);
      await ch.send({
        embeds: [te],
        components: [new ActionRowBuilder().addComponents(fb)]
      });
      tickets.set(ch.id, {
        channelId: ch.id,
        guildId: i.guild.id,
        abrirPorId: i.user.id,
        abrirPor: i.user.tag,
        tipo: opcao ? opcao.label : 'Geral',
        logsId: painel.logsId
      });
      return i.editReply({ content: 'Ticket aberto! ' + ch.toString() });
    } catch (e) {
      console.error(e);
      return i.editReply({ content: 'Erro ao criar ticket.' });
    }
  }

  if (i.customId === 't_principal') {
    const v = i.values[0];
    const gp = getPaineis(i.guild.id);
    if (v === 'criar') {
      const s = novaSessao();
      sessoes.set(i.user.id, { s: s, id: null });
      return i.update({
        content: '## Criando Painel',
        embeds: [montarEmbed(s)],
        components: [menuConfig()]
      });
    }
    if (v === 'editar' || v === 'excluir') {
      if (gp.size === 0) {
        return i.reply({ content: 'Nenhum painel salvo.', ephemeral: true });
      }
      const opts = Array.from(gp.entries()).map(function(e) {
        return { label: e[1].titulo || 'Sem titulo', value: e[0] };
      });
      const cid = v === 'editar' ? 't_sel_editar' : 't_sel_excluir';
      const sel = new StringSelectMenuBuilder()
        .setCustomId(cid).setPlaceholder('Selecione o painel').addOptions(opts);
      return i.update({
        content: v === 'editar' ? '## Editar' : '## Excluir',
        embeds: [],
        components: [new ActionRowBuilder().addComponents(sel)]
      });
    }
  }

  if (i.customId === 't_sel_editar') {
    const p = getPaineis(i.guild.id).get(i.values[0]);
    if (!p) return i.reply({ content: 'Nao encontrado.', ephemeral: true });
    sessoes.set(i.user.id, {
      s: Object.assign({}, p, { opcoes: p.opcoes.slice() }),
      id: i.values[0]
    });
    return i.update({
      content: '## Editando: ' + (p.titulo || '?'),
      embeds: [montarEmbed(p)],
      components: [menuConfig()]
    });
  }

  if (i.customId === 't_sel_excluir') {
    const gp = getPaineis(i.guild.id);
    const p = gp.get(i.values[0]);
    if (!p) return i.reply({ content: 'Nao encontrado.', ephemeral: true });
    gp.delete(i.values[0]);
    return i.update({ content: 'Painel excluido!', embeds: [], components: [menuPrincipal()] });
  }

  if (i.customId === 't_config') {
    const v = i.values[0];
    const d = sessoes.get(i.user.id);
    if (!d) return i.reply({ content: 'Sessao expirada.', ephemeral: true });
    if (v === 'cancelar') {
      sessoes.delete(i.user.id);
      return i.update({ content: 'Cancelado.', embeds: [], components: [menuPrincipal()] });
    }
    if (v === 'opcoes') {
      return i.update({ content: '## Opcoes', components: [menuOpcoes()] });
    }
    if (v === 'salvar') {
      const gp = getPaineis(i.guild.id);
      const pid = d.id || ('p_' + Date.now());
      gp.set(pid, Object.assign({}, d.s));
      sessoes.delete(i.user.id);
      return i.update({ content: 'Painel salvo!', embeds: [], components: [menuPrincipal()] });
    }
    if (v === 'enviar') {
      if (!d.s.opcoes.length) {
        return i.reply({ content: 'Adicione opcoes antes de enviar.', ephemeral: true });
      }
      const gp = getPaineis(i.guild.id);
      const pid = d.id || ('p_' + Date.now());
      gp.set(pid, Object.assign({}, d.s));
      const sel = montarSelect(d.s, pid);
      try {
        await i.channel.send({
          embeds: [montarEmbed(d.s)],
          components: sel ? [sel] : []
        });
        sessoes.delete(i.user.id);
        return i.update({ content: 'Enviado!', embeds: [], components: [menuPrincipal()] });
      } catch (e) {
        return i.reply({ content: 'Erro ao enviar.', ephemeral: true });
      }
    }
    if (v === 'geral') {
      const i1 = new TextInputBuilder()
        .setCustomId('cat').setLabel('ID da Categoria')
        .setStyle(TextInputStyle.Short).setRequired(false)
        .setValue(d.s.categoriaId || '');
      const i2 = new TextInputBuilder()
        .setCustomId('log').setLabel('ID Canal de Logs')
        .setStyle(TextInputStyle.Short).setRequired(false)
        .setValue(d.s.logsId || '');
      const i3 = new TextInputBuilder()
        .setCustomId('cargo').setLabel('ID do Cargo marcado')
        .setStyle(TextInputStyle.Short).setRequired(false)
        .setValue(d.s.cargoId || '');
      const modal = new ModalBuilder()
        .setCustomId('m_geral').setTitle('Config Gerais')
        .addComponents(
          new ActionRowBuilder().addComponents(i1),
          new ActionRowBuilder().addComponents(i2),
          new ActionRowBuilder().addComponents(i3)
        );
      return i.showModal(modal);
    }
    const lbls = {
      titulo: 'Titulo', descricao: 'Descricao', cor: 'Cor (#hex)',
      autor: 'Autor', imagem: 'Imagem URL', thumbnail: 'Thumbnail URL', rodape: 'Rodape'
    };
    const lbl = lbls[v] || v;
    const inp = new TextInputBuilder()
      .setCustomId('val').setLabel(lbl)
      .setStyle(v === 'descricao' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(false).setValue(d.s[v] || '');
    const modal = new ModalBuilder()
      .setCustomId('m_campo_' + v).setTitle(lbl)
      .addComponents(new ActionRowBuilder().addComponents(inp));
    return i.showModal(modal);
  }

  if (i.customId === 't_opcoes') return handleOpcoes(i, sessoes);
  if (i.customId === 't_sel_op_ed') return handleSelOp(i, sessoes);
  if (i.customId === 't_sel_op_rm') return handleSelOp(i, sessoes);
});

client.login(process.env.TOKEN);
