

class Room {
    /**
     * Create a Room
     * @param {string} domain 
     * @param {number} game_id 
     * @param {string} sessionid 
     * @param {string} name 
     * @param {number} max 
     * @param {number} current 
     * @param {string} password 
     * @param {string} userid 
     * @param { import("socket.io").Socket } socket
     * @param {any} extra
     * 
     
     */
    constructor(domain, game_id, sessionid, name, max, current, password, userid, socket, extra) {
        /** @type string */
        this.domain = domain;
        /** @type number */
        this.game_id = game_id;
        /** @type string */
        this.sessionid = sessionid;
        /** @type string */
        this.name = name;
        /** @type number */
        this.max = max;
        /** @type number */
        this.current = current;
        /** @type string */
        this.password = password.trim();
        /** @type boolean */
        this.hasPassword = !!this.password;
        /** @type string */

        this.id = domain + ':' + game_id + ':' + sessionid;

        // define user type

        /**
         * @typedef {Object} User
         * @property {string} userid
         * @property { import("socket.io").Socket } socket
         * @property {any} extra 
         */

        /**
         * @type User
         */
        this.owner = {
            userid,
            socket,
            extra
        }
        /** @type User[] */
        this.users = [this.owner];
    }
    /**
     * Checks to see if the specified password matches this password
     * @param {string} password 
     * @returns 
     */
    checkPassword(password) {
        return password.trim() === this.password;
    }
    /**
     * Adds the user
     * @param {User} user 
     * 
     * @typedef {Object} User
     * @property {string} userid
     * @property { import("socket.io").Socket } socket
     * @property {any} extra 
     */
    addUser(user) {
        this.users.forEach(userr => {
            user.socket.emit('user-connected', userr.userid);
        })
        this.users.push(user);
        this.current++;
    }
}


export default Room;
