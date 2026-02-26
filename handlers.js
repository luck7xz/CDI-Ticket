const {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder
} = require('discord.js');

function menuConfig() {
  const s = new StringSelectMenuBuilder()
    .setCustomId('t_config')
    .setPlaceholder('Configure o painel')
    .addOptions([
      { label: 'Titulo', value: 'titulo', emoji: '📝' },
      { label: 'Descricao', value: 'descricao', emoji: '📄' },
      { label: 'Cor', value: 'cor', emoji: '🎨' },
      { label: 'Autor', value: 'autor', emoji: '✍️' },
      { label: 'Imagem', value: 'imagem', emoji: '🖼️' },
      { label: 'Thumbnail', value: 'thumbnail', emoji: '🔲' },
      { label: 'Rodape', value: 'rodape', emoji: '📋' },
      { label: 'Config Gerais', value: 'geral', emoji: '🔧' },
      { label: 'Gerenciar Opcoes', value: 'opcoes', emoji: '📌' },
      { label: 'Salvar', value: 'salvar', emoji: '💾' },
      { label: 'Salvar e Enviar', value: 'enviar', emoji: '📤' },
      { label: 'Cancelar', value: 'cancelar', emoji: '❌' }
    ]);
  return new ActionRowBuilder().addComponents(s);
}

function menuOpcoes() {
  const s = new StringSelectMenuBuilder()
    .setCustomId('t_opcoes')
    .setPlaceholder('Gerenciar opcoes')
    .addOptions([
      { label: 'Alterar mensagem', value: 'msg', emoji: '✏️' },
      { label: 'Criar opcao', value: 'criar', emoji: '➕' },
      { label: 'Editar opcao', value: 'editar', emoji: '📝' },
      { label: 'Alterar ordem', value: 'ordem', emoji: '🔃' },
      { label: 'Remover opcao', value: 'remover', emoji: '🗑️' },
      { label: 'Voltar', value: 'voltar', emoji: '🔙' }
    ]);
  return new ActionRowBuilder().addComponents(s);
}

function menuPrincipal() {
  const s = new StringSelectMenuBuilder()
    .setCustomId('t_principal')
    .setPlaceholder('O que deseja fazer?')
    .addOptions([
      { label: 'Criar Painel', value: 'criar', emoji: '➕' },
      { label: 'Editar Painel', value: 'editar', emoji: '✏️' },
      { label: 'Excluir Painel', value: 'excluir', emoji: '🗑️' }
    ]);
  return new ActionRowBuilder().addComponents(s);
}

function montarEmbed(s) {
  const e = new EmbedBuilder();
  if (s.titulo) e.setTitle(s.titulo);
  if (s.descricao) e.setDescription(s.descricao);
  if (s.autor) e.setAuthor({ name: s.autor });
  if (s.imagem) e.setImage(s.imagem);
  if (s.thumbnail) e.setThumbnail(s.thumbnail);
  if (s.rodape) e.setFooter({ text: s.rodape });
  try {
    if (s.cor) e.setColor(s.cor);
  } catch (_) {
    e.setColor('#2b2d31');
  }
  return e;
}

