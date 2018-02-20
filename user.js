'use strict';

const u2f = require('u2f');
const Q = require('q');
const APP_ID = 'https://localhost:4443'

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

const addUser = (db) => {
    return function(request, h) {
      console.log(request.payload);

      let sql = `INSERT INTO u2f(user) VALUES(?)`;
      let values = [request.payload.user]
      return dbExecute(db, sql, values)
        .then( function() {
          return h.response().code(200);
        });
    };
};

const listUsers = (db) => {
  return function(request, h) {
    let sql = `SELECT DISTINCT user FROM u2f ORDER BY user`;
    return dbSelect(db, sql, []).then( function(users) {
      return h.response(users).code(200);
    });
  };
};


const registerRequest = (db) => {
    return function(request, h) {
    const registerRequest = u2f.request(APP_ID);
    request.yar.set('user', { registerRequest: registerRequest });
    return h.response(registerRequest).code(200);
  };
};

const registerResponse = (db) => {
    return function(request, h) {
    const session = request.yar.get('user');
    const verify = u2f.checkRegistration(session.registerRequest, request.payload);
    console.log(verify);
    if (verify.successful) {

      let sql = `INSERT INTO u2f(user, keyHandle, publicKey, certificate) VALUES(?, ?, ?, ?)`;
      let values = [
        'u2fuser',
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
    let sql = `SELECT * FROM u2f WHERE user=?`;
    let values = ['u2fuser'];
    return dbSelect(db, sql, values)
      .then( function(result) {
        const keyHandle = result[0].keyHandle
        const authRequest = u2f.request(APP_ID, keyHandle);
        request.yar.set('user', { authRequest: authRequest });
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

    let sql = `SELECT * FROM u2f WHERE user=?`;
    let values = ['u2fuser'];
    return dbSelect(db, sql, values)
      .then( function(result) {
        const session = request.yar.get('user');
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
    addUser,
    listUsers,
    registerRequest,
    registerResponse,
    authRequest,
    authResponse
};
