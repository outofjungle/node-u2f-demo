#!/usr/bin/env node

'use strict'

const Path = require('path')
const Hapi = require('hapi')
const Fs = require('fs')
const Opts = require('commander')
const Database = require('./lib/database')
const Device = require('./lib/device')

Opts
  .version('0.2.0')
  .option('-d, --dbfile [dbfile]', 'database filename')
  .option('-p, --port [port]', 'port number')
  .parse(process.argv)

var dbfile = (Opts.dbfile) ? Opts.dbfile : ':memory:'
var port = (Opts.port) ? parseInt(Opts.port, 10) : 4443

var serverOpts = {
  host: 'localhost',
  port: port,
  tls: {
    key: Fs.readFileSync('./etc/insecure-key.pem'),
    cert: Fs.readFileSync('./etc/insecure-certificate.pem')
  },
  routes: {
    files: {
      relativeTo: Path.join(__dirname, 'web')
    }
  }
}

var appId = ''
if (process.env.GOOGLE_CLOUD_PROJECT) {
  appId = 'https://' + process.env.GOOGLE_CLOUD_PROJECT + '.appspot.com'
  serverOpts.port = process.env.PORT
  delete serverOpts.host
  delete serverOpts.tls
} else {
  appId = 'https://' + serverOpts.host + ':' + serverOpts.port
}

const server = Hapi.server(serverOpts)
const db = Database.dbInit(dbfile)

process.on('SIGINT', function () {
  server.stop({
    timeout: 10000
  }).then(function (err) {
    db.close()
    process.exit((err) ? 1 : 0)
  })
})

const provision = async () => {
  await server.register(require('inert'))
  await server.register({
    plugin: require('good'),
    options: {
      reporters: {
        console: [{
            module: 'good-console'
          },
          'stdout'
        ]
      }
    }
  })

  await server.register({
    plugin: require('yar'),
    options: {
      storeBlank: false,
      cookieOptions: {
        password: Math.random().toString(36) + Math.random().toString(36) + Math.random().toString(36),
        isSecure: true
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/',
    handler: {
      file: 'cli.html'
    }
  })

  server.route({
    method: 'GET',
    path: '/web/{param*}',
    handler: {
      directory: {
        path: Path.join(__dirname, 'web')
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/devices',
    handler: Device.listDevices(db)
  })

  server.route({
    method: 'DELETE',
    path: '/devices/{device}',
    handler: Device.deleteDevice(db)
  })

  server.route({
    method: 'GET',
    path: '/devices/{device}/register',
    handler: Device.registerRequest(db, appId)
  })

  server.route({
    method: 'POST',
    path: '/devices/{device}/register',
    handler: Device.registerResponse(db)
  })

  server.route({
    method: 'GET',
    path: '/devices/{device}/auth',
    handler: Device.authRequest(db, appId)
  })

  server.route({
    method: 'POST',
    path: '/devices/{device}/auth',
    handler: Device.authResponse(db)
  })

  await server.start()

  console.log('Server running at:', server.info.uri)
}

provision()
