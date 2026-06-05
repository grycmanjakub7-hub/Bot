const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// --- SEKCJA RENDER (Serwer HTTP, żeby bot działał 24/7) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot Husaria działa i żyje w chmurze Render!');
});

app.listen(PORT, () => {
    console.log(`[SYSTEM] Serwer HTTP nasłuchuje na porcie ${PORT}`);
});

// --- SEKCJA DISCORD (Główny kod bota) ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Wywoływane, gdy bot pomyślnie połączy się z Discordem
client.once('ready', () => {
    console.log(`[SUKCES] Zalogowano jako ${client.user.tag}! Bot jest online.`);
});

// Proste komendy tekstowe na czacie
client.on('messageCreate', (message) => {
    // Ignoruj wiadomości od innych botów, żeby nie zapętlić kodu
    if (message.author.bot) return;

    // Komenda !ping
    if (message.content === '!ping') {
        message.reply('Pong! 🏓 Bot Husaria działa bez zarzutu.');
    }

    // Komenda !siema
    if (message.content === '!siema') {
        message.reply(`Siemanko ${message.author}! Co tam u Ciebie? 👋`);
    }
});

// TUTAJ WKLEIŁEM TWÓJ TOKEN BEZPOŚREDNIO JAKO TEKST
client.login('MTQ5MjYzNDI3NTYzNDU3NTIzNA.GwzBTH.6jm9AFd0RgaOh3Y3T4as06NJmBcc5780MrvafE');