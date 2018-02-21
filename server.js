'use strict';

const Path = require('path');
const Hapi = require('hapi');
const fs = require('fs');
const device = require('./lib/device');

let db = device.dbInit(':memory:');

var tls = {
  key: fs.readFileSync('./etc/insecure-key.pem'),
  cert: fs.readFileSync('./etc/insecure-certificate.pem')
};

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
    let options = {
        storeBlank: false,
        cookieOptions: {
            password: 'INSECUREINSECUREINSECUREINSECUREINSECUREINSECURE',
            isSecure: true
        }
    };

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
      method: 'GET',
      path: '/devices',
      handler: device.listDevices(db)
    });

    server.route({
        method: 'GET',
        path: '/devices/{device}/register',
        handler: device.registerRequest(db)
    });

    server.route({
        method: 'POST',
        path: '/devices/{device}/register',
        handler: device.registerResponse(db)
    });

    server.route({
        method: 'GET',
        path: '/devices/{device}/auth',
        handler: device.authRequest(db)
    });

    server.route({
        method: 'POST',
        path: '/devices/{device}/auth',
        handler: device.authResponse(db)
    });

    await server.start();

    console.log('Server running at:', server.info.uri);
};

provision();
