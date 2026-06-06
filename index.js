const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, AttachmentBuilder, REST, Routes, SlashCommandBuilder, MessageFlags } = require('discord.js');
const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => { res.send('Bot Husaria dziala 24/7!'); });
app.listen(port, () => { 
  console.log(`[SYSTEM] Serwer HTTP nasluchuje na porcie ${port}`);
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
const MEMBER_COUNT_CHANNEL_ID = '1512409967892762706';

const userLog = new Map();
const ticketCreators = new Map();
const verificationSessions = new Map();

// Funkcja aktualizujaca nazwe kanalu glosowego z liczba czlonkow
async function updateMemberCountChannel(guild) {
  try {
    const channel = await guild.channels.fetch(MEMBER_COUNT_CHANNEL_ID);
    if (channel && channel.isVoiceBased()) {
      const memberCount = guild.memberCount;
      const newName = `〔👥〕・ludzie ${memberCount}`;
      if (channel.name !== newName) {
        await channel.setName(newName);
        console.log(`[LICZBA OSOB] Zaktualizowano nazwe kanalu: ${newName}`);
      }
    }
  } catch (error) {
    console.log(`[BLAD KANALU CZLONKOW]: ${error.message}`);
  }
}

// ANTY-SLEEP SYSTEM DLA RENDERU
function startAntiSleep() {
  // Ping co 5 minut (300000ms)
  setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
      const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com`;
      axios.get(url, { timeout: 5000 })
        .then(() => console.log(`[ANTY-SLEEP] ✅ Pinga${new Date().toLocaleTimeString()}`))
        .catch((err) => console.log(`[ANTY-SLEEP] ❌ Blad: ${err.message}`));
    }
  }, 300000);

  // Alternatywny ping co 10 minut (backup)
  setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
      const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com`;
      axios.get(url, { timeout: 5000 })
        .then(() => console.log(`[ANTY-SLEEP-BACKUP] ✅ Pinga${new Date().toLocaleTimeString()}`))
        .catch((err) => console.log(`[ANTY-SLEEP-BACKUP] ❌ Blad: ${err.message}`));
    }
  }, 600000);

  console.log('[ANTY-SLEEP] System aktywny! Bot nie bedzie sie wylaczy!');
}

client.once('ready', async () => {
  console.log(`[SUKCES] Zaawansowany bot Husaria gotowy do akcji!`);
  
  // Uruchamiamy anty-sleep system
  startAntiSleep();
  
  const commands = [
    new SlashCommandBuilder()
      .setName('transfer')
      .setDescription('Oglos oficjalny transfer panstwa do Husarii')
      .addStringOption(option => option.setName('panstwo').setDescription('Wpisz nazwe panstwa').setRequired(true))
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
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🎫 SYSTEM ZGŁOSZEŃ (TICKETS)')
          .setDescription('Potrzebujesz pomocy administracji, chcesz zgłosić fuzję lub sojusz?\nKliknij poniższy przycisk, aby otworzyć nowe zgłoszenie.');
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
        const vEmbed = new EmbedBuilder()
          .setColor('#2f3136')
          .setTitle('🛡️ WERYFIKACJA BEZPIECZEŃSTWA')
          .setDescription('Aby uzyskać pełny dostęp do serwera, kliknij przycisk i rozwiąż proste zadanie matematyczne.');
        const vRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trigger_verify').setLabel('Zweryfikuj się').setEmoji('✅').setStyle(ButtonStyle.Success));
        await vChannel.send({ embeds: [vEmbed], components: [vRow] });
        console.log('[WERYFIKACJA] Panel wysłany.');
      }
    }
  } catch (e) { console.log(e); }

  // Pierwsza aktualizacja liczby czlonkow
  for (const guild of client.guilds.cache.values()) {
    await updateMemberCountChannel(guild);
  }
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
        .setDescription(`👋 Witaj <@${member.id}> na serwerze **${member.guild.name}**!\nCieszymy się, że do nas dołączasz. Rozgość się!`)
        .addFields({ name: '📊 Jesteś naszym', value: `\`${member.guild.memberCount}\` użytkownikiem.`, inline: true })
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
      await channel.send({ content: `Witaj <@${member.id}>! ⚔️`, embeds: [welcomeEmbed] });
    }
  } catch (error) { console.log(error); }

  // Aktualizacja liczby czlonkow na kanale
  await updateMemberCountChannel(member.guild);
});

