//A shitty message collector, saves a whole guild into a file for GPT-2 to train on

const Discord = require("discord.js");
const client = new Discord.Client();
const fs = require("fs");

/*
function getLatestMessageInChannel(channelid) {
	var msg;
	chnl = client.channels.get(channelid);
	if (chnl.type !== "text") {
		throw("Not a text channel");
	};
	chnl.fetchMessages({ limit: 1 })
	.then(msgs => {
		msg = msgs.first(); //doesn't work because javascript is dog shit
	});
};

client.on("ready", () => {
	console.log("Ready");
	client.guilds.get("297864265681862656").channels.array().forEach(chnl => {
		if (chnl.type !== "text") {
			return;
		};
		msg = getLatestMessageInChannel(chnl.id);
		collectChannel(msg);
	});
});
*/

client.on("ready", () => {
	client.guilds.get("SERVER-ID-HERE").channels.array().forEach(chnl => {
		channel = client.channels.get(chnl.id);
		if (channel.type != "text") {
			return;
		}
		channel.fetchMessages({ limit: 1 })
			.then(msgs => {
				msg = msgs.first();
				collectChannel(msg)
					.then(error => {
						if (error) {
							console.log(error);
						};
						//process.exit();
					});
			});
	});
});

client.login("YOUR.DISCORD.TOKEN.HERE");

function collectChannel(lastmsg) {
	console.log("Collecting channel " + lastmsg.channel.name);
	return new Promise((returnp) => {
		try {
			let channel = client.channels.get(lastmsg.channel.id);
			let messages = [];
			collectChannelLoop(channel, messages, lastmsg.id).then(result => {
				let formatted = formatChannel(result);
				fs.appendFileSync("./" + lastmsg.guild.id + ".txt", formatted);
				returnp(undefined);
			});
		} catch (e) {
			returnp(e.stack.toString());
		}
	})
}

function collectChannelLoop(channel, messages, position) {  
	return new Promise((returnp) => {  
		channel.fetchMessages({limit: 100, before: position}).then(result => {  
			messages = messages.concat(result.array());
			try {
				position = result.last().id;
				console.log("Set last position to "+position);
			} catch (error) {
				console.log("No more messages in "+channel.name);
				returnp(messages);
			}
			if (messages.length >= 250000) {
				console.log("Collected "+messages.length+" messages");
				returnp(messages);  
			} else {  
				returnp(collectChannelLoop(channel, messages, position));
			}  
		}).catch(err => {  
			console.log(err);  
			returnp(messages);  
		})  
	});  
}

function formatChannel(data) {
	let formatted = "";  
	data.reverse();  
	let lastID = "0";  
	for (let entry of data) {  
		let shortID = entry.id;
		let channelID = entry.channel.id
		let cleanText = entry.cleanContent.replace(/\$:/g, ":").replace("@ai", "");
		formatted += `$:START ${channelID} ${lastID} ${entry.author.id} $: ${cleanText} $:END ${shortID} <EOM>\n\n`;
		lastID = shortID;  
	}  
	return formatted;  
}
