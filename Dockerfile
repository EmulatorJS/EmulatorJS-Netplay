FROM node:latest
WORKDIR /emulatorjs-netplay-server
COPY package*.json ./
RUN npm i
COPY . /emulatorjs-netplay-server/
EXPOSE 8080
CMD ["npm", "start"]
