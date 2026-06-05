const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => { res.send('Bot Husaria z systemem Ticketów i Anty-Spamu!'); });
app.listen(port, () => { console.log(`[SYSTEM] Serwer HTTP nasłuchuje na porcie ${port}`); });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// --- KONFIGURACJA ---
const BYPASS_ROLE_ID = '1512577411315663038'; // Ranga omijająca anty-spam
const TICKET_CHANNEL_ID = '1512574570903900253'; // Kanał, gdzie ma stać panel ticketów
const SUPPORT_ROLE_ID = '1512580895385849998'; // Ranga wsparcia (widzi tickety)

const userLog = new Map();

client.once('ready', async () => {
  console.log(`[SUKCES] Zalogowano jako ${client.user.tag}!`);

  // Automatyczne wysyłanie estetycznego panelu na wskazany kanał
  try {
    const channel = await client.channels.fetch(TICKET_CHANNEL_ID);
    if (channel) {
      // Czyścimy stare wiadomości bota na tym kanale, żeby nie spamować
      const messages = await channel.messages.fetch({ limit: 10 });
      const botMessages = messages.filter(m => m.author.id === client.user.id);
      if (botMessages.size === 0) {
        
        // Tworzenie ładnego wyglądu (Embed)
        const embed = new EmbedBuilder()
          .setColor('#2f3136')
          .setTitle('🎫 SYSTEM ZGŁOSZEŃ (TICKETS)')
          .setDescription('Potrzebujesz pomocy lub chcesz nawiązać współpracę?\nKliknij poniższy przycisk, aby rozpocząć proces tworzenia zgłoszenia.')
          .setFooter({ text: 'Husaria Bot • System Ticketów' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('start_ticket')
            .setLabel('Stwórz zgłoszenie')
            .setEmoji('📩')
            .setStyle(ButtonStyle.Primary)
        );

        await channel.send({ embeds: [embed], components: [row] });
        console.log('[TICKET] Panel został pomyślnie wysłany na kanał.');
      }
    }
  } catch (error) {
    console.log(`[BŁĄD TICKET PANEL]: ${error.message}`);
  }
});

// --- OBSŁUGA INTERAKCJI (PRZYCISKI I MENU) ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild) return;

  // 1. Kliknięcie "Stwórz zgłoszenie" -> Pokazuje menu wyboru powodu
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
    await interaction.reply({ content: 'Wybierz interesującą Cię kategorię z menu poniżej:', components: [row], ephemeral: true });
  }

  // 2. Wybranie opcji z menu -> Tworzy się osobny, ukryty kanał ticketu
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
    const selectedReason = interaction.values[0];
    await interaction.deferUpdate(); // Ukrywa ładowanie menu

    const channelName = `ticket-${selectedReason.toLowerCase()}-${interaction.user.username}`;
    
    try {
      // Tworzenie kanału tekstowego z uprawnieniami
      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: 0, // GuildText
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, // Wszyscy: ukryte
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }, // Użytkownik: widzi
          { id: SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] } // Ranga wsparcia: widzi
        ]
      });

      // Estetyczna wiadomość wewnątrz nowo otwartego ticketa
      const insideEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🎫 Zgłoszenie: ${selectedReason}`)
        .setDescription(`Witaj <@${interaction.user.id}>!\nZgłoszenie zostało pomyślnie otwarte. Napisz tutaj, w czym możemy Ci pomóc, a administracja (<@&${SUPPORT_ROLE_ID}>) zaraz się Tobą zajmie.`)
        .setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Zamknij ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${SUPPORT_ROLE_ID}>`, embeds: [insideEmbed], components: [closeRow] });
      await interaction.followUp({ content: `✅ Twój ticket został utworzony: <#${ticketChannel.id}>`, ephemeral: true });

    } catch (err) {
      console.log(`[BŁĄD TWORZENIA TICKETA]: ${err.message}`);
      await interaction.followUp({ content: '❌ Wystąpił błąd podczas tworzenia ticketa. Upewnij się, że bot ma uprawnienia Administratora.', ephemeral: true });
    }
  }

  // 3. Kliknięcie przycisku "Zamknij ticket" -> Usuwa kanał po 5 sekundach
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    await interaction.reply('🔒 *Zgłoszenie zostanie zamknięte i usunięte za 5 sekund...*');
    setTimeout(async () => {
      try {
        await interaction.channel.delete();
      } catch (err) {
        console.log(`[BŁĄD ZAMYKANIA TICKETA]: ${err.message}`);
      }
    }, 5000);
  }
});

// --- ANTY-SPAM SYSTEM (Z PRZERWAMI NA 5 MINUT) ---
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
    } catch (error) {
      console.log(`[BŁĄD ANTY-SPAM]: ${error.message}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
