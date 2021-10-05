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

app.use(express.urlencoded({ "extended": true }))
app.use(fileUpload())
app.use((req, res, next) => {
    for (let i = validTokens.length - 1; i >= 0; i--) {
        const oldDate = new Date(validTokens[i].date)
        const actualDate = new Date()
        const diff = actualDate.getTime() - oldDate.getTime()

        if (diff >= 1000*60*3) { // 3 minutes
            validTokens.splice(i, 1)
        }
    }
    next()
})

app.get('/', (req, res) => {
    res.download('./shell/upload.sh', 'upload.sh')
    logger.info('Someone downloaded the script')
})

app.post('/login', (req, res) => {
    (async () => {
        const sleep = (millis: number) => {
            return new Promise(resolve => setTimeout(resolve, millis))
        }

        let delay = 1000 * 3; // 3s
        if (Date.now() - lastAttempt < delay) {
            logger.info('sleeping...')
            await sleep(delay - (Date.now() - lastAttempt)) // Block the login function if there was an incorrect login before
        }

        const isValid = authenticator.check(req.body.totp, secret);
        if (isValid) {
            crypto.randomBytes(48, function(err, buffer) {
                const token = buffer.toString('hex')
                res.send(token)
                validTokens.push({value: token, date: Date.now()})
                logger.info('Successful login')
            });
        } else {
            lastAttempt = Date.now()
            res.send('not ok')
            logger.error('Wrong login!')
        }
    })()
});

app.post('/upload', (req, res) => {
    const token = req.header("Token")
    const validToken = validTokens.find(element => element.value == token)

    if (validToken) {
        if (req.files) {
            const data = req.files['data'] as fileUpload.UploadedFile
            const dest = 'public/' + data.name.replace('..', '')
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
    const file = req.params.file.replace('..', '')

    if (validToken) {
        if (fs.existsSync('./public/' + file)) {
            logger.info('file asked: ' + file)
            res.sendFile('./public/' + file, {root: '.'})
        } else {
            logger.warn(`Requested file ${file}, but wasn't found`)
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

    if (validToken) {
        logger.info("Did ls.")
        let result = ""
        fs.readdirSync("./public/").forEach(file => {
            result += file + "\n"
        });
        res.send(result)
    } else {
        logger.error('Token invalid.')
        res.send('invalid token')
    }
})

app.listen(port, () => {
    return logger.info(`Server is listening on ${port}`)
});
