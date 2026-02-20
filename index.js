const {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');

const fs = require('fs');

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const DATA_FILE = './mmr.json';
const RANKING_CHANNEL_NAME = 'ranking-1v1';

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

function getData() {
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function ensurePlayer(data, id) {
    if (!data[id]) {
        data[id] = {
            mmr: 1000,
            wins: 0,
            losses: 0,
            history: []
        };
    }
}

function calculateElo(winnerMMR, loserMMR) {
    const K = 32;
    const expectedWin = 1 / (1 + Math.pow(10, (loserMMR - winnerMMR) / 400));
    const expectedLose = 1 / (1 + Math.pow(10, (winnerMMR - loserMMR) / 400));

    const newWinner = Math.round(winnerMMR + K * (1 - expectedWin));
    const newLoser = Math.round(loserMMR + K * (0 - expectedLose));

    return { winner: newWinner, loser: newLoser };
}

client.once(Events.ClientReady, () => {
    console.log(`Bot listo como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.isChatInputCommand()) return;

    const data = getData();

    // 🔹 MMR
    if (interaction.commandName === 'mmr') {

        ensurePlayer(data, interaction.user.id);
        saveData(data);

        await interaction.reply(`🏆 Tu MMR es: **${data[interaction.user.id].mmr}**`);
    }

    // 🔹 RESULTADO
    else if (interaction.commandName === 'resultado') {

        const ganador = interaction.options.getUser('ganador');
        const perdedor = interaction.options.getUser('perdedor');

        ensurePlayer(data, ganador.id);
        ensurePlayer(data, perdedor.id);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm')
                .setLabel('Confirmar')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancelar')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            content: `🏆 ${ganador} vs 💀 ${perdedor}\nAmbos deben confirmar.`,
            components: [row]
        });

        const filter = i =>
            (i.user.id === ganador.id || i.user.id === perdedor.id);

        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 60000
        });

        const confirmed = new Set();

        collector.on('collect', async i => {

            if (i.customId === 'confirm') {

                confirmed.add(i.user.id);
                await i.reply({ content: 'Confirmado.', ephemeral: true });

                if (confirmed.size === 2) {

                    const result = calculateElo(
                        data[ganador.id].mmr,
                        data[perdedor.id].mmr
                    );

                    data[ganador.id].mmr = result.winner;
                    data[perdedor.id].mmr = result.loser;

                    data[ganador.id].wins++;
                    data[perdedor.id].losses++;

                    const today = new Date().toISOString().split('T')[0];

                    data[ganador.id].history.push({
                        opponent: perdedor.id,
                        result: "win",
                        date: today
                    });

                    data[perdedor.id].history.push({
                        opponent: ganador.id,
                        result: "loss",
                        date: today
                    });

                    saveData(data);

                    await interaction.followUp('✅ Resultado confirmado y MMR actualizado.');
                    collector.stop();
                }
            }

            if (i.customId === 'cancel') {
                await interaction.followUp('❌ Resultado cancelado.');
                collector.stop();
            }
        });
    }
        
// 🔹 HISTORIAL
else if (interaction.commandName === 'historial') {

    const data = getData();
    const userId = interaction.user.id;

    ensurePlayer(data, userId);

    const history = data[userId].history;

    if (history.length === 0) {
        return interaction.reply('📭 No tienes partidas registradas.');
    }

    let message = '📜 **Tu historial reciente:**\n\n';

    const lastMatches = history.slice(-10).reverse();

    lastMatches.forEach(match => {
        const resultEmoji = match.result === "win" ? "🟢" : "🔴";
        message += `${resultEmoji} vs <@${match.opponent}> — ${match.date}\n`;
    });

    await interaction.reply(message);
}
    
    // 🔹 BUSCAR
    else if (interaction.commandName === 'buscar') {

        const user = interaction.user;
        ensurePlayer(data, user.id);
        saveData(data);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('aceptar')
                .setLabel('⚔️ Aceptar duelo')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
            content: `⚔️ ${user} busca 1v1\n🏆 ELO: **${data[user.id].mmr}**`,
            components: [row]
        });

        const filter = i =>
            i.customId === 'aceptar' &&
            i.user.id !== user.id;

        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 60000
        });

        collector.on('collect', async i => {

            const guild = interaction.guild;
            const player1 = user;
            const player2 = i.user;

            const category = await guild.channels.create({
                name: `DUEL ${player1.username} vs ${player2.username}`,
                type: ChannelType.GuildCategory
            });

            await category.permissionOverwrites.set([
                {
                    id: guild.roles.everyone.id,
                    deny: ['ViewChannel']
                },
                {
                    id: player1.id,
                    allow: ['ViewChannel', 'SendMessages', 'Connect', 'Speak']
                },
                {
                    id: player2.id,
                    allow: ['ViewChannel', 'SendMessages', 'Connect', 'Speak']
                }
            ]);

            await guild.channels.create({
                name: `duelo-${player1.username}-vs-${player2.username}`,
                type: ChannelType.GuildText,
                parent: category.id
            });

            await guild.channels.create({
                name: `🔊 duelo-${player1.username}-vs-${player2.username}`,
                type: ChannelType.GuildVoice,
                parent: category.id
            });

            await i.update({
                content: `🔥 Duelo creado entre ${player1} y ${player2}`,
                components: []
            });

            collector.stop();
        });
    }

});

client.login(TOKEN);


