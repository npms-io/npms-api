# Deploys

We use `pm2` to deploy `npms-api`, install it by running `$ npm install -g pm2`. You may find the pm2 configuration file in `ecosystem.json5`.

## Setting up

Before doing the first deploy, you need to setup the server. All commands executed in the server are expected to be run with `www` user.

- Create the `www` user on server
- Add `www` user to the list of sudoers
- Install pm2 in the server
- Setup the deploy environment by running `$ pm2 deploy ecosystem.json5 production setup` in your local machine
- Create `~/npms-api/local.json5` in the server with the custom configuration (elasticsearch host, etc)
- Do your first deploy by running `$ pm2 deploy ecosystem.json5 production` in your local machine
- Setup logrotate by running `$ sudo pm2 logrotate -u www` on the server (NOTE: currently pm2 has a bug that does not respect the user, please edit `/etc/logrotate.d/pm2-www` and change `/root` to `/home/www`)
- Setup pm2 to run at start by running `$ sudo pm2 startup -u www --hp "/home/www"` on the server
- Finally run `$ pm2 save` to store the running processes.

## Deploying

Deployment is easy, just run `$ pm2 deploy ecosystem production` in your local machine
