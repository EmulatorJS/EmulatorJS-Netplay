module.exports = {
    packagerConfig: {
        icon: './icon.png',
        executableName: 'EmulatorJS-Netplay',
        protocols: [{
            name: 'EmulatorJS-Netplay',
            schemes: ['emulatorjs-netplay']
        }]
    },
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                authors: 'EmulatorJS',
                description: 'EmulatorJS Netplay',
                iconUrl: 'https://raw.githubusercontent.com/EmulatorJS/EmulatorJS/master/icon.png',
                setupIcon: './icon.ico',
                certificateFile: './cert.pfx',
                certificatePassword: process.env.CERT_PASSWORD,
                mimeType: ['x-scheme-handler/emulatorjs-netplay']
            }
        },
        { name: '@electron-forge/maker-zip' },
        { 
            name: '@electron-forge/maker-deb',
            config: {
                options: {
                    name: 'EmulatorJS-Netplay',
                    productName: 'EmulatorJS-Netplay',
                    maintainer: 'EmulatorJS',
                    homepage: 'https://emulatorjs.org',
                    icon: './icon.png',
                    bin: 'EmulatorJS-Netplay',
                },
                mimeType: ['x-scheme-handler/emulatorjs-netplay']
            }
        },
        {
            name: '@electron-forge/maker-dmg',
            config: {
                backgroundColor: '#000000',
                format: 'ULFO',
                bin: 'EmulatorJS-Netplay',
                icon: './icon.icns',
                category: "public.app-category.utilities",
            }
        },
        {
            name: '@rabbitholesyndrome/electron-forge-maker-portable',
            config: {
                appId: "com.emulatorjs.netplay",
                icon: './icon.ico',
            },
        },
        {
            name: '@reforged/maker-appimage',
            config: {
                options: {
                    name: "EmulatorJS-Netplay",
                    bin: "EmulatorJS-Netplay",
                    productName: "EmulatorJS-Netplay",
                    genericName: "EmulatorJS-Netplay",
                    categories: [
                        "Game",
                        "Emulator"
                    ],
                    icon: "./icon.png",
                    description: "EmulatorJS Netplay",
                    AppImageKitRelease: "continuous",
                },
                mimeType: ['x-scheme-handler/emulatorjs-netplay']
            }
        }
    ]
}
