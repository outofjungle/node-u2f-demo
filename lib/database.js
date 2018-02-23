'use strict'

const Q = require('q')
const sqlite3 = require('sqlite3').verbose()

const dbInit = (path) => {
  var sql = `CREATE TABLE IF NOT EXISTS u2f (
    device TEXT PRIMARY KEY,
    keyHandle TEXT,
    publicKey TEXT,
    certificate BLOB
  )`

  let db = new sqlite3.Database(path)
  db.run(sql)
  return db
}

const dbSelect = (db, sql, values) => {
  var deferred = Q.defer()
  db.all(sql, values, (err, rows) => {
    if (err) {
      deferred.reject(err)
    }
    deferred.resolve(rows)
  })
  return deferred.promise
}

const dbExecute = (db, sql, values) => {
  var deferred = Q.defer()
  db.run(sql, values, function (err) {
    if (err) {
      deferred.reject(err)
    }
    deferred.resolve(true)
  })
  return deferred.promise
}

module.exports = {
  dbInit: dbInit,
  dbSelect: dbSelect,
  dbExecute: dbExecute
}
