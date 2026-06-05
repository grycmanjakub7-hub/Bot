const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

// Serwer HTTP dla Rendera
app.get('/', (req, res) => {
  res.send('Bot Husaria daje przerwy za spam!');
});

app.listen(port, () => {
  console.log(`[SYSTEM] Serwer HTTP nasłuchuje na porcie ${port}`);
});

// Włączamy potrzebne intencje
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ID rangi, która OMIJA anty-spam
const BYPASS_ROLE_ID = '1512577411315663038';

// Pamięć bota do zapisywania czasu wiadomości użytkowników
const userLog = new Map();

client.once('ready', () => {
  console.log(`[SUKCES] Zalogowano jako ${client.user.tag}! System przerw za spam aktywny.`);
});

client.on('messageCreate', async (message) => {
  // Ignoruj wiadomości od innych botów oraz wiadomości prywatne
  if (message.author.bot || !message.guild) return;

  // Sprawdzamy, czy użytkownik ma rangę, która omija anty-spam
  if (message.member && message.member.roles.cache.has(BYPASS_ROLE_ID)) {
    return;
  }

  const userId = message.author.id;
  const now = Date.now();
  
  // Konfiguracja spamu: max 3 wiadomości w 4 sekundy
  const LIMIT = 3;
  const TIME_WINDOW = 4000; 
  // Czas trwania przerwy w milisekundach (5 minut = 300 000 ms)
  const TIMEOUT_DURATION = 5 * 60 * 1000;

  if (!userLog.has(userId)) {
    userLog.set(userId, []);
  }

  const timestamps = userLog.get(userId);
  
  // Usuwamy stare wpisy
  while (timestamps.length > 0 && now - timestamps[0] > TIME_WINDOW) {
    timestamps.shift();
  }

  timestamps.push(now);

  // Jeśli użytkownik przekroczył limit wiadomości
  if (timestamps.length > LIMIT) {
    try {
      // 1. Usuwamy ostatnią wiadomość, która przelała szalę goryczy
      await message.delete().catch(() => {});

      // 2. Nakładamy przerwę (Timeout) na 5 minut
      if (message.member && message.member.moderatable) {
        await message.member.timeout(TIMEOUT_DURATION, 'Spamowanie na czacie');
        
        // 3. Informujemy o tym na czacie (wiadomość zniknie po 7 sekundach)
        const warning = await message.channel.send(`⛔ <@${userId}> otrzymał przerwę na **5 minut** za spamowanie!`);
        setTimeout(() => warning.delete().catch(() => {}), 7000);
      } else {
        // Jeśli bot nie może go wyciszyć (np. to właściciel serwera albo inna rola wyżej bota)
        const warning = await message.channel.send(`⚠️ <@${userId}> spami, ale nie mogę nałożyć na niego przerwy (brak uprawnień/zbyt wysoka rola).`);
        setTimeout(() => warning.delete().catch(() => {}), 7000);
      }
    } catch (error) {
      console.log(`[BŁĄD] Problem z ukaraniem użytkownika: ${error.message}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
