const Promise = require('bluebird');

class TadaConsulManager {
  constructor(opts) {
    this.consul = opts.consul();
    this.consul_id = opts.consul_id;
    this.service_name = opts.service_name;
    this.dependencies = opts.dependencies || [];
    this.session = null;
    this.watchers = [];
    this.healthInterval = null;

    console.log('-----------------');
    console.log('END OF CONSTRUCTOR');
    console.log('this.consul_id', this.consul_id);
    console.log('this.service_name', this.service_name);
    console.log('this.dependencies', this.dependencies);
    console.log('-----------------');
  }

  setKeyValue(opts) {
    console.log('-----------------');
    console.log('setKeyValue', opts);
    console.log('-----------------');
    return new Promise((resolve, reject) => {
      this.consul.kv.set(opts, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  valueForKey(key) {
    console.log('-----------------');
    console.log('valueForKey', key);
    console.log('-----------------');
    return new Promise((resolve, reject) => {
      this.consul.kv.get(key, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  claimForMaster(session_id) {
    console.log('-----------------');
    console.log('claimForMaster', session_id);
    console.log('-----------------');
    return new Promise((resolve, reject) => {
      this.consul.kv.set(
        `locks/${this.service_name}`,
        'master', {
        acquire: session_id,
      }, (err, result) => {
        console.log('claimForMaster || => ', result)
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  createSession() {
    console.log('-----------------');
    console.log('createSession');
    console.log('-----------------');
    return new Promise((resolve, reject) => {
      this.consul.session.create(
        {
          ttl: '300s',
          lockdelay: '300s',
        },
        (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          this.session = result;
          resolve(result);
        }
      );
    });
  }

  registerService(opts) {
    console.log('-----------------');
    console.log('registerService', opts);
    console.log('-----------------');
    return new Promise((resolve, reject) => {
      this.consul.agent.service.register(
        Object.assign({}, { id: this.consul_id }, opts),
        (err, res) => {
          if (err) {
            reject(err);
            return;
          }
          console.log('registered with Consul');
          resolve(res);
        }
      );
    });
  }

  startHealthCheck(timer) {
    console.log('-----------------');
    console.log('startHealthCheck', timer);
    console.log('-----------------');
    return new Promise((resolve, reject) => {
      this.healthInterval = setInterval(() => {
        this.checkHealth();
      }, timer);

      resolve();
    });
  }

  destroySession() {
    return new Promise((resolve, reject) => {
      if (this.session && this.session.ID) {
        this.consul.session.destroy(
          this.session.ID,
          (err) => {
            console.log('session destroyed.');
            if (err) {
              reject(err);
              return;
            }
            resolve();
          }
        );
      }
    });
  }

  unregister() {
    console.log('-----------------');
    console.log('unregister');
    console.log('-----------------');
    return new Promise((resolve, reject) => {
      clearInterval(this.healthInterval);
      this.consul.agent.service.deregister(
        {
          id: this.consul_id,
        },
        (err) => {
          console.log('de-registered.');
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  destroy() {
    console.log('-----------------');
    console.log('destroy');
    console.log('-----------------');
    return this
      .unregister()
      .then(_ => this.destroySession());
  }

  checkHealth() {
    console.log('-----------------');
    console.log('checkHealth');
    console.log('-----------------');
    return new Promise((resolve, reject) => {
      this.consul.agent.check.pass({ id: `service:${this.consul_id}` }, err => {
        if (err) {
          reject(err);
          return;
        }
        console.log('told Consul that we are healthy');
        resolve();
      });
    });
  }

  isMaster() {
    return this
      .valueForKey(`locks/${this.service_name}`)
      .then(res => {
        if (res.Session === this.session.ID) {
          return true;
        }
        return false;
      });;
  }

  addWatcher(opts) {
    console.log('-----------------');
    console.log('addWatcher', opts);
    console.log('-----------------');
    const watcher = {
      name: opts.service,
      obj: null,
      known_data_instances: [],
    };

    const watcherObj = this.consul.watch({
      method: this.consul.health.service,
      options: opts,
    });

    watcherObj.on('change', data => {
      console.log('received discovery update:', data.length);
      watcher.known_data_instances = []
        .concat(data.map(entry => `http://${entry.Service.Address}:${entry.Service.Port}/`))
        .filter(entry => !!entry);
    });

    watcherObj.on('error', err => {
      console.error('watch error', err);
    });

    watcher.obj = watcherObj;

    this.watchers = this.watchers.concat(watcher);
  }

  getUrlForDependency(service) {
    console.log('-----------------');
    console.log('getUrlForDependency', service);
    console.log('-----------------');
    const dep = this.watchers.find(watcher => watcher.name === service);
    if (!!dep) {
      const instances = dep.known_data_instances;
      const randomNumber = Math.floor(Math.random() * instances.length);
      return instances[randomNumber];
    }

    return null;
  }

  watchDependencies() {
    console.log('-----------------');
    console.log('watchDependencies');
    console.log('-----------------');
    this.dependencies.forEach(dep => {
      this.addWatcher({
        service: dep,
        passing: true
      });
    });
  }

  setup(opts) {
    return this
      .registerService(opts)
      .then(_ => {
        console.log('STEP 1');
        return this.startHealthCheck(5 * 1000);
      })
      .then(_ => {
        console.log('STEP 2');
        return this.createSession();
      })
      .then(session => {
        console.log('STEP 3');
        return this.claimForMaster(session.ID);
      })
      .then(_ => {
        console.log('STEP 4');
        return this.watchDependencies();
      })
      .catch(err => {
        console.log(err);
        console.log('CATCH ERR > ', err.message);
        throw err;
      });
  }
}

module.exports = TadaConsulManager;