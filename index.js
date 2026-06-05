const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, AttachmentBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => { res.send('Bot Husaria z komendą /transfer i ticketami!'); });
app.listen(port, () => { console.log(`[SYSTEM] Serwer HTTP nasłuchuje na porcie ${port}`); });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// --- KONFIGURACJA ID ---
const BYPASS_ROLE_ID = '1512577411315663038'; // Ranga omijająca anty-spam
const TICKET_CHANNEL_ID = '1512574570903900253'; // Kanał z panelem ticketów
const SUPPORT_ROLE_ID = '1512580895385849998'; // Ranga wsparcia
const TRANSFER_ALLOWED_ROLE_ID = '1512587126506655774'; // Ranga, która może użyć /transfer

const userLog = new Map();
const ticketCreators = new Map();

// --- REJESTRACJA KOMENDY SLASH (/transfer) ---
client.once('ready', async () => {
  console.log(`[SUKCES] Zaawansowany bot ticketowy gotowy do akcji!`);
  
  // Definiujemy naszą komendę slash
  const commands = [
    new SlashCommandBuilder()
      .setName('transfer')
      .setDescription('Ogłoś oficjalny transfer państwa do Husarii')
      .addStringOption(option => 
        option.setName('panstwo')
          .setDescription('Wpisz nazwę państwa, które do nas dołącza')
          .setRequired(true)
      )
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('[SYSTEM] Rozpoczynanie odświeżania komend aplikacji (/)');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('[SYSTEM] Pomyślnie zarejestrowano komendy aplikacji (/)');
  } catch (error) {
    console.error(`[BŁĄD REJESTRACJI KOMEND]: ${error.message}`);
  }

  // Automatyczny panel ticketów (jeśli nie istnieje)
  try {
    const channel = await client.channels.fetch(TICKET_CHANNEL_ID);
    if (channel) {
      const messages = await channel.messages.fetch({ limit: 10 });
      const botMessages = messages.filter(m => m.author.id === client.user.id);
      if (botMessages.size === 0) {
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🎫 SYSTEM ZGŁOSZEŃ (TICKETS)')
          .setDescription('Potrzebujesz pomocy administracji, chcesz zgłosić fuzję lub sojusz?\nKliknij poniższy przycisk, aby otworzyć nowe zgłoszenie.')
          .setFooter({ text: 'Husaria Bot • Centrum Pomocy' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('start_ticket')
            .setLabel('Stwórz zgłoszenie')
            .setEmoji('📩')
            .setStyle(ButtonStyle.Primary)
        );
        await channel.send({ embeds: [embed], components: [row] });
      }
    }
  } catch (error) { console.log(`[BŁĄD PANELU]: ${error.message}`); }
});

// --- OBSŁUGA INTERAKCJI (KOMENDY, PRZYCISKI, MENU) ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild) return;

  // ==================== OBSŁUGA KOMENDY /transfer ====================
  if (interaction.isChatInputCommand() && interaction.customId === undefined) {
    if (interaction.commandName === 'transfer') {
      
      // Sprawdzanie permisji roli: tylko rola 1512587126506655774 może tego użyć
      if (!interaction.member.roles.cache.has(TRANSFER_ALLOWED_ROLE_ID)) {
        return interaction.reply({ 
          content: '❌ Nie masz uprawnień do używania tej komendy! Wymagana jest specjalna ranga zarządcza.', 
          ephemeral: true 
        });
      }

      const panstwo = interaction.options.getString('panstwo');

      // Tworzymy przepiękny, estetyczny Embed ogłoszeniowy o transferze
      const transferEmbed = new EmbedBuilder()
        .setColor('#FF0055') // Bojowy, husarski czerwono-różowy kolor
        .setTitle('✈️ OFICJALNY TRANSFER PAŃSTWA ✈️')
        .setDescription(`Z wielką dumą ogłaszamy, że pod skrzydła potężnej **Husarii** oficjalnie przechodzi nowe terytorium!`)
        .addFields(
          { name: '🌍 Dołączające Państwo', value: `👑 **${panstwo}**`, inline: false },
          { name: '🛡️ Nowy Sojusznik / Poddany', value: `➡️ Wcielone do struktur **HUSARIA**`, inline: false },
          { name: '📈 Status transferu', value: `🟩 **ZAKOŃCZONY POMYŚLNIE**`, inline: true }
        )
        .setImage('https://i.imgur.com/vHqLg0H.png') // Możesz tu podmienić link do grafiki Husarii, jeśli jakąś masz!
        .setTimestamp()
        .setFooter({ text: `Ogłoszone przez: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

      // Odpowiadamy w sposób ukryty dla świata (ephemeral), co sprawia, że komenda "znika" dla innych,
      // a na kanale wysyłamy czyste, piękne ogłoszenie jako zwykłą wiadomość bota.
      await interaction.reply({ content: 'Wysyłanie ogłoszenia o transferze...', ephemeral: true });
      await interaction.channel.send({ embeds: [transferEmbed] });
    }
  }

  // ==================== OBSŁUGA TICKETÓW ====================
  // 1. Kliknięcie "Stwórz zgłoszenie" -> Menu wyboru powodu
  if (interaction.isButton() && interaction.customId === 'start_ticket') {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_ticket_type')
      .setPlaceholder('Wybierz powód zgłoszenia...')
      .addOptions([
        { label: '🤝 Fuzja', value: 'Fuzja', description: 'Zgłoszenie dotyczące fuzji.' },
        { label: '🛡️ Sojusz', value: 'Sojusz', description: 'Chęć nawiązania sojuszu.' },
        { label: '📝 Rekrutacja', value: 'Rekrutacja', description: 'Podanie lub pytania o rekrutację.' },
        { label: '⚙️ Inne', value: 'Inne', description: 'Pozostałe sprawy.' }
      ]);
    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ content: 'Wybierz interesującą Cię kategorię:', components: [row], ephemeral: true });
  }

  // 2. Wybranie powodu -> Tworzenie kanału na samym dole
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
    const selectedReason = interaction.values[0];
    await interaction.deferUpdate();

    const channelName = `ticket-${selectedReason.toLowerCase()}-${interaction.user.username}`;
    try {
      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: 0,
        parent: null, // Na samym dole listy
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });

      ticketCreators.set(ticketChannel.id, interaction.user.id);

      const insideEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🎫 Zgłoszenie: ${selectedReason}`)
        .setDescription(`Witaj <@${interaction.user.id}>!\nOpisz tutaj swoją sprawę, a administracja (<@&${SUPPORT_ROLE_ID}>) zaraz się Tobą zajmie.\n\nAby zamknąć to zgłoszenie, kliknij przycisk poniżej.`)
        .setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket_request')
          .setLabel('Zamknij ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${SUPPORT_ROLE_ID}>`, embeds: [insideEmbed], components: [closeRow] });
      await interaction.followUp({ content: `✅ Twój ticket został utworzony na dole listy: <#${ticketChannel.id}>`, ephemeral: true });
    } catch (err) { console.log(`[BŁĄD TWORZENIA]: ${err.message}`); }
  }

  // 3. Kliknięcie "Zamknij ticket" -> Wybór powodu zamknięcia
  if (interaction.isButton() && interaction.customId === 'close_ticket_request') {
    const reasonMenu = new StringSelectMenuBuilder()
      .setCustomId('select_close_reason')
      .setPlaceholder('Wybierz powód zamknięcia zgłoszenia...')
      .addOptions([
        { label: '✅ Sprawa rozwiązana', value: 'Sprawa została w pełni rozwiązana' },
        { label: '🤫 Gracz nie odpowiada', value: 'Gracz nie odpowiada' },
        { label: '❌ Brak porozumienia / Odrzucono', value: 'Brak wspólnego porozumienia / Prośba odrzucona' },
        { label: '⚙️ Inny powód', value: 'Inny / Nieokreślony' }
      ]);
    const row = new ActionRowBuilder().addComponents(reasonMenu);
    await interaction.reply({ content: 'Wybierz oficjalny powód zamknięcia tego zgłoszenia:', components: [row] });
  }

  // 4. Wybranie powodu zamknięcia -> Transkrypcja, wysłanie DM i usunięcie kanału
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_close_reason') {
    const closeReason = interaction.values[0];
    const channel = interaction.channel;
    await interaction.reply('🔒 *Generowanie transkrypcji i zamykanie kanału (5 sekund)...*');

    try {
      const fetchedMessages = await channel.messages.fetch({ limit: 100 });
      let transcriptText = `--- TRANSKRYPCJA ZGŁOSZENIA: ${channel.name} ---\n\n`;
      const sortedMessages = fetchedMessages.reverse();
      sortedMessages.forEach(msg => {
        if (!msg.author.bot) {
          const dateStr = msg.createdAt.toLocaleString('pl-PL');
          transcriptText += `${msg.author.tag} [${dateStr}]: ${msg.content}\n`;
        }
      });

      const buffer = Buffer.from(transcriptText, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.id}.txt` });

      const creatorId = ticketCreators.get(channel.id) || interaction.user.id;
      const creator = await client.users.fetch(creatorId).catch(() => null);

      const closeEmbed = new EmbedBuilder()
        .setColor('#FAA61A')
        .setTitle('📥 TWÓJ TICKET ZOSTAŁ ZAMKNIĘTY')
        .addFields(
          { name: '🆔 Ticket ID', value: `\`${channel.id}\``, inline: false },
          { name: '👤 Zamknięty przez', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📅 Data', value: `\`${new Date().toLocaleString('pl-PL')}\``, inline: true },
          { name: '📝 Powód', value: `\`${closeReason}\``, inline: false }
        )
        .setFooter({ text: 'Husaria Bot • Centrum Pomocy' });

      if (creator) {
        await creator.send({ embeds: [closeEmbed], files: [attachment] }).catch(() => {});
      }

      setTimeout(async () => {
        ticketCreators.delete(channel.id);
        await channel.delete().catch(() => {});
      }, 5000);
    } catch (err) { console.log(`[BŁĄD ZAMYKANIA]: ${err.message}`); }
  }
});

// --- ANTY-SPAM SYSTEM (Działa w tle) ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.member && message.member.roles.cache.has(BYPASS_ROLE_ID)) return;

  const userId = message.author.id;
  const now = Date.now();
  const LIMIT = 3;
  const TIME_WINDOW = 4000; 
  const TIMEOUT_DURATION = 5 * 60 * 1000;

  if (!userLog.has(userId)) userLog.set(userId, []);
  const timestamps = userLog.get(userId);
  while (timestamps.length > 0 && now - timestamps[0] > TIME_WINDOW) { timestamps.shift(); }
  timestamps.push(now);

  if (timestamps.length > LIMIT) {
    try {
      await message.delete().catch(() => {});
      if (message.member && message.member.moderatable) {
        await message.member.timeout(TIMEOUT_DURATION, 'Spamowanie na czacie');
        const warning = await message.channel.send(`⛔ <@${userId}> otrzymał przerwę na **5 minut** za spamowanie!`);
        setTimeout(() => warning.delete().catch(() => {}), 7000);
      }
    } catch (error) { console.log(`[BŁĄD ANTY-SPAM]: ${error.message}`); }
  }
});

client.login(process.env.DISCORD_TOKEN);
