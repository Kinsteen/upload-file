import express from 'express';
import { authenticator } from 'otplib';
import crypto from 'crypto';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import { config } from 'dotenv';
import pino from 'pino';

config();

const logger = pino({prettyPrint: {
    colorize: true,
    ignore: "hostname,pid",
    translateTime: "SYS:standard"
}})

const secret = process.env.SECRET as string;

type Token = {
    value: string,
    date: number
}

const validTokens: Token[] = []

const app = express();
const port = 3000;

let lastAttempt: number;

app.use(express.urlencoded({"extended": true}))
app.use(fileUpload())
app.use((req, res, next) => {
    for (let i = validTokens.length - 1; i >= 0; i--) {
        const oldDate = new Date(validTokens[i].date)
        const actualDate = new Date()
        const diff = actualDate.getTime() - oldDate.getTime()

        if (diff >= 1000*60*3) { // 10 minutes
            validTokens.splice(i, 1)
        }
    }
    next();
})

app.post('/login', (req, res) => {
    const a = async () => {
        const sleep = (millis: number) => {
            return new Promise(resolve => setTimeout(resolve, millis));
        }

        let delay = 1000 * 3; // 3s
        if (Date.now() - lastAttempt < delay) {
            logger.info('sleeping...')
            await sleep(delay - (Date.now() - lastAttempt))
        }

        const isValid = authenticator.check(req.body.totp, secret);
        if (isValid) {
            crypto.randomBytes(48, function(err, buffer) {
                const token = buffer.toString('hex');
                res.send(token)
                validTokens.push({value: token, date: Date.now()})
                logger.info('Successful login with token ' + token)
            });
        }
        else {
            lastAttempt = Date.now()
            res.send('not ok')
            logger.error('Wrong login!')
        }
    }

    a()
});

app.post('/upload', (req, res) => {
    const token = req.header("Token")
    const validToken = validTokens.find(element => element.value == token)

    if (validToken) {
        if (req.files) {
            const data = req.files['data'] as fileUpload.UploadedFile;
            const dest = 'public/' + data.name
            data.mv(dest)
            logger.info('Uploaded file to ' + dest)
        }
    } else {
        logger.error("Token invalid.")
        res.send('invalid token')
    }

    res.end()
})

app.get('/pull/:file', (req, res) => {
    const token = req.header("Token")
    const validToken = validTokens.find(element => element.value == token)

    if (validToken) {
        if (fs.existsSync('./public/' + req.params.file)) {
            logger.info('file asked: ' + req.params.file)
            res.sendFile('./public/' + req.params.file, {root: '.'})
        } else {
            logger.warn('Requested file ' + req.params.file + ', but wasn\'t found')
            res.send('not found')
        }
    } else {
        logger.error("Token invalid.")
        res.send('invalid token')
    }
})

app.get('/list', (req, res) => {
    const token = req.header("Token")
    const validToken = validTokens.find(element => element.value == token)

    let result = ""

    if (validToken) {
        logger.info("Did ls.")
        fs.readdirSync("./public/").forEach(file => {
            result += file + "\n"
        });
    } else {
        logger.error("Token invalid.")
        result = "invalid token"
    }

    res.send(result)
})

app.listen(port, () => {
  return logger.info(`server is listening on ${port}`);
});
