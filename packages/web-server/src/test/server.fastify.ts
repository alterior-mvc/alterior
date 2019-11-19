
import * as fastify from 'fastify';

fastify()
    .post('/', async (req, res) => res.send({ saw: req.body.value }))
    .post('/exit', async (req, res) => (res.send({ ok: true }), process.exit(0)))
    .listen(3000)
;