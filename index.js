const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, AttachmentBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => { res.send('Bot Husaria z systemem weryfikacji i automatycznych rang!'); });
app.listen(port, () => { console.log(`[SYSTEM] Serwer HTTP nasłuchuje na porcie ${port}`); });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers 
  ]
});

// --- KONFIGURACJA ID ---
const BYPASS_ROLE_ID = '1512577411315663038'; // Ranga omijająca anty-spam
const TICKET_CHANNEL_ID = '1512574570903900253'; // Kanał z panelem ticketów
const SUPPORT_ROLE_ID = '1512580895385849998'; // Ranga wsparcia
const TRANSFER_ALLOWED_ROLE_ID = '1512587126506655774'; // Ranga do /transfer
const WELCOME_CHANNEL_ID = '1512410099518410782'; // Kanał powitań

// NOWE REJESTRY ID WERYFIKACJI
const VERIFY_CHANNEL_ID = '1512591912450920558'; // Kanał, gdzie stoi panel weryfikacji
const AUTOROLE_ON_JOIN_ID = '1512592026900627487'; // Ranga nadawana OD RAZU po wejściu
const VERIFIED_ROLE_ID = '1512580404974981120'; // Ranga otrzymywana PO WERYFIKACJI

const userLog = new Map();
const ticketCreators = new Map();

// --- START BOTA I GENEROWANIE PANELU WERYFIKACJI ---
client.once('ready', async () => {
  console.log(`[SUKCES] Zaawansowany bot Husaria gotowy do akcji!`);
  
  // Rejestracja komendy /transfer
  const commands = [
    new SlashCommandBuilder()
      .setName('transfer')
      .setDescription('Ogłoś oficjalny transfer państwa do Husarii')
      .addStringOption(option => option.setName('panstwo').setDescription('Wpisz nazwę państwa').setRequired(true))
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[SYSTEM] Pomyślnie zarejestrowano komendy aplikacji (/)');
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

  // AUTOMATYCZNY PANEL WERYFIKACJI
  try {
    const vChannel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    if (vChannel) {
      const vMessages = await vChannel.messages.fetch({ limit: 10 });
      if (vMessages.filter(m => m.author.id === client.user.id).size === 0) {
        const vEmbed = new EmbedBuilder()
          .setColor('#2f3136')
          .setTitle('🛡️ WERYFIKACJA BEZPIECZEŃSTWA')
          .setDescription('Aby uzyskać pełny dostęp do serwera **Husaria** i dowieść, że nie jesteś robotem, kliknij poniższy przycisk i rozwiąż proste zadanie.');
        
        const vRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('trigger_verify')
            .setLabel('Zweryfikuj się')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
        );
        await vChannel.send({ embeds: [vEmbed], components: [vRow] });
        console.log('[WERYFIKACJA] Panel weryfikacyjny został wysłany.');
      }
    }
  } catch (e) { console.log(`[BŁĄD PANELU WERYFIKACJI]: ${e.message}`); }
});

// --- AUTOMATYCZNA RANGA PRZY DOŁĄCZENIU + EMISJA POWITANIA ---
client.on('guildMemberAdd', async (member) => {
  try {
    // 1. Z automatu dajemy rangę startową
    const startRole = member.guild.roles.cache.get(AUTOROLE_ON_JOIN_ID);
    if (startRole) {
      await member.roles.add(startRole);
      console.log(`[AUTOROLE] Nadano rangę początkową użytkownikowi ${member.user.tag}`);
    }

    // 2. Wysyłamy estetyczne powitanie
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
  } catch (error) { console.log(`[BŁĄD DOŁĄCZENIA]: ${error.message}`); }
});

// --- PAMIĘĆ DLA ZADAŃ MATEMATYCZNYCH ---
const verificationSessions = new Map();