client.on('guildMemberRemove', async (member) => {
  // Aktualizacja liczby czlonkow na kanale
  await updateMemberCountChannel(member.guild);
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

    await interaction.reply({ content: `🔒 **Zadanie weryfikacyjne:**\nIle to jest: **${num1} ${isPlus ? '+' : '-'} ${num2}**?`, components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'submit_verify_answer') {
    const userAnswer = parseInt(interaction.values[0]);
    const correctAnswer = verificationSessions.get(interaction.user.id);
    if (correctAnswer === undefined) return interaction.reply({ content: '❌ Coś poszło nie tak. Kliknij przycisk ponownie.', ephemeral: true });

    if (userAnswer === correctAnswer) {
      try {
        verificationSessions.delete(interaction.user.id);
        const unverifiedRole = interaction.guild.roles.cache.get(AUTOROLE_ON_JOIN_ID);
        const verifiedRole = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);
        if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
        if (verifiedRole) await interaction.member.roles.add(verifiedRole);
        await interaction.update({ content: '🎉 **Weryfikacja zakończona sukcesem!** Witamy na pełnej wersji serwera Husaria. Uzyskałeś dostęp do kanałów.', components: [], ephemeral: true });
      } catch (err) { 
        console.log(err);
        await interaction.reply({ content: '❌ Bot napotkał problem z rangami. Upewnij się, że rola bota jest nad rangami weryfikacyjnymi.', ephemeral: true }); 
      }
    } else {
      await interaction.update({ content: '❌ **Błędna odpowiedź!** Spróbuj ponownie klikając zielony przycisk na kanale.', components: [], ephemeral: true });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'transfer') {
    if (!interaction.member.roles.cache.has(TRANSFER_ALLOWED_ROLE_ID)) return interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
    const panstwo = interaction.options.getString('panstwo');
    const embed = new EmbedBuilder()
      .setColor('#FF0055')
      .setTitle('✈️ OFICJALNY TRANSFER PAŃSTWA ✈️')
      .setDescription(`Z wielką dumą ogłaszamy, że pod skrzydła potężnej **Husarii** oficjalnie przechodzi nowe terytorium!`)
      .addFields(
        { name: '🌍 Dołączające Państwo', value: `👑 **${panstwo}**` },
        { name: '🛡️ Status', value: `🟩 **ZAKOŃCZONY POMYŚLNIE**` }
      )
      .setTimestamp()
      .setFooter({ text: `Ogłoszone przez: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });
    await interaction.reply({ content: 'Wysyłanie...', ephemeral: true });
    await interaction.channel.send({ embeds: [embed] });
  }

  if (interaction.isButton() && interaction.customId === 'start_ticket') {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_ticket_type')
      .setPlaceholder('Wybierz powód zgłoszenia...')
      .addOptions([
        { label: '🤝 Fuzja', value: 'Fuzja' },
        { label: '🛡️ Sojusz', value: 'Sojusz' },
        { label: '📝 Rekrutacja', value: 'Rekrutacja' },
        { label: '⚙️ Inne', value: 'Inne' }
      ]);
    await interaction.reply({ content: 'Wybierz kategorię:', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
    const reason = interaction.values[0];
    await interaction.deferUpdate();
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
      const ins = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🎫 Zgłoszenie: ${reason}`)
        .setDescription(`Witaj <@${interaction.user.id}>!\nOpisz sprawę, administracja zaraz odpowie.`);
      const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Zamknij ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger));
      await ch.send({ content: `<@${interaction.user.id}> | <@&${SUPPORT_ROLE_ID}>`, embeds: [ins], components: [btn] });
    } catch (err) { console.log(err); }
  }

  if (interaction.isButton() && interaction.customId === 'close_ticket_request') {
    // Sprawdzenie czy użytkownik ma rangę SUPPORT_ROLE_ID
    if (!interaction.member.roles.cache.has(SUPPORT_ROLE_ID)) {
      return interaction.reply({ content: '❌ Tylko obsługa może zamykać tickety!', ephemeral: true });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('select_close_reason')
      .setPlaceholder('Powód zamknięcia...')
      .addOptions([
        { label: '✅ Rozwiązane', value: 'Rozwiązane' },
        { label: '🤫 Brak komunikacji', value: 'Brak komunikacji' },
        { label: '❌ Anulowano', value: 'Anulowano' }
      ]);
    await interaction.reply({ content: 'Wybierz powód:', components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_close_reason') {
    // Dodatkowe sprawdzenie uprawnień
    if (!interaction.member.roles.cache.has(SUPPORT_ROLE_ID)) {
      return interaction.reply({ content: '❌ Tylko obsługa może zamykać tickety!', ephemeral: true });
    }

    const reason = interaction.values[0];
    const ch = interaction.channel;
    await interaction.reply('🔒 *Zamykanie kanału (5 sekund)...*');
    try {
      const msgs = await ch.messages.fetch({ limit: 100 });
      let txt = `--- TRANSKRYPCJA: ${ch.name} ---\n\n`;
      msgs.reverse().forEach(m => { if (!m.author.bot) txt += `${m.author.tag}: ${m.content}\n`; });
      const attachment = new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `transcript-${ch.id}.txt` });
      const cr = await client.users.fetch(ticketCreators.get(ch.id) || '').catch(() => null);
      if (cr) {
        await cr.send({
          embeds: [new EmbedBuilder().setColor('#FAA61A').setTitle('📥 TICKET ZAMKNIĘTY').addFields({ name: '📝 Powód', value: `\`${reason}\`` })],
          files: [attachment]
        }).catch(() => {});
      }
      setTimeout(async () => { ticketCreators.delete(ch.id); await ch.delete().catch(() => {}); }, 5000);
    } catch (err) { console.log(err); }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.member && message.member.roles.cache.has(BYPASS_ROLE_ID)) return;
  
  const uid = message.author.id;
  const now = Date.now();
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

client.on('error', err => console.error('[ERROR]:', err));
client.on('warn', info => console.warn('[WARN]:', info));

client.login(process.env.DISCORD_TOKEN);
