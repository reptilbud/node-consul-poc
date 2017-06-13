const consul = require('consul');
const ConsulService = require('./service');

class ConsulModule {
  constructor() {
    this.services = {};
  }

  createService(opts) {
    const service = new ConsulService(Object.assign({}, { consul }, opts));
    this.services[opts.consul_id] = service;
    return service;
  }

  getService(consul_id) {
    return this.services[consul_id];
  }
}
 
module.exports = new ConsulModule();