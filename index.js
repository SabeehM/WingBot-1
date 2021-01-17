require('dotenv').config();

const intervalTIme = 13.5 * 1000;

const language = require('@google-cloud/language');

const client = new language.LanguageServiceClient();

const Discord = require('discord.js')
const config = require('./config')
const fs = require('fs');
const googleSpeech = require('@google-cloud/speech')

const googleSpeechClient = new googleSpeech.SpeechClient()
var cache = "";
const { Transform } = require('stream')
//process.setMaxListeners(0);
function convertBufferTo1Channel(buffer) {
    const convertedBuffer = Buffer.alloc(buffer.length / 2)

    for (let i = 0; i < convertedBuffer.length / 2; i++) {
        const uint16 = buffer.readUInt16LE(i * 4)
        convertedBuffer.writeUInt16LE(uint16, i * 2)
    }

    return convertedBuffer
}

class ConvertTo1ChannelStream extends Transform {
    constructor(source, options) {
        super(options)
    }

    _transform(data, encoding, next) {
        next(null, convertBufferTo1Channel(data))
    }
}

fs.writeFileSync('message.txt', "");
const discordClient = new Discord.Client()

discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`)
})

discordClient.login(config.discordApiToken)

var inCall = false;




async function sendConvoStarters(shouldWork, voiceChannel) {
    if (shouldWork) {
        console.log("10 seconds of slience");

        const document = {
            content: fs.readFileSync("message.txt"),
            type: 'PLAIN_TEXT',
        };


        const [result] = await client.analyzeEntities({ document });

        const entities = result.entities;

        if(entities.length > 0){
        var request = require('request');
        var options = {
        'method': 'GET',
        'url': 'https://newsapi.org/v2/top-headlines?apiKey='+process.env.newsAPI+'&language=en&q=' + entities[Math.floor(Math.random() * Math.floor(Math.min(3, entities.length)))].name,
        'headers': {
            'Cookie': '__cfduid=d957a891f4b2b40199e780230e705750b1610850999'
        }
        };
        request(options, function (error, response) {
        if (error) throw new Error(error);
        let ran = Math.max(0, Math.floor(Math.random() * Math.floor(JSON.parse(response.body).articles.length)) - 1);
        if (voiceChannel && JSON.parse(response.body).articles && JSON.parse(response.body).articles[ran]) {
            for (let member of voiceChannel.members) {
                if (member[1].user.username != "Wingbot") {
                    member[1].send(JSON.parse(response.body).articles[ran].title + "\n" + JSON.parse(response.body).articles[ran].url);
                }
            }
        } 
        else{
            for (let member of voiceChannel.members) {
                if (member[1].user.username != "Wingbot") {
                    member[1].send("You're loosing em bud, stir up a conversation, I'm here if you need me! :)");
                }
            }
        }
        });
    }

        entities.forEach(entity => {

            
        });
 
    }
    return await 1;
}

var timer = setInterval(sendConvoStarters.bind(null, inCall, null), intervalTIme);








discordClient.on("message", async function (newPresence) {
    console.log(process.env.newsAPI);
    const member = newPresence.member
    if (member) {
        const memberVoiceChannel = member.voice.channel
        if (newPresence.content.startsWith("~join")) {
            inCall = true;
            clearInterval(timer);
            timer = setInterval(sendConvoStarters.bind(null, inCall, memberVoiceChannel), intervalTIme);
            const connection = await memberVoiceChannel.join()
            const receiver = connection.receiver

            connection.on('speaking', (user, speaking) => {
                process.setMaxListeners(5);
                if (!speaking) {
                    return
                }

                //console.log(`I'm listening to ${user.username}`)
                const audioStream = receiver.createStream(user, { mode: 'pcm' })
                const requestConfig = {
                    encoding: 'LINEAR16',
                    sampleRateHertz: 48000,
                    languageCode: 'en-US'
                }
                const request = {
                    config: requestConfig
                }

                const recognizeStream = googleSpeechClient
                    .streamingRecognize(request)
                    .on('error', console.error)
                    .on('data', response => {
                        const transcription = response.results
                            .map(result => result.alternatives[0].transcript)
                        //console.log(`${user.username}: ${transcription}`)
                        if (cache[0] != transcription[0]) {
                            fs.appendFileSync('message.txt', transcription[0] + " ");
                            cache = transcription;
                            //  console.log(cache);
                        }

                    })

                const convertTo1ChannelStream = new ConvertTo1ChannelStream()

                audioStream.pipe(convertTo1ChannelStream).pipe(recognizeStream)
                audioStream.on('end', async () => {
                    clearInterval(timer);
                    timer = setInterval(sendConvoStarters.bind(null, inCall, memberVoiceChannel), intervalTIme);
                    // console.log(audioStream)
                })

            })
        }
        else if (newPresence.content.startsWith("~leave")) {
            inCall = false;
            clearInterval(timer);
            timer = setInterval(sendConvoStarters.bind(null, inCall, null), intervalTIme);
            memberVoiceChannel.leave();
            fs.writeFileSync('message.txt', "");
        }
    }
});

