'use strict';

const Q = require('q');
const u2f = require('u2f');
const sqlite3 = require('sqlite3').verbose();

const APP_ID = 'https://localhost:4443'

const dbInit = (path) => {
  var sql = `CREATE TABLE IF NOT EXISTS u2f (
    device TEXT PRIMARY KEY,
    keyHandle TEXT,
    publicKey TEXT,
    certificate BLOB
  )`;

  let db = new sqlite3.Database(path);
  db.run(sql);
  return db;
}

const dbSelect = (db, sql, values) => {
  var deferred = Q.defer();
  db.all(sql, values, (err, rows) => {
    if (err) {
      deferred.reject(err);
    }
    deferred.resolve(rows);
  });
  return deferred.promise;
};

const dbExecute = (db, sql, values) => {
  var deferred = Q.defer();
  db.run(sql, values, function(err) {
    if (err) {
      deferred.reject(err);
    }
    deferred.resolve(true);
  });
  return deferred.promise;
};

const listDevices = (db) => {
  return function(request, h) {
    let sql = `SELECT device FROM u2f ORDER BY device`;
    return dbSelect(db, sql, []).then( function(devices) {
      console.log(devices);
      return h.response(devices).code(200);
    });
  };
};


const registerRequest = (db) => {
    return function(request, h) {
        const registerRequest = u2f.request(APP_ID);
        request.yar.set('device', { registerRequest: registerRequest });
        return h.response(registerRequest).code(200);
  };
};

const registerResponse = (db) => {
    return function(request, h) {
    const session = request.yar.get('device');
    const verify = u2f.checkRegistration(session.registerRequest, request.payload);
    console.log(verify);
    if (verify.successful) {

      let sql = `INSERT INTO u2f(device, keyHandle, publicKey, certificate) VALUES(?, ?, ?, ?)`;
      let values = [
        request.params.device,
        verify.keyHandle,
        verify.publicKey,
        verify.certificate
      ];

      return dbSelect(db, sql, values)
        .then( function() {
          return h.response().code(200);
        })
        .catch(function(err) {
          return h.response(err.message).code(400);
        });
    }
  };
};

const authRequest = (db) => {
  return function(request, h) {
    let sql = `SELECT * FROM u2f WHERE device=?`;
    let values = [request.params.device];
    return dbSelect(db, sql, values)
      .then( function(result) {
        const keyHandle = result[0].keyHandle
        const authRequest = u2f.request(APP_ID, keyHandle);
        request.yar.set('device', { authRequest: authRequest });
        return h.response(authRequest).code(200);
      })
      .catch(function(err) {
        return h.response(err.message).code(400);
      });
  };
}

const authResponse = (db) => {
  return function(request, h) {
    console.log(request.payload);

    let sql = `SELECT * FROM u2f WHERE device=?`;
    let values = [request.params.device];
    return dbSelect(db, sql, values)
      .then( function(result) {
        const session = request.yar.get('device');
        const publicKey = result[0].publicKey;
        const verify = u2f.checkSignature(session.authRequest, request.payload, publicKey);
        if (verify.successful) {
          return h.response().code(200);
        } else {

        }
      })
      .catch(function(err) {
        return h.response(err.message).code(400);
      });
  };
}

module.exports = {
    dbInit,
    listDevices,
    registerRequest,
    registerResponse,
    authRequest,
    authResponse
};
