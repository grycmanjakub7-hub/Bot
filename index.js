const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, AttachmentBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => { res.send('Bot Husaria działa 24/7!'); });
app.listen(port, () => { 
  console.log(`[SYSTEM] Serwer HTTP nasłuchuje na porcie ${port}`);
  setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
      axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com`)
        .then(() => console.log('[ANTY-SLEEP] Bot pomyślnie szturchnięty!'))
        .catch((err) => console.log('[ANTY-SLEEP] Błąd pingu: ' + err.message));
    }
  }, 300000);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

// --- CONFIG ID ---
const BYPASS_ROLE_ID = '1512577411315663038';
const TICKET_CHANNEL_ID = '1512574570903900253';
const SUPPORT_ROLE_ID = '1512580895385849998';
const TRANSFER_ALLOWED_ROLE_ID = '1512587126506655774';
const WELCOME_CHANNEL_ID = '1512410099518410782';
const VERIFY_CHANNEL_ID = '1512591912450920558';
const AUTOROLE_ON_JOIN_ID = '1512592026900627487';
const VERIFIED_ROLE_ID = '1512580404974981120';

const userLog = new Map();
const ticketCreators = new Map();
const verificationSessions = new Map();

client.once('ready', async () => {
  console.log(`[SUKCES] Zaawansowany bot Husaria gotowy do akcji!`);
  
  const commands = [
    new SlashCommandBuilder()
      .setName('transfer')
      .setDescription('Ogłoś oficjalny transfer państwa do Husarii')
      .addStringOption(option => option.setName('panstwo').setDescription('Wpisz nazwę państwa').setRequired(true))
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[SYSTEM] Komendy (/) zarejestrowane.');
  } catch (error) { console.error(error); }

  // Panel ticketów
  try {
    const channel = await client.channels.fetch(TICKET_CHANNEL_ID);
    if (channel) {
      const messages = await channel.messages.fetch({ limit: 10 });
      if (messages.filter(m => m.author.id === client.user.id).size === 0) {
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎫 SYSTEM ZGŁOSZEŃ (TICKETS)').setDescription('Potrzebujesz pomocy administracji, chcesz zgłosić fuzję lub sojusz?\nKliknij poniższy przycisk.');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_ticket').setLabel('Stwórz zgłoszenie').setEmoji('📩').setStyle(ButtonStyle.Primary));
        await channel.send({ embeds: [embed], components: [row] });
      }
    }
  } catch (e) { console.log(e); }

  // Panel weryfikacji
  try {
    const vChannel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    if (vChannel) {
      const vMessages = await vChannel.messages.fetch({ limit: 10 });
      if (vMessages.filter(m => m.author.id === client.user.id).size === 0) {
        const vEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🛡️ WERYFIKACJA BEZPIECZEŃSTWA').setDescription('Aby uzyskać pełny dostęp do serwera, kliknij przycisk i rozwiąż proste zadanie.');
        const vRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trigger_verify').setLabel('Zweryfikuj się').setEmoji('✅').setStyle(ButtonStyle.Success));
        await vChannel.send({ embeds: [vEmbed], components: [vRow] });
      }
    }
  } catch (e) { console.log(e); }
});

client.on('guildMemberAdd', async (member) => {
  try {
    const startRole = member.guild.roles.cache.get(AUTOROLE_ON_JOIN_ID);
    if (startRole) await member.roles.add(startRole);

    const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);
    if (channel) {
      const welcomeEmbed = new EmbedBuilder()
        .setColor('#2f3136')
        .setAuthor({ name: `Nowy członek osady!`, iconURL: member.guild.iconURL() })
        .setDescription(`👋 Witaj <@${member.id}> na serwerze **${member.guild.name}**!\nCieszymy się, że do nas dołączasz.`)
        .addFields({ name: '📊 Użytkownik nr:', value: `\`${member.guild.memberCount}\``, inline: true })
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
      await channel.send({ content: `Witaj <@${member.id}>! ⚔️`, embeds: [welcomeEmbed] });
    }
  } catch (error) { console.log(error); }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild) return;

  if (interaction.isButton() && interaction.customId === 'trigger_verify') {
    if (interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
      return interaction.reply({ content: '✅ Jesteś już zweryfikowany!', ephemeral: true });
    }
    const num1 = Math.floor(Math.random() * 9) + 1;
    const num2 = Math.floor(Math.random() * 9) + 1;
    const isPlus = Math.random() > 0.5;
    const correctAnswer = isPlus ? (num1 + num2) : (num1 - num2);
    
    const answers = new Set([correctAnswer]);
    while (answers.size < 4) { answers.add(correctAnswer + (Math.floor(Math.random() * 5) - 2)); }
    const shuffledAnswers = Array.from(answers).sort((a, b) => a - b);
    verificationSessions.set(interaction.user.id, correctAnswer);

    const selectMenu = new StringSelectMenuBuilder().setCustomId('submit_verify_answer').setPlaceholder('Wybierz wynik...');
    shuffledAnswers.forEach(ans => { selectMenu.addOptions({ label: `Wynik: ${ans}`, value: ans.toString() }); });

    await interaction.reply({ content: `🔒 **Zadanie:** Ile to jest: **${num1} ${isPlus ? '+' : '-'} ${num2}**?`, components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'submit_verify_answer') {
    const userAnswer = parseInt(interaction.values[0]);
    const correctAnswer = verificationSessions.get(interaction.user.id);
    if (correctAnswer === undefined) return interaction.reply({ content: '❌ Kliknij przycisk ponownie.', ephemeral: true });

    if (userAnswer === correctAnswer) {
      try {
        verificationSessions.delete(interaction.user.id);
        const unverifiedRole = interaction.guild.roles.cache.get(AUTOROLE_ON_JOIN_ID);
        const verifiedRole = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);
        if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
        if (verifiedRole) await interaction.member.roles.add(verifiedRole);
        await interaction.update({ content: '🎉 **Weryfikacja pomyślna!** Witamy.', components: [], ephemeral: true });
      } catch (err) { await interaction.reply({ content: '❌ Błąd ról. Przesuń rolę bota wyżej w ustawieniach.', ephemeral: true }); }
    } else {
      await interaction.update({ content: '❌ **Błędny wynik!** Spróbuj ponownie klikając przycisk.', components: [], ephemeral: true });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'transfer') {
    if (!interaction.member.roles.cache.has(TRANSFER_ALLOWED_ROLE_ID)) return interaction.reply({ content: '❌ Brak uprawnień!', ephemeral: true });
    const panstwo = interaction.options.getString('panstwo');
    const embed = new EmbedBuilder().setColor('#FF0055').setTitle('✈️ OFICJALNY TRANSFER PAŃSTWA ✈️').setDescription(`Pod skrzydła **Husarii** przechodzi terytorium: **${panstwo}**!`).setTimestamp();
    await interaction.reply({ content: 'Wysyłanie...', ephemeral: true });
    await interaction.channel.send({ embeds: [embed] });
  }

  if (interaction.isButton() && interaction.customId === 'start_ticket') {
    const selectMenu = new StringSelectMenuBuilder().setCustomId('select_ticket_type').setPlaceholder('Powód...')
      .addOptions([{ label: '🤝 Fuzja', value: 'Fuzja' }, { label: '🛡️ Sojusz', value: 'Sojusz' }, { label: '📝 Rekrutacja', value: 'Rekrutacja' }, { label: '⚙️ Inne', value: 'Inne' }]);
    await interaction.reply({ content: 'Kategoria:', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
    const reason = interaction.values[0]; await interaction.deferUpdate();
    try {
      const ch = await interaction.guild.channels.create({
        name: `ticket-${reason.toLowerCase()}-${interaction.user.username}`,
        type: 0,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });
      ticketCreators.set(ch.id, interaction.user.id);
      const ins = new EmbedBuilder().setColor('#5865F2').setTitle(`🎫 Zgłoszenie: ${reason}`).setDescription('Opisz sprawę, administracja zaraz odpowie.');
      const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Zamknij').setEmoji('🔒').setStyle(ButtonStyle.Danger));
      await ch.send({ content: `<@${interaction.user.id}> | <@&${SUPPORT_ROLE_ID}>`, embeds: [ins], components: [btn] });
    } catch (err) { console.log(err); }
  }

  if (interaction.isButton() && interaction.customId === 'close_ticket_request') {
    const menu = new StringSelectMenuBuilder().setCustomId('select_close_reason').setPlaceholder('Powód...').addOptions([{ label: '✅ Rozwiązane', value: 'Rozwiązane' }, { label: '🤫 Brak kontaktu', value: 'Brak kontaktu' }]);
    await interaction.reply({ content: 'Wybierz powód:', components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_close_reason') {
    const reason = interaction.values[0]; const ch = interaction.channel;
    await interaction.reply('🔒 *Zamykanie (5s)...*');
    try {
      const msgs = await ch.messages.fetch({ limit: 100 });
      let txt = `--- TRANSKRYPCJA: ${ch.name} ---\n\n`;
      msgs.reverse().forEach(m => { if(!m.author.bot) txt += `${m.author.tag}: ${m.content}\n`; });
      const cr = await client.users.fetch(ticketCreators.get(ch.id) || '').catch(() => null);
      if (cr) await cr.send({ embeds: [new EmbedBuilder().setColor('#FAA61A').setTitle('📥 TICKET ZAMKNIĘTY').addFields({ name: 'Powód', value: reason })], files: [new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `transcript-${ch.id}.txt` })] }).catch(() => {});
      setTimeout(async () => { ticketCreators.delete(ch.id); await ch.delete().catch(() => {}); }, 5000);
    } catch (err) { console.log(err); }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || (message.member && message.member.roles.cache.has(BYPASS_ROLE_ID))) return;
  const uid = message.author.id; const now = Date.now();
  if (!userLog.has(uid)) userLog.set(uid, []);
  const ts = userLog.get(uid);
  while (ts.length > 0 && now - ts[0] > 4000) { ts.shift(); }
  ts.push(now);
  if (ts.length > 3) {
    try {
      await message.delete().catch(() => {});
      if (message.member && message.member.moderatable) {
        await message.member.timeout(5 * 60 * 1000, 'Spam');
        const warn = await message.channel.send(`⛔ <@${uid}> otrzymał przerwę za spam.`);
        setTimeout(() => warn.delete().catch(() => {}), 7000);
      }
    } catch (e) { console.log(e); }
  }
});

client.login(process.env.DISCORD_TOKEN);
