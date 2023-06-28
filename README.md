# EmulatorJS-Netplay Server

Working netplay server for https://github.com/emulatorjs/emulatorjs

## To use:

***Windows:***

Go to the releases tab and download the latest release for windows:

https://github.com/EmulatorJS/EmulatorJS-Netplay/releases/tag/latest

Then run the exe file.

***Other:***

Run `npm i` to install packages

And then `npm start` to start the server

Instructions on how to set up with emulatorjs are located [here](https://emulatorjs.org/docs4devs/Netplay.html)

Bugs may exist - open an issue if you find one


**Editing the password:**

The username is `admin` and you can set the password in the config `passwordforserver` value.

```json
{
    "passwordforserver" : "mypassword"
}
```


# LICENSE

Licenced under the Apache License 2.0

Read the whole license [here](LICENSE)
