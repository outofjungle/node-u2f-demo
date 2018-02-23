'use strict'

const Path = require('path')
const Hapi = require('hapi')
const Fs = require('fs')
const Database = require('./lib/database')
const Device = require('./lib/device')

var OPTS = {
  host: 'localhost',
  port: 4443,
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

var APP_ID = ''
if (process.env.GOOGLE_CLOUD_PROJECT) {
  APP_ID = 'https://' + process.env.GOOGLE_CLOUD_PROJECT + '.appspot.com'
  OPTS.port = process.env.PORT
  delete OPTS.host
  delete OPTS.tls
} else {
  APP_ID = 'https://' + OPTS.host + ':' + OPTS.port
}

const server = Hapi.server(OPTS)
const db = Database.dbInit(':memory:')

process.on('SIGINT', function () {
  server.stop({ timeout: 10000 }).then(function (err) {
    db.close()
    process.exit((err) ? 1 : 0)
  })
})

const provision = async () => {
  let options = {
    storeBlank: false,
    cookieOptions: {
      password: 'INSECUREINSECUREINSECUREINSECUREINSECUREINSECURE',
      isSecure: true
    }
  }

  await server.register(require('inert'))
  await server.register({
    plugin: require('yar'),
    options: options
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
    path: '/devices',
    handler: Device.listDevices(db)
  })

  server.route({
    method: 'GET',
    path: '/devices/{device}/register',
    handler: Device.registerRequest(db, APP_ID)
  })

  server.route({
    method: 'POST',
    path: '/devices/{device}/register',
    handler: Device.registerResponse(db)
  })

  server.route({
    method: 'GET',
    path: '/devices/{device}/auth',
    handler: Device.authRequest(db, APP_ID)
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
