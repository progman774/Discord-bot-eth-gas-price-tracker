import Web3 from 'web3';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events } from "discord.js";
import fs from "fs";

dotenv.config();

let data = JSON.parse(fs.readFileSync("./data.json", "utf-8"));

const save = (obj) => {
    let myJSON = JSON.stringify(obj);
    fs.writeFile(`./data.json`, myJSON, (err) => {
      if (err) console.log(err);
    });
};

let web3 = new Web3(
    `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`
);

const client = new Client({ intents: [GatewayIntentBits.Guilds] }); // discord.js handler
client.login(process.env.DISCORD_BOT_TOKEN);

client.on("ready", () => {
  console.log("Bot Ready!");
  initCommand();
  getGasPrice();
});


const initCommand = () => {
    try {
      client.application.commands.set([
        {
          name: "set",
          description: "Set Limit",
          type: 1,
          options: [
            {
              name: "limit",
              type: 3,
              description: "value",
              required: true,
            },
          ],
        },
        {
          name: "set_admin",
          description: "Set Limit For Channel",
          type: 1,
          options: [
            {
              name: "limit",
              type: 3,
              description: "value",
              required: true,
            },
          ],
        },
        {
          name: "stop",
          description: "Stop ETH Gas Price Tracker",
          type: 1,
          options: [],
        },
      ]);
    } catch (e) {
      console.log("Error in initCommand: " + e);
    }
};

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
  
    if (interaction.commandName === "set") {
        console.log("Set");
        const gasLimit = interaction.options.get("limit").value;
        const userId = interaction.user.id;

        await interaction.reply({
            content: "",
            embeds: [
              {
                type: "rich",
                color: 0x00ffff,
                title: `You set the limit price - ${gasLimit} for DM`,
              },
            ],
            ephemeral: true,
          });

        data[userId] = parseFloat(gasLimit);
        save(data);
    }
    if (interaction.commandName === "set_admin") {
        console.log("Set Admin");
        const gasLimit = interaction.options.get("limit").value;
        const userId = interaction.user.id;

        if(userId == process.env.ADMINID) {
            await interaction.reply({
              content: "",
              embeds: [
                {
                  type: "rich",
                  color: 0x00ffff,
                  title: `You set the limit price - ${gasLimit} for the channel`,
                },
              ],
              ephemeral: true,
            });
        } else {
            await interaction.reply({
              content: "",
              embeds: [
                {
                  type: "rich",
                  color: 0xff0000,
                  title: `You don't have a permission.`,
                },
              ],
              ephemeral: true,
            });
        }

        data[process.env.CHANNELID] = parseFloat(gasLimit);
        save(data);
    }
    if (interaction.commandName === "stop") {
      const userId = interaction.user.id;
      data[userId] = 0;
      save(data);
      
      await interaction.reply({
        content: "",
        embeds: [
          {
            type: "rich",
            color: 0x00ffff,
            title: `ETH Gas Price Tracker has stopped`,
          },
        ],
        ephemeral: true,
      });
    }
})

const fetchGasPrice = async () => {
    try {
        const response = await fetch(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.API_KEY}`);
        const res = (await response.json()).result;
        return {
            high: parseInt(res.FastGasPrice),
            avg: parseInt(res.ProposeGasPrice),
            low: parseInt(res.SafeGasPrice),
        }
    } catch (e) {
        console.log("API Error: " + e)
        return {
            high: 100,
            avg: 100,
            low: 100,
        }
    }
}

let prev = {}
const delay = (ms) => new Promise((res) => setTimeout(res, ms)); // delay time
const getGasPrice = async () => {
    let price = await fetchGasPrice();
    console.log(price);
    if(prev.high != price.high || prev.avg != price.avg || prev.low != price.low) {
        prev = price;
        
        const router = new web3.eth.Contract([
            {
                "inputs":
                [
                    {
                        "internalType":"uint256",
                        "name":"amountIn",
                        "type":"uint256"
                    },
                    {
                        "internalType":"address[]",
                        "name":"path",
                        "type":"address[]"
                    }
                ],
                "name":"getAmountsOut",
                "outputs":
                [
                    {
                        "internalType":"uint256[]",
                        "name":"amounts",
                        "type":"uint256[]"
                    }
                ],
                "stateMutability":"view",
                "type":"function"
            }
        ],'0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D')

        let ethPrice = (await router.methods.getAmountsOut(1e9, [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            "0x6b175474e89094c44da98b954eedeac495271d0f",
        ]).call())[1];
        ethPrice = parseInt(ethPrice) / 1e18;
        
        for(const key in data) {
            if(price.low > data[key]) continue;
            const channel = client.channels.cache.get(process.env.CHANNELID);
            if(key == process.env.CHANNELID) {
                channel.send({
                    content: "",
                    embeds: [
                    {
                        type: "rich",
                        color: 0x800080,
                        title: "⛽Gas Price",
                        fields: [
                          {
                            name: `**Slow** 🐢 (~10min)`,
                            value: `${price.low} Gwei (US$ ${(ethPrice * price.low * 20000).toFixed(2)})\nOpenSea: $${(ethPrice * price.low * 72000).toFixed(2)}`,
                            inline: true,
                          },
                          {
                            name: `**Average** 🚶‍♂️ (~3min)`,
                            value: `${price.avg} Gwei (US$ ${(ethPrice * price.avg * 20000).toFixed(2)})\nOpenSea: $${(ethPrice * price.avg * 72000).toFixed(2)}`,
                            inline: true,
                          },
                          {
                            name: `**Fast** ⚡ (~30sec)`,
                            value: `${price.high} Gwei (US$ ${(ethPrice * price.high * 20000).toFixed(2)})\nOpenSea: $${(ethPrice * price.high * 72000).toFixed(2)}`,
                            inline: true,
                          },
                        ]
                    },
                    ],
                })
            } else {
              try {
                const member = await client.users.fetch(key);
                member.send({
                    content: "",
                    embeds: [
                        {
                        type: "rich",
                        color: 0x800080,
                        title: "⛽Gas Price",
                        fields: [
                          {
                            name: `**Slow** 🐢 (~10min)`,
                            value: `${price.low} Gwei (US$ ${(ethPrice * price.low * 20000).toFixed(2)})\nOpenSea: $${(ethPrice * price.low * 72000).toFixed(2)}`,
                            inline: false,
                          },
                          {
                            name: `**Average** 🚶‍♂️ (~3min)`,
                            value: `${price.avg} Gwei (US$ ${(ethPrice * price.avg * 20000).toFixed(2)})\nOpenSea: $${(ethPrice * price.avg * 72000).toFixed(2)}`,
                            inline: false,
                          },
                          {
                            name: `**Fast** ⚡ (~30sec)`,
                            value: `${price.high} Gwei (US$ ${(ethPrice * price.high * 20000).toFixed(2)})\nOpenSea: $${(ethPrice * price.high * 72000).toFixed(2)}`,
                            inline: false,
                          },
                        ]
                        },
                    ],
                })
              } catch (e) {
                console.log(e);
              }
            }
        }
    }
    await delay(1000 * 6);
    getGasPrice()
}