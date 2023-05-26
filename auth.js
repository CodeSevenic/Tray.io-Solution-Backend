const { log } = require('./logging');

const { attemptLogin, generateUserAccessToken, attemptUpdateUser } = require('./domain/login');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const { checkUserExists, generateNewUser, validateRequest } = require('./domain/registration');
const {
  getUserFromDB,
  updateUserValues,
  getUserByDocId,
  updateUserOnFirebase,
} = require('./firebase-db');
const { json, response } = require('express');
const { getData } = require('./db');
const { get } = require('lodash');

module.exports = function (app) {
  app.use(
    require('express-session')({
      secret: '2C44-4D44-WppQ38S',
      resave: true,
      saveUninitialized: true,
    })
  );

  /*
   * /api/login:
   * Attempt to retrieve user from DB, if not found respond with 401 status.
   * Otherwise attempt to generate a tray access token and set user info onto
   * session.
   */
  app.post('/api/login', async function (req, res) {
    const email = req.body.email;
    const password = req.body.password;
    // refresh DB
    getUserFromDB();

    try {
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const docId = userCredential.user.uid;
      const userObj = await getUserByDocId(docId);

      const user = {
        uuid: userObj.user.uuid,
        trayId: userObj.user.trayId,
        name: userObj.user.body.name,
        username: userObj.user.body.username,
        adm: userObj.user.body.admin,
      };

      if (!user.trayId) {
        return res.status(500).send({
          error: `Unable to login. User "${user.username}" found locally is missing one or more of following required fields: uuid, trayId`,
        });
      }

      req.session.user = user;
      log({
        message: 'Logged in with:',
        object: user,
      });

      const uuid = user.uuid;
      const name = user.name;
      const username = user.username;
      let admin;
      let changePass;
      if (user.adm) {
        admin = user.adm;
      }

      // Attempt to generate the external user token and save to session:
      await generateUserAccessToken(req, res, user);

      // Send success response
      res.json({
        userToken: uuid,
        name: name,
        username: username,
        docId: docId,
        adm: admin,
        chg: changePass,
      });
    } catch (error) {
      // Log error
      log({ message: 'Login failed for user:', object: req.body });

      // Determine the status code
      let statusCode = 401;
      if (error.message === 'Failed to generate user access token') {
        statusCode = 500;
      }

      // Send error response
      res.status(statusCode).send({
        error:
          statusCode === 500 ? error : 'Login Error please try again with correct credentials.',
      });
    }
  });

  /**
   * /api/update-credentials
   */
  app.post('/api/update-credentials', async (req, res) => {
    const docId = req.body.docId;
    const name = req.body.name;
    const username = req.body.username;
    const password = req.body.password;
    console.log('User Information', docId, name, username, password);

    const result = await updateUserOnFirebase(docId, name, username, password);

    if (result) {
      res.status(200).send({
        message: 'User details successfully updated',
      });
    } else {
      res.status(500).send({
        message: 'User details failed to update',
      });
    }

    // await updateUserValues(
    //   req.body.userId,
    //   req.body.name,
    //   req.body.username,
    //   req.body.password
    // ).then((response) =>
    //   res.status(204).send({
    //     message: 'User details successfully updated',
    //   })
    // );
  });

  /*
   * /api/register:
   * Check if user already exists, if so respond with 409 status.
   * Validate request body, if not valid respond with 400 status.
   * Otherwise attempt to generate a tray user and insert new user object into
   * the DB.
   */
  app.post('/api/register', function (req, res) {
    if (checkUserExists(req)) {
      log({ message: 'Failed to create user, already exists:', object: req.body });
      return res.status(409).send(`User name ${req.body.username} already exists`);
    }

    const validation = validateRequest(req);

    if (!validation.valid) {
      const errorMsg = `The following params missing in user object, [${validation.errors.join(
        ', '
      )}]`;
      log({ message: errorMsg });
      return res.status(400).send(errorMsg);
    }

    generateNewUser(req)
      .then((user) => {
        log({ message: `successfully created user ${req.body.username}`, object: user });
        const data = getUserFromDB();
        getData(data);
        return res.status(200).send(user);
      })
      .catch((err) => {
        log({ message: 'There was an error creating the external Tray user:', object: err });
        res.status(500).send('There was an error creating the external Tray user:');
      });
  });

  /*
   * /api/logout:
   * Remove session data.
   */
  app.post('/api/logout', function (req, res) {
    req.session.destroy();
    res.sendStatus(200);
  });

  // Authenticate all endpoints except the auth endpoints defined in this module
  // app.use(function (req, res, next) {
  //   if (req.session && req.session.admin) {
  //     return next();
  //   } else {
  //     console.log('BAD Stuff');
  //     return res.sendStatus(401);
  //   }
  // });
};
