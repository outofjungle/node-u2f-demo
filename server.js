'use strict';

const Path = require('path');
const Hapi = require('hapi');
const fs = require('fs');
const user = require('./user');
const sqlite3 = require('sqlite3').verbose();

let options = {
    storeBlank: false,
    cookieOptions: {
        password: 'INSECUREINSECUREINSECUREINSECUREINSECUREINSECURE',
        isSecure: true
    }
};

var tls = {
  key: fs.readFileSync('./etc/insecure-key.pem'),
  cert: fs.readFileSync('./etc/insecure-certificate.pem')
};

var sql = `CREATE TABLE IF NOT EXISTS u2f (
  user TEXT PRIMARY KEY,
  keyHandle TEXT,
  publicKey TEXT,
  certificate BLOB
)`;

let db = new sqlite3.Database(':memory:');
db.run(sql);

const server = Hapi.server({
    host: 'localhost',
    port: 4443,
    tls: tls,
    routes: {
        files: {
            relativeTo: Path.join(__dirname, 'web')
        }
    }
});

process.on('SIGINT', function () {
  server.stop({ timeout: 10000 }).then(function (err) {
    db.close();
    process.exit((err) ? 1 : 0);
  })
})

const provision = async () => {

    await server.register(require('inert'));
    await server.register({
      plugin: require('yar'),
      options: options
    });

    server.route({
      method: 'GET',
      path: '/',
      handler: {
        file: 'cli.html'
      }
    });

    server.route({
      method: 'POST',
      path: '/users',
      handler: user.addUser(db)
    });

    server.route({
      method: 'GET',
      path: '/users',
      handler: user.listUsers(db)
    });

    server.route({
        method: 'GET',
        path: '/register/user',
        handler: user.registerRequest(db)
    });

    server.route({
        method: 'POST',
        path: '/register/user',
        handler: user.registerResponse(db)
    });

    server.route({
        method: 'GET',
        path: '/auth/user',
        handler: user.authRequest(db)
    });

    server.route({
        method: 'POST',
        path: '/auth/user',
        handler: user.authResponse(db)
    });


    await server.start();

    console.log('Server running at:', server.info.uri);
};

provision();
