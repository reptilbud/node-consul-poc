#!/usr/bin/env node

const express = require('express');
const request = require('request');
const ConsulModule = require('../consul-module');

const app = express();

const PID = process.pid;
const HOST = require('os').hostname();
const PORT = Math.floor(process.argv[2]);
const consul_id = `www-${HOST}-${PORT}-${require('uuid').v4()}`;

function getData(cb) {
  const service = ConsulModule.getService(consul_id);
  const url = service.getUrlForDependency('worldservice');
  if (!url) {
    cb('No dependencies found');
    return;
  }
  
  request(
    url,
    { json: true },
    (err, res, data) => {
      if (err) {
        return cb(err);
      }
      cb(null, data);
    }
  );
}

app.get('/', (req, res) => {
  console.log('GET /', Date.now());
  getData((err, data) => {
    if (err) {
      res
        .status(500)
        .json({ error: err });
      return;
    }

    res
      .status(200)
      .json({
        data,
        web_pid: PID
      });
  });
});

app.get('/health', (req, res) => {
  console.log('GET /health', Date.now());
  res.send('ok');
});

app.get('/infos', (req, res) => {
  console.log('GET /infos', Date.now());
  const service = ConsulModule.getService(consul_id);
  service
    .isMaster()
    .then(is_master => {
      res.json({ web_pid: PID, is_master }).status(200);
    })
    .catch(err => {
      console.log('Error :: ', err);
      res.status(500).json({ error: err });
    });
});

app.listen(PORT, () => {
  const service = ConsulModule
    .createService({
      consul_id,
      service_name: 'helloservice',
      dependencies: ['worldservice'],
    });

  service
    .setup({
      name: 'helloservice',
      address: `${HOST}.in.tdw`,
      check: {
        ttl: '10s',
        deregister_critical_service_after: '1m'
      },
      port: PORT
    })
    .then(res => {
      console.log('<=== ALL SETUP ===> ', res);
    })
    .catch(err => {
      console.log('<=== ERR IN INDEX.JS ===> ', err);
    });
  
  process.on('SIGINT', () => {
    console.log('SIGINT. De-Registering...');
    ConsulModule
      .getService(consul_id)
      .destroy()
      .then(_ => {
        console.log('de-registered.');
        process.exit();
      })
      .catch(err => {
        console.log('GOT ERR => ', err);
        process.exit();
      });
  });
});
