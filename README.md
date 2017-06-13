# Consul Sample Project

This project is a simple POC to deal with [Consul](https://www.consul.io/) using NodeJS and HAProxy, inspire by [tlhunter example](https://github.com/tlhunter/consul-haproxy-example)

The goal is only to launch multiple instance of two simple services to see how service discovery are implemented.

I also implemented a leader election following the consul documentation to elect one leader per type of service. As soon as a service is started, he's asking to be the leader and depending of the situation at the time he's asking, he will be or will not be elected.

There is actually 3 folders in this project.

## Consul Module folder

It's a module which encapsulate the NodeJS consul package.

## HAProxy folder

It is where you put the config for HAProxy.

To start it, only run

```
haproxy -f advanced.cfg
```

(You need to have HAProxy installed)


## Hello service folder

This is a simple service having a dependency to the service World which expose rest endpoint.

To start a service instance, simply run

```
cd ./helloservice
node index.js 2727
```

You can replace 2727 by whatever port you want.

You can run multiple instance on different port to observe service discovery.

There are 3 routes:

* ``` / ``` will retrieve you some data (I dont care of these data), what matter is that helloservice will perform a call to the service he needs, if some are up, one will be chosen else you'll get a **500 error saying no dependencies found**.

* ``` /infos ``` will give you the webpid of the process and if it is the master one or not (master = leader)

* ``` /health ``` will let you know if the node is healthy or not

## World service folder

Quite the same principle than the previous one, but World service dont have any service dependencies.

To start a service instance, simply run

```
cd ./worldservice
node index.js 3737
```

You can replace 3737 by whatever port you want.

You can run multiple instance on different port to observe service discovery.


There are 3 routes:

* ``` / ``` will retrieve you some dumb data

* ``` /infos ``` will give you the webpid of the process and if it is the master one or not (master = leader)

* ``` /health ``` will let you know if the node is healthy or not

## Get Started

First launch Consul
```
consul agent -dev
```

Then start HAProxy
```
haproxy -f ./haproxy/advanced.cfg
```

Finally start as much instance as you want of services (hello and world). Here we will start 1 instance of helloservice 2 of worldservice.

```
node ./helloservice/index.js 2727

node ./worldservice/index.js 3737
node ./worldservice/index.js 3738
```

## Further Work / Known issue

There is some known issues which need to be fixed, but it was not the purpose here:

* Stoping the master node will not lead to another "master election"

* Once the master node is killed, no nodes can become the master one during the session living time of the original master node (seems a session is not well killed or something like that after a SIGINT)

## License

Copyright (c) 2017 **reptilbud** Licensed under the MIT license