async function handleOpcoes(i, sessoes) {
  const v = i.values[0];
  const d = sessoes.get(i.user.id);
  if (!d) return i.reply({ content: 'Sessao expirada.', ephemeral: true });

  if (v === 'voltar') {
    return i.update({ content: '## Config', embeds: [montarEmbed(d.s)], components: [menuConfig()] });
  }
  if (v === 'msg') {
    const inp = new TextInputBuilder()
      .setCustomId('val').setLabel('Mensagem de selecao')
      .setStyle(TextInputStyle.Short).setRequired(true)
      .setValue(d.s.mensagem || '');
    return i.showModal(
      new ModalBuilder().setCustomId('m_msg').setTitle('Mensagem')
        .addComponents(new ActionRowBuilder().addComponents(inp))
    );
  }
  if (v === 'criar') {
    if (d.s.opcoes.length >= 25) {
      return i.reply({ content: 'Limite de 25 opcoes.', ephemeral: true });
    }
    const il = new TextInputBuilder()
      .setCustomId('lbl').setLabel('Nome')
      .setStyle(TextInputStyle.Short).setRequired(true);
    const id = new TextInputBuilder()
      .setCustomId('desc').setLabel('Descricao (opcional)')
      .setStyle(TextInputStyle.Short).setRequired(false);
    const ie = new TextInputBuilder()
      .setCustomId('emoji').setLabel('Emoji (opcional)')
      .setStyle(TextInputStyle.Short).setRequired(false);
    return i.showModal(
      new ModalBuilder().setCustomId('m_criar_op').setTitle('Criar Opcao')
        .addComponents(
          new ActionRowBuilder().addComponents(il),
          new ActionRowBuilder().addComponents(id),
          new ActionRowBuilder().addComponents(ie)
        )
    );
  }
  if (v === 'editar') {
    if (!d.s.opcoes.length) return i.reply({ content: 'Nenhuma opcao.', ephemeral: true });
    const opts = d.s.opcoes.map(function(o, idx) {
      return { label: o.label, value: String(idx) };
    });
    const sel = new StringSelectMenuBuilder()
      .setCustomId('t_sel_op_ed').setPlaceholder('Qual editar?').addOptions(opts);
    return i.update({ content: 'Selecione:', components: [new ActionRowBuilder().addComponents(sel)] });
  }
  if (v === 'ordem') {
    if (d.s.opcoes.length < 2) return i.reply({ content: 'Precisa 2+ opcoes.', ephemeral: true });
    const lista = d.s.opcoes.map(function(o, idx) { return idx + ':' + o.label; }).join(', ');
    const inp = new TextInputBuilder()
      .setCustomId('val').setLabel('Nova ordem (ex: 2,0,1)')
      .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(lista);
    return i.showModal(
      new ModalBuilder().setCustomId('m_ordem').setTitle('Alterar Ordem')
        .addComponents(new ActionRowBuilder().addComponents(inp))
    );
  }
  if (v === 'remover') {
    if (!d.s.opcoes.length) return i.reply({ content: 'Nenhuma opcao.', ephemeral: true });
    const opts = d.s.opcoes.map(function(o, idx) {
      return { label: o.label, value: String(idx) };
    });
    const sel = new StringSelectMenuBuilder()
      .setCustomId('t_sel_op_rm').setPlaceholder('Qual remover?').addOptions(opts);
    return i.update({ content: 'Selecione:', components: [new ActionRowBuilder().addComponents(sel)] });
  }
}

