// ^\$:START \d+ \d+ \d+ \$:  \$:END \d+ <EOM>$
// \b(.*)<EOM>

const py = require("python-shell")
const discord = require("discord.js")
const client = new discord.Client();

const prefix = "gpt:";

var talkchannels = ["CHANNEL_ID_HERE"];
var aishell;
var pythonRequests = [];
var activePythonRequest = false;
var commandCalled = false;

function launchGPT2() {
    return new Promise(fulfill => {  
        let options = {  
            args: ['--model_name', 'run1', '--top_k', '40', '--temperature', '0.9'],
            scriptPath: 'gpt-2',  
            mode: 'text',
            pythonPath: '/usr/bin/python3',
            pythonOptions: ['-u']  
        };  
        let pyshell = new py.PythonShell('src/interactive_conditional_samples.py', options);  
        pyshell.on('message', function (message) {  
            console.log("(GPT-2) " + message);  
            if (message.includes("$:ready")) {    
                fulfill(pyshell);  
            }  
            if (message.includes("$:prompt:")) {
                console.debug("Calling response handler on message: "+message)
                handleGPT2Response(message);
            }  
        });  
        pyshell.on('stderr', function (error) {  
            console.log(error);  
        });  
   });  
}

function sendGPT2(input, channel = null, message = null) {
    input.replace(/<:\w*:\d+>/gm, ""); //User emojis
    let newRequest = {input: input, channel: channel, message: message};  
    let id = pythonRequests.length;  
    pythonRequests.push(newRequest);  
    if (!activePythonRequest) {  
        try {  
            activePythonRequest = true;  
            aishell.send(id + "$:input:" + input);  
        } catch (e) {  
            activePythonRequest = false;  
            console.log(e);  
        }  
    }  
}

function handleGPT2Response(message) {
    console.debug("=======RESPONSE HANDLE=======");
    console.debug("Message: "+message);
    activePythonRequest = false;  
    let id = message.split("$:prompt:")[0];
    console.debug("ID: "+id);  
    let result = message.split("$:prompt:")[1];
    console.debug("Result: "+result); 
    let request = pythonRequests[id];
    let decoded = decodeChannel(result);
    if (!decoded) {
        messageHandler(pythonRequests[id].message);
        return;
    }
    console.log("Replying: "+decoded);
    client.channels.get(pythonRequests[id].channel).send(decoded);
    client.channels.get(pythonRequests[id].channel).stopTyping(true);
    if (id < (pythonRequests.length - 1)) {  
        let newID = parseInt(id) + 1;  
        request = pythonRequests[newID];  
        try {  
            aishell.send(newID + "$:input:" + request.input);  
            activePythonRequest = true;  
        } catch (e) {  
            console.log("Couldn't process next request: " + e);  
        }  
    }  
}

function encodeChannel(data) {
    let encoded = "";  
    data.reverse();  
    let lastID = "0";  
    for (let entry of data) {  
        let shortID = entry.id;
        let channelID = entry.channel.id; 
        let cleanText = entry.cleanContent.replace(/\$:/g, ":").replace("@ai", "");  
        encoded += `$:START ${channelID} ${lastID} ${entry.author.id} $: ${cleanText} $:END ${shortID} <EOM>\n\n`;  
        lastID = shortID;  
    }  
    return encoded;  
}

function searchArrayFor(str, array) {
    for (var j=0; j<array.length; j++) {
        if (array[j].match(str)) return j;
    }
    return -1;
}

function decodeChannel(data) {
    data = data.replace(/\B@\w+/gm, "") //Mentions
    data = data.replace(/(ftp|http|https):\/\/[^ "]+/gm, ""); //Links
    data = data.replace(/\$:START \d+ \d+ \d+ \$: *\$:END \d+ <EOM>/gm, ""); //Empty messages
    let decoded;
    console.debug("========DATA RECEIVED========\n"+data+"\n=============================");
    let entries = data.split("<EOM>");
    console.debug("=============================");
    console.debug("Entries: "+entries);
    entry = entries[searchArrayFor(/\$:START \d+ \d+ \d+ \$: .* \$:END \d+/gm, entries)];
    console.debug("Entry: "+entry);
    try {  
        entry = entry.trim();
        console.debug("Trimmed entry: "+entry);
        let points = entry.split("$:");  
        console.debug("Points: "+points);  
        let header = points[1].trim();
        console.debug("Header: "+header);
        let content = points[2].trim();
        console.debug("Content: "+content);
        if (/^START \d+ \d+ \d+$/.test(header)) {
            console.debug("Header tested");
            let user = header.split(" ")[2];
            console.debug("User: "+user);  
            decoded = content;
        };
    } catch (e) {
    }
    console.debug("Returning decoded: "+decoded);
    console.debug("=============================");
    return decoded;
}

function probability(n) {
    return !!n && Math.random() <= n;
};

function messageHandler(message) {
    let input = message.content;
    let id = message.id;
    message.channel.fetchMessages({ limit: 10 })
        .then(result => {
            let encoded = encodeChannel(result.array());
            console.debug("Received context");
            message.channel.startTyping();
            sendGPT2(encoded.replace(/\n/g, " "), message.channel.id, message);
        })
}

function commandHandler(message) {
    commandCalled = true;
    const args = message.content.slice(prefix.length).trim().split(' ');
    console.debug("Args: "+args);
    const command = args.shift().toLowerCase();
    console.debug("Command: "+command);
    if (command === "eval" && message.author.id === "552930095141224479") {
        if (/(?<=`)(.*)(?=`)/gm.test(message.content)) {
            console.debug("Evaluating command: " + message.content.match(/(?<=`)(.*)(?=`)/gm)[0]);
            try {
                let evalresult = eval(message.content.match(/(?<=`)(.*)(?=`)/gm)[0]);
                if (evalresult == undefined) {
                    evalresult = "undefined";
                };
                message.channel.send(evalresult);
            } catch (error) {
                message.channel.send(String(error));
            }
        } else {
            message.channel.send("Invalid format. Regex: `(?<=\`)(.*)(?=`)\`");
        }
    } else {
        message.channel.send("Unknown command.");
    }
    commandCalled = false;
}

client.on("ready", () => {
    console.log(`Logged into ${client.user.tag}`);
    console.log("Initialising GPT-2");
    launchGPT2()
    .then(pshell => {
        aishell = pshell;
    });
});

client.on("message", message => {
    if (message.content.startsWith(prefix) && !message.author.bot && message.author.id != client.user.id) {
        commandHandler(message);
    } else if (!commandCalled && talkchannels.indexOf(message.channel.id) > -1 && (probability(.25) || (message.author.id != client.user.id))) {
        messageHandler(message)
    }
})

client.login("YOUR.DISCORD.TOKEN.HERE");
