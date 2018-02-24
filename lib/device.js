'use strict'

const u2f = require('u2f')
const database = require('./database')

const listDevices = (db) => {
  return function (request, h) {
    let sql = `SELECT device FROM u2f ORDER BY device`
    return database.dbSelect(db, sql, []).then(function (devices) {
      console.log(devices)
      return h.response(devices).code(200)
    })
  }
}

const deleteDevice = (db) => {
  return function (request, h) {
    let sql = `SELECT * FROM u2f WHERE device=?`
    let values = [request.params.device]
    return database.dbSelect(db, sql, values)
    .then(function (result) {
      if (result.length === 0) {
        return h.response('device named "' + request.params.device + '" not found').code(404)
      }

      let sql = `DELETE FROM u2f WHERE device=?`
      let values = [request.params.device]
      return database.dbExecute(db, sql, values).then(function () {
        return h.response().code(200)
      })
    })
    .catch(function (err) {
      return h.response(err.message).code(400)
    })
  }
}

const registerRequest = (db, appId) => {
  return function (request, h) {
    const registerRequest = u2f.request(appId)
    request.yar.set('device', { registerRequest: registerRequest })
    return h.response(registerRequest).code(200)
  }
}

const registerResponse = (db) => {
  return function (request, h) {
    const session = request.yar.get('device')
    const verify = u2f.checkRegistration(session.registerRequest, request.payload)
    console.log(verify)
    if (verify.successful) {
      let sql = `INSERT INTO u2f(device, keyHandle, publicKey, certificate) VALUES(?, ?, ?, ?)`
      let values = [
        request.params.device,
        verify.keyHandle,
        verify.publicKey,
        verify.certificate
      ]

      return database.dbExecute(db, sql, values)
      .then(function () {
        return h.response().code(200)
      })
      .catch(function (err) {
        return h.response(err.message).code(400)
      })
    }
  }
}

const authRequest = (db, appId) => {
  return function (request, h) {
    let sql = `SELECT * FROM u2f WHERE device=?`
    let values = [request.params.device]
    return database.dbSelect(db, sql, values)
    .then(function (result) {
      const keyHandle = result[0].keyHandle
      const authRequest = u2f.request(appId, keyHandle)
      request.yar.set('device', { authRequest: authRequest })
      return h.response(authRequest).code(200)
    })
    .catch(function (err) {
      return h.response(err.message).code(400)
    })
  }
}

const authResponse = (db) => {
  return function (request, h) {
    console.log(request.payload)

    let sql = `SELECT * FROM u2f WHERE device=?`
    let values = [request.params.device]
    return database.dbSelect(db, sql, values)
    .then(function (result) {
      const session = request.yar.get('device')
      const publicKey = result[0].publicKey
      const verify = u2f.checkSignature(session.authRequest, request.payload, publicKey)
      if (verify.successful) {
        return h.response().code(200)
      } else {

      }
    })
    .catch(function (err) {
      return h.response(err.message).code(400)
    })
  }
}

module.exports = {
  listDevices,
  registerRequest,
  registerResponse,
  authRequest,
  authResponse,
  deleteDevice
}