async function handleModals(i, sessoes) {
  if (i.customId.startsWith('m_campo_')) {
    const campo = i.customId.replace('m_campo_', '');
    const d = sessoes.get(i.user.id);
    if (!d) return i.reply({ content: 'Sessao expirada.', ephemeral: true });
    d.s[campo] = i.fields.getTextInputValue('val') || null;
    sessoes.set(i.user.id, d);
    let prev;
    try { prev = montarEmbed(d.s); } catch (_) {
      return i.reply({ content: 'Valor invalido.', ephemeral: true });
    }
    return i.update({ content: campo + ' atualizado!', embeds: [prev], components: [menuConfig()] });
  }
  if (i.customId === 'm_geral') {
    const d = sessoes.get(i.user.id);
    if (!d) return i.reply({ content: 'Sessao expirada.', ephemeral: true });
    d.s.categoriaId = i.fields.getTextInputValue('cat') || null;
    d.s.logsId = i.fields.getTextInputValue('log') || null;
    d.s.cargoId = i.fields.getTextInputValue('cargo') || null;
    sessoes.set(i.user.id, d);
    return i.update({ content: 'Config gerais salvas!', embeds: [montarEmbed(d.s)], components: [menuConfig()] });
  }
  if (i.customId === 'm_msg') {
    const d = sessoes.get(i.user.id);
    if (!d) return i.reply({ content: 'Sessao expirada.', ephemeral: true });
    d.s.mensagem = i.fields.getTextInputValue('val');
    sessoes.set(i.user.id, d);
    return i.update({ content: 'Mensagem atualizada!', embeds: [montarEmbed(d.s)], components: [menuOpcoes()] });
  }
  if (i.customId === 'm_criar_op') {
    const d = sessoes.get(i.user.id);
    if (!d) return i.reply({ content: 'Sessao expirada.', ephemeral: true });
    d.s.opcoes.push({
      label: i.fields.getTextInputValue('lbl'),
      desc: i.fields.getTextInputValue('desc') || null,
      emoji: i.fields.getTextInputValue('emoji') || null
    });
    sessoes.set(i.user.id, d);
    return i.update({
      content: 'Opcao criada! (' + d.s.opcoes.length + ')',
      embeds: [montarEmbed(d.s)],
      components: [menuOpcoes()]
    });
  }
  if (i.customId === 'm_editar_op') {
    const d = sessoes.get(i.user.id);
    if (!d) return i.reply({ content: 'Sessao expirada.', ephemeral: true });
    d.s.opcoes[d.editIdx] = {
      label: i.fields.getTextInputValue('lbl'),
      desc: i.fields.getTextInputValue('desc') || null,
      emoji: i.fields.getTextInputValue('emoji') || null
    };
    sessoes.set(i.user.id, d);
    return i.update({ content: 'Opcao editada!', embeds: [montarEmbed(d.s)], components: [menuOpcoes()] });
  }
  if (i.customId === 'm_ordem') {
    const d = sessoes.get(i.user.id);
    if (!d) return i.reply({ content: 'Sessao expirada.', ephemeral: true });
    const ids = i.fields.getTextInputValue('val')
      .split(',').map(function(x) { return parseInt(x.trim()); });
    const ops = d.s.opcoes;
    const ok = ids.length === ops.length
      && ids.every(function(x) { return !isNaN(x) && x >= 0 && x < ops.length; });
    if (!ok) return i.reply({ content: 'Ordem invalida.', ephemeral: true });
    d.s.opcoes = ids.map(function(x) { return ops[x]; });
    sessoes.set(i.user.id, d);
    return i.update({ content: 'Ordem atualizada!', embeds: [montarEmbed(d.s)], components: [menuOpcoes()] });
  }
}

async function handleSelOp(i, sessoes) {
  if (i.customId === 't_sel_op_ed') {
    const d = sessoes.get(i.user.id);
    if (!d) return i.reply({ content: 'Sessao expirada.', ephemeral: true });
    const idx = parseInt(i.values[0]);
    const op = d.s.opcoes[idx];
    d.editIdx = idx;
    sessoes.set(i.user.id, d);
    const il = new TextInputBuilder()
      .setCustomId('lbl').setLabel('Nome')
      .setStyle(TextInputStyle.Short).setRequired(true).setValue(op.label || '');
    const id = new TextInputBuilder()
      .setCustomId('desc').setLabel('Descricao')
      .setStyle(TextInputStyle.Short).setRequired(false).setValue(op.desc || '');
    const ie = new TextInputBuilder()
      .setCustomId('emoji').setLabel('Emoji')
      .setStyle(TextInputStyle.Short).setRequired(false).setValue(op.emoji || '');
    return i.showModal(
      new ModalBuilder().setCustomId('m_editar_op').setTitle('Editar Opcao')
        .addComponents(
          new ActionRowBuilder().addComponents(il),
          new ActionRowBuilder().addComponents(id),
          new ActionRowBuilder().addComponents(ie)
        )
    );
  }
  if (i.customId === 't_sel_op_rm') {
    const d = sessoes.get(i.user.id);
    if (!d) return i.reply({ content: 'Sessao expirada.', ephemeral: true });
    const rem = d.s.opcoes.splice(parseInt(i.values[0]), 1)[0];
    sessoes.set(i.user.id, d);
    return i.update({
      content: '"' + rem.label + '" removida.',
      embeds: [montarEmbed(d.s)],
      components: [menuOpcoes()]
    });
  }
}

module.exports = { handleOpcoes, handleModals, handleSelOp, menuPrincipal, menuConfig, menuOpcoes, montarEmbed }
