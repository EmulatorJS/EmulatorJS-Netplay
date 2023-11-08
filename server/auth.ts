import { Request, Response, NextFunction } from 'express';
function authentication(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Unauthorized');
    }
    const [username, password] = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString().split(':');
    if (username === 'admin' && password === 'pass') {
        next();
    }
    else {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Unauthorized');
    }
}
export { authentication };
