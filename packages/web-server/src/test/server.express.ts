import express from 'express';
import bodyParser from 'body-parser';

express()
    .use(bodyParser.json())
    .post('/', (req, res) => {
        res.send({ saw: req.body.value });
    })
    .post('/exit', () => {
        process.exit(0);
    })
    .listen(3000)
;