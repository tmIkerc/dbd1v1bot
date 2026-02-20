const {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const fs = require('fs');

const TOKEN = 'MTQ3NDIzNTkzMjI5ODE4NjgxNQ.GRNKAs.29MHMhVXSy7eym1p1OP-ZX0R0R13UDJcJwOJiE';
const RANKING_CHANNEL_NAME = 'ranking-1v1';
const DATA_FILE = './mmr.json';
let activeDuels = new Map();

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

function calculateElo(winnerMMR, loserMMR) {
    const K = 32;
    const expectedWin = 1 / (1 + Math.pow(10, (loserMMR - winnerMMR) / 400));
    return {
        winner: Math.round(winnerMMR + K * (1 - expectedWin)),
        loser: Math.round(loserMMR - K * (1 - expectedWin))
    };
}

async function updateRankingChannel(guild) {
    const channel = guild.channels.cache.find(c => c.name === RANKING_CHANNEL_NAME);
    if (!channel) return;

    const data = getData();
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);

    let leaderboard = '🔥 **RANKING 1v1** 🔥\n\n';

    sorted.forEach((player, index) => {
        leaderboard += `#${index + 1} <@${player[0]}> - ${player[1]} MMR\n`;
    });

    const messages = await channel.messages.fetch();
    await channel.bulkDelete(messages);

    await channel.send(leaderboard);
}

client.once(Events.ClientReady, () => {
    console.log(`Bot listo como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.isChatInputCommand()) return;

    const data = getData();

    // 🔹 MMR
    if (interaction.commandName === 'mmr') {
        const user = interaction.user.id;
        if (!data[user]) data[user] = 1000;
        saveData(data);
        await interaction.reply(`Tu MMR es: ${data[user]}`);
    }

    // 🔹 RESULTADO
    else if (interaction.commandName === 'resultado') {

        const ganador = interaction.options.getUser('ganador');
        const perdedor = interaction.options.getUser('perdedor');

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
            content: `Resultado propuesto:\n🏆 ${ganador}\n💀 ${perdedor}\n\nAmbos deben confirmar.`,
            components: [row]
        });

        const filter = i =>
            (i.user.id === ganador.id || i.user.id === perdedor.id);

        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 60000
        });

        let confirmed = new Set();

        collector.on('collect', async i => {

            if (i.customId === 'confirm') {

                confirmed.add(i.user.id);
                await i.reply({ content: 'Confirmado.', ephemeral: true });

                if (confirmed.size === 2) {

                    if (!data[ganador.id]) data[ganador.id] = 1000;
                    if (!data[perdedor.id]) data[perdedor.id] = 1000;

                    const result = calculateElo(data[ganador.id], data[perdedor.id]);

                    data[ganador.id] = result.winner;
                    data[perdedor.id] = result.loser;

                    saveData(data);

                    await interaction.followUp(
                        `✅ Resultado confirmado.\n🏆 ${ganador.username}: ${result.winner}\n💀 ${perdedor.username}: ${result.loser}`
                    );

                    await updateRankingChannel(interaction.guild);

const duelCategoryId = activeDuels.get(ganador.id);

if (duelCategoryId) {
    const duelCategory = interaction.guild.channels.cache.get(duelCategoryId);

    if (duelCategory) {
        await duelCategory.delete();
    }

    activeDuels.delete(ganador.id);
    activeDuels.delete(perdedor.id);
}
                    collector.stop();
                }
            }

            if (i.customId === 'cancel') {
                await interaction.followUp('❌ Resultado cancelado.');
                collector.stop();
            }
        });
    }

    // 🔹 BUSCAR 1V1
    else if (interaction.commandName === 'buscar') {

        const user = interaction.user;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('aceptar_duelo')
                .setLabel('⚔️ Aceptar duelo')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
            content: `⚔️ ${user} está buscando 1v1!\n¿Quién se atreve?`,
            components: [row]
        });

        const filter = i =>
            i.customId === 'aceptar_duelo' &&
            i.user.id !== user.id;

        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 60000
        });

collector.on('collect', async i => {

    const guild = interaction.guild;
    const player1 = user;
    const player2 = i.user;

    // Crear categoría
    const category = await guild.channels.create({
        name: `DUEL ${player1.username} vs ${player2.username}`,
        type: 4
    });

activeDuels.set(player1.id, category.id);
activeDuels.set(player2.id, category.id);

    // Permisos base
    await category.permissionOverwrites.set([
        {
            id: guild.roles.everyone,
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

    // Canal de texto
    await guild.channels.create({
        name: `duelo-${player1.username}-vs-${player2.username}`,
        type: 0,
        parent: category.id
    });

    // Canal de voz
    await guild.channels.create({
        name: `🔊 duelo-${player1.username}-vs-${player2.username}`,
        type: 2,
        parent: category.id
    });

    await i.update({
        content: `🔥 Duelo creado entre ${player1} y ${player2}.\nSe ha creado un canal privado.`,
        components: []
    });

    collector.stop();
});
    }

});

client.login(TOKEN);
