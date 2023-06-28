# EmulatorJS-Netplay Server

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

License is located [here](#license)

## To use:

### Windows:

Go to the releases tab and download the latest release for windows and open the exe file:

* https://github.com/EmulatorJS/EmulatorJS-Netplay/releases/tag/latest

There is a GUI app version and a CLI version.
* The GUI version is recommended for most users.
* The CLI version is recommended for advanced users.

You can also download the source code and run `npm i` to install packages and then `npm start` to start the server.

### Linux:

Go to the releases tab and download the latest release for linux and open the AppImage file (you may need to make it executable):

* https://github.com/EmulatorJS/EmulatorJS-Netplay/releases/tag/latest

There is a AppImage version and a CLI version.
* The AppImage version is recommended for most users.
* The CLI version is recommended for advanced users.

### Docker:

You can also use docker to run the server this is recomended for production use you can also follow [these](#development) steps for a server.

Download the docker image:
```
docker pull allancoding/emulatorjs-netplay-server
```
Run the docker image:
```
docker run -p 3000:3000 -e NETPLAY_PASSWORD=admin123 -e NETPLAY_PORT=3000 allancoding/emulatorjs-netplay-server
```

### Docker Compose:

```
version: "3.9"
services:
  emulatorjs-netplay-server:
    image: allancoding/emulatorjs-netplay-server
    ports:
      - 3000:3000
    environment:
      - NETPLAY_PASSWORD=admin123
      - NETPLAY_PORT=3000
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

## Configurating the server

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

# LICENSE

Licenced under the Apache License 2.0

Read the whole license [here](LICENSE)
