const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = 'MTQ3NDIzNTkzMjI5ODE4NjgxNQ.GjDbr6.Jyzq9LlqQoMLjOhIrgNXwQwqaA7EnLwkn12tsU';
const CLIENT_ID = '1474235932298186815';
const GUILD_ID = '1415822439325241416';

const commands = [
    new SlashCommandBuilder()
        .setName('mmr')
        .setDescription('Ver tu MMR'),

    new SlashCommandBuilder()
        .setName('resultado')
        .setDescription('Registrar resultado 1v1')
        .addUserOption(option =>
            option.setName('ganador')
                .setDescription('Jugador ganador')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('perdedor')
                .setDescription('Jugador perdedor')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Ver ranking'),

    new SlashCommandBuilder()
        .setName('buscar')
        .setDescription('Buscar 1v1 abierto')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Registrando comandos...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('Comandos registrados correctamente.');
    } catch (error) {
        console.error(error);
    }

    new SlashCommandBuilder()
    .setName('historial')
    .setDescription('Ver tu historial de partidas')
    
})();
