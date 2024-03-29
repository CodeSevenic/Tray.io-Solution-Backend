const { deleteDoc, doc } = require('firebase/firestore');
const {
  deleteUserFromDB,
  deleteNonTrayUsers,
  getUserFromDB,
  deleteUserByTrayId,
  sendPasswordResetEmail,
} = require('./firebase-db');
const { mutations, queries } = require('./graphql');
const { get, map, values } = require('lodash');

// Get nodes for a given path from graphQL response:
function getNodesAt(results, path) {
  return map(values(get(results, path)), (x) => x.node);
}
const masterToken = process.env.TRAY_MASTER_TOKEN;
const solutionPath = `${process.env.TRAY_APP_URL}/external/solutions/${process.env.TRAY_PARTNER}`;
const editAuthPath = `${process.env.TRAY_APP_URL}/external/auth/edit/${process.env.TRAY_PARTNER}`;
const createAuthPath = `${process.env.TRAY_APP_URL}/external/auth/create/${process.env.TRAY_PARTNER}`;

module.exports = function (app) {
  // GET Account:
  app.get('/api/me', (req, res) => {
    queries
      .me(req.session.token)
      .then((results) => res.status(200).send(results.data.viewer.details))
      .catch((err) => res.status(500).send(err));
  });

  // GET user auths:
  app.get('/api/auths', (req, res) => {
    queries
      .auths(req.session.token)
      .then((results) => {
        res.status(200).send({
          data: getNodesAt(results, 'data.viewer.authentications.edges'),
        });
      })
      .catch((err) => res.status(500).send(err));
  });

  // GET auth url:
  app.post('/api/auth', (req, res) => {
    mutations
      .getGrantTokenForUser(req.session.user.trayId)
      .then(({ payload }) => {
        const authorizationCode = payload.data.generateAuthorizationCode.authorizationCode;
        res.status(200).send({
          data: {
            popupUrl: `${editAuthPath}/${req.body.authId}?code=${authorizationCode}`,
          },
        });
      })
      .catch((err) => res.status(500).send(err));
  });

  // GET auth create url:
  app.post('/api/auth/create', (req, res) => {
    mutations
      .getGrantTokenForUser(req.session.user.trayId)
      .then(({ payload }) => {
        const authorizationCode = payload.data.generateAuthorizationCode.authorizationCode;
        const popupUrl =
          req.body.solutionInstanceId && req.body.externalAuthId
            ? `${createAuthPath}/${req.body.solutionInstanceId}/${req.body.externalAuthId}?code=${authorizationCode}`
            : `${createAuthPath}?code=${authorizationCode}`;

        res.status(200).send({
          data: {
            popupUrl,
          },
        });
      })
      .catch((err) => res.status(500).send(err));
  });

  // GET Solutions:
  app.get('/api/solutions', (req, res) => {
    queries
      .solutions()
      .then((results) => {
        res.status(200).send({
          data: getNodesAt(results, 'data.viewer.solutions.edges'),
        });
      })
      .catch((err) => res.status(500).send(err));
  });

  // GET Solution Instances:
  app.get('/api/solutionInstances', (req, res) => {
    const externalUserToken = req.session.token;

    if (!externalUserToken) {
      console.log('Missing external user auth');
      res.status(500).send('Missing external user auth');
    }

    queries
      .solutionInstances(externalUserToken)
      .then((results) => {
        res.status(200).send({
          data: getNodesAt(results, 'data.viewer.solutionInstances.edges'),
        });
      })
      .catch((err) => res.status(500).send(err));
  });

  // POST Solution Instances
  app.post('/api/solutionInstances', (req, res) => {
    mutations
      .createSolutionInstance(req.session.token, req.body.id, req.body.name)
      .then((solutionInstance) => {
        return mutations.getGrantTokenForUser(req.session.user.trayId).then(({ payload }) => {
          const solutionInstanceId =
            solutionInstance.data.createSolutionInstance.solutionInstance.id;
          const authorizationCode = payload.data.generateAuthorizationCode.authorizationCode;
          res.status(200).send({
            data: {
              popupUrl: `${solutionPath}/configure/${solutionInstanceId}?code=${authorizationCode}`,
            },
          });
        });
      })
      .catch((err) => {
        console.log('error: ', err);
        res.status(500).send(err);
      });
  });

  // PATCH solution instance:
  app.patch('/api/solutionInstance/:solutionInstanceId', (req, res) => {
    mutations
      .updateSolutionInstance(req.session.token, req.params.solutionInstanceId, req.body.enabled)
      .then(() => res.sendStatus(200))
      .catch((err) => res.status(500).send({ err }));
  });

  // PATCH Solution Instance configuration:
  app.patch('/api/solutionInstance/:solutionInstanceId/config', (req, res) => {
    mutations
      .getGrantTokenForUser(req.session.user.trayId, req.params.solutionInstanceId)
      .then(({ payload }) => {
        const authorizationCode = payload.data.generateAuthorizationCode.authorizationCode;
        res.status(200).send({
          data: {
            popupUrl: `${solutionPath}/configure/${req.params.solutionInstanceId}?code=${authorizationCode}`,
          },
        });
      })
      .catch((err) => res.status(500).send({ err }));
  });

  // DELETE Solution Instance:
  app.delete('/api/solutionInstance/:solutionInstanceId', (req, res) => {
    mutations
      .deleteSolutionInstance(req.session.token, req.params.solutionInstanceId)
      .then(() => res.sendStatus(200))
      .catch((err) => res.status(500).send({ err }));
  });

  // GET users
  app.get('/api/solutionUsers', (req, res) => {
    queries
      .users(masterToken)
      .then((results) => {
        res.status(200).send({
          results,
        });
      })
      .catch((err) => res.status(500).send(err));
  });

  const fetchUsers = async () => {
    const users = await queries.users(masterToken);
    // console.log('Users', users.data.users.edges);
    for (let user of users.data.users.edges) {
      const trayId = user.node.id;
      const firstName = user.node.name;
      const externalUserId = user.node.externalUserId;

      console.log('User info', firstName, ' == ', trayId);
    }
    // return users;
  };
  // fetchUsers();
  // deleteNonTrayUsers(masterToken);

  // Delete user end point
  app.post('/api/deleteUser/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
      // Delete user in Tray.io
      const results = await mutations.deleteUser(userId, masterToken);
      await deleteUserByTrayId(userId);

      res.status(200).send({ results });
    } catch (err) {
      console.log(err);
      res.status(500).send(err);
    }
  });

  // Delete auth
  app.post('/api/deleteAuth', (req, res) => {
    const authId = req.body.authId;
    const userToken = req.session.token;
    mutations
      .deleteAuth(userToken, authId)
      .then((response) => response.text())
      .then((results) => {
        res.status(200).send({
          results,
        });
      })
      .catch((error) => console.log('error', error));
  });

  // User reset password endpoint
  app.post('/api/reset-password', (req, res) => {
    const { email } = req.body;
    console.log('Email: ', email);
    sendPasswordResetEmail(email, res);
  });
};
