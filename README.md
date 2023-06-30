# EmulatorJS Netplay Server

Working netplay server for https://github.com/EmulatorJS/emulatorJS

Instructions on how to set up with EmulatorJS are located [here](https://emulatorjs.org/docs4devs/Netplay.html)

Bugs may exist - open an [issue](https://github.com/EmulatorJS/EmulatorJS-Netplay/issues) if you find one

Supports:
* [Windows](#windows)
* [Linux](#linux)
* [Docker](#docker)
* [Docker Compose](#docker-compose)

Development instructions are located [here](#development)

Configurating the server is located [here](#configurating-the-server)

Building instructions are located [here](#building)

License is located [here](#license)

## To use:

### Windows:

Go to the releases tab and download the [latest release](https://github.com/EmulatorJS/EmulatorJS-Netplay/releases/tag/latest) for windows and open the exe file.

There is a GUI app version and a CLI version.
* The GUI version is recommended for most users.
* The CLI version is recommended for advanced users.

You can also download the source code and run `npm i` to install packages and then `npm start` to start the server.

### Linux:

Go to the releases tab and download the [latest release](https://github.com/EmulatorJS/EmulatorJS-Netplay/releases/tag/latest) for linux and open the AppImage file (you may need to make it executable).

There is a AppImage version and a CLI version.
* The AppImage version is recommended for most users.
* The CLI version is recommended for advanced users.

### Docker:

You can also use docker to run the server this is recomended for production use you can also follow [these](#development) steps for a server.

Download the docker image:
```
docker pull ghcr.io/emulatorjs/emulatorjs-netplay/emulatorjs-netplay-server:latest
```
Run the docker image:
```
docker run -p 3000:3000 -e NETPLAY_PASSWORD=admin123 -e NETPLAY_PORT=3000 -e NETPLAY_DEV=false ghcr.io/emulatorjs/emulatorjs-netplay/emulatorjs-netplay-server:latest
```

### Docker Compose:

To run the server with docker compose you can use this docker-compose.yml file:

```
version: "3.9"
services:
  emulatorjs-netplay-server:
    image: ghcr.io/emulatorjs/emulatorjs-netplay/emulatorjs-netplay-server:latest
    ports:
      - 3000:3000
    environment:
      - NETPLAY_PASSWORD=admin123
      - NETPLAY_PORT=3000
      - NETPLAY_DEV=false
```

Then run:
```
docker-compose up
```

### Development:

Clone the repo:

```
git clone https://github.com/EmulatorJS/EmulatorJS-Netplay.git
```

Install packages:
```
npm i
```
Start the server:
```
npm start
```
You can also use the flags `-p` for port and `-a` for password:
```
npm start -- -p 8080 -a admin
```
You can add the flag `-d` to run the server in dev mode.
```
npm start -- -p 3000 -a admindev -d
```
You can also run the dev version with:
```
npm run dev
```
You can run the GUI version with:
```
npm run app
```
You can run the help with the flag `-h`

## Configurating the server

Notes:
* Changing the password is recommended.

Config priority:
* Flags
* Environment variables
* Config file

**Editing the password:**

The username is `admin` and the defalt password is `admin123` you can change the password in the *config.json* `password` value.

```json
{
    "password" : "admin123"
}
```
You can also change the password by setting environment variable `NETPLAY_PASSWORD` to the password you want to use.

**Editing the port:**

The default port is `3000` you can change the port in the *config.json* `port` value.

```json
{
    "port" : 3000
}
```
You can also change the port by setting environment variable `NETPLAY_PORT` to the port you want to use.

**Running in dev mode:**

You can run the server in dev mode by setting the `dev` value to `true` in the *config.json* file.

```json
{
    "dev" : true
}
```
You can also run the server in dev mode by setting the environment variable `NETPLAY_DEV` to `true`.

### Building

You can build:
* Windows: `npm run build-win`
* Linux: `npm run build-linux`
* Docker: `npm run build-docker`
# LICENSE

Licenced under the Apache License 2.0

Read the whole license [here](LICENSE)