// --- OBSŁUGA INTERAKCJI (WERYFIKACJA, TICKETY, /TRANSFER) ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild) return;

  // 1. Kliknięcie "Zweryfikuj się" -> Generowanie losowego zadania
  if (interaction.isButton() && interaction.customId === 'trigger_verify') {
    // Sprawdzamy czy użytkownik przypadkiem nie ma już rangi zweryfikowanego
    if (interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
      return interaction.reply({ content: '✅ Jesteś już pomyślnie zweryfikowany na tym serwerze!', ephemeral: true });
    }

    // Losujemy liczby od 1 do 10
    const num1 = Math.floor(Math.random() * 9) + 1;
    const num2 = Math.floor(Math.random() * 9) + 1;
    const isPlus = Math.random() > 0.5;
    
    const correctAnswer = isPlus ? (num1 + num2) : (num1 - num2);
    const questionString = `Ile to jest: **${num1} ${isPlus ? '+' : '-'} ${num2}**?`;

    // Generujemy błędne odpowiedzi, dbając by się nie powtarzały
    const answers = new Set([correctAnswer]);
    while (answers.size < 4) {
      answers.add(correctAnswer + (Math.floor(Math.random() * 7) - 3));
    }
    const shuffledAnswers = Array.from(answers).sort((a, b) => a - b);

    // Zapisujemy poprawną odpowiedź dla tego użytkownika
    verificationSessions.set(interaction.user.id, correctAnswer);

    // Tworzymy menu wyboru odpowiedzi
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('submit_verify_answer')
      .setPlaceholder('Wybierz poprawny wynik...');

    shuffledAnswers.forEach(ans => {
      selectMenu.addOptions({ label: `Wynik: ${ans}`, value: ans.toString() });
    });

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: `🔒 **Zadanie weryfikacyjne:**\nRozwiąż to proste równanie, aby odblokować serwer:\n\n${questionString}`,
      components: [row],
      ephemeral: true
    });
  }

  // 2. Sprawdzenie wybranej odpowiedzi z menu weryfikacji
  if (interaction.isStringSelectMenu() && interaction.customId === 'submit_verify_answer') {
    const userAnswer = parseInt(interaction.values[0]);
    const correctAnswer = verificationSessions.get(interaction.user.id);

    if (correctAnswer === undefined) {
      return interaction.reply({ content: '❌ Coś poszło nie tak. Kliknij przycisk weryfikacji ponownie.', ephemeral: true });
    }

    if (userAnswer === correctAnswer) {
      try {
        // Usuwamy sesję z pamięci bota
        verificationSessions.delete(interaction.user.id);

        // Nadajemy rangę zweryfikowanego i usuwamy niezweryfikowanego
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

  // ==================== POZOSTAŁY KOD (/TRANSFER I TICKETY) ====================
  if (interaction.isChatInputCommand() && interaction.customId === undefined) {
    if (interaction.commandName === 'transfer') {
      if (!interaction.member.roles.cache.has(TRANSFER_ALLOWED_ROLE_ID)) {
        return interaction.reply({ content: '❌ Nie masz uprawnień!', ephemeral: true });
      }
      const panstwo = interaction.options.getString('panstwo');
      const transferEmbed = new EmbedBuilder()
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
      await interaction.channel.send({ embeds: [transferEmbed] });
    }
  }

  if (interaction.isButton() && interaction.customId === 'start_ticket') {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_ticket_type')
      .setPlaceholder('Wybierz powód zgłoszenia...')
      .addOptions([
        { label: '🤝 Fuzja', value: 'Fuzja' }, { label: '🛡️ Sojusz', value: 'Sojusz' },
        { label: '📝 Rekrutacja', value: 'Rekrutacja' }, { label: '⚙️ Inne', value: 'Inne' }
      ]);
    await interaction.reply({ content: 'Wybierz kategorię:', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
    const selectedReason = interaction.values[0];
    await interaction.deferUpdate();
    try {
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${selectedReason.toLowerCase()}-${interaction.user.username}`,
        type: 0, parent: null,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });
      ticketCreators.set(ticketChannel.id, interaction.user.id);
      const insideEmbed = new EmbedBuilder().setColor('#5865F2').setTitle(`🎫 Zgłoszenie: ${selectedReason}`).setDescription(`Witaj <@${interaction.user.id}>!\nOpisz sprawę, administracja zaraz odpowie.`);
      const closeRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Zamknij ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger));
      await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${SUPPORT_ROLE_ID}>`, embeds: [insideEmbed], components: [closeRow] });
    } catch (err) { console.log(err); }
  }

  if (interaction.isButton() && interaction.customId === 'close_ticket_request') {
    const reasonMenu = new StringSelectMenuBuilder().setCustomId('select_close_reason').setPlaceholder('Powód zamknięcia...').addOptions([{ label: '✅ Rozwiązane', value: 'Rozwiązane' }, { label: '🤫 Brak kontaktu', value: 'Brak kontaktu' }]);
    await interaction.reply({ content: 'Wybierz powód:', components: [new ActionRowBuilder().addComponents(reasonMenu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_close_reason') {
    const closeReason = interaction.values[0]; const channel = interaction.channel;
    await interaction.reply('🔒 *Zamykanie kanału (5 sekund)...*');
    try {
      const fetchedMessages = await channel.messages.fetch({ limit: 100 });
      let txt = `--- TRANSKRYPCJA: ${channel.name} ---\n\n`;
      fetchedMessages.reverse().forEach(m => { if(!m.author.bot) txt += `${m.author.tag}: ${m.content}\n`; });
      const attachment = new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `transcript-${channel.id}.txt` });
      const creator = await client.users.fetch(ticketCreators.get(channel.id) || '').catch(() => null);
      const closeEmbed = new EmbedBuilder().setColor('#FAA61A').setTitle('📥 TICKET ZAMKNIĘTY').addFields({ name: '📝 Powód', value: `\`${closeReason}\`` });
      if (creator) { await creator.send({ embeds: [closeEmbed], files: [attachment] }).catch(() => {}); }
      setTimeout(async () => { ticketCreators.delete(channel.id); await channel.delete().catch(() => {}); }, 5000);
    } catch (err) { console.log(err); }
  }
});

// --- ANTY-SPAM SYSTEM ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.member && message.member.roles.cache.has(BYPASS_ROLE_ID)) return;
  const userId = message.author.id; const now = Date.now();
  if (!userLog.has(userId)) userLog.set(userId, []);
  const timestamps = userLog.get(userId);
  while (timestamps.length > 0 && now - timestamps[0] > 4000) { timestamps.shift(); }
  timestamps.push(now);
  if (timestamps.length > 3) {
    try {
      await message.delete().catch(() => {});
      if (message.member && message.member.moderatable) {
        await message.member.timeout(5 * 60 * 1000, 'Spam');
        const warning = await message.channel.send(`⛔ <@${userId}> otrzymał przerwę za spam.`);
        setTimeout(() => warning.delete().catch(() => {}), 7000);
      }
    } catch (e) { console.log(e); }
  }
});

client.login(process.env.DISCORD_TOKEN);
