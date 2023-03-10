// Module with all graphql queries and mutations:

const gql = require('graphql-tag');
const fetch = require('node-fetch');
const { Headers } = fetch;

const { generateClient, masterClient } = require('./gqlclient');

exports.queries = {
  me: (token) => {
    const query = gql`
      {
        viewer {
          details {
            username
            email
          }
        }
      }
    `;

    return generateClient(token).query({ query });
  },

  auths: (token) => {
    const query = gql/*template*/ `
      {
        viewer {
          authentications {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;

    return generateClient(token).query({ query });
  },
  // Get all available users
  users: (token) => {
    const query = gql/*template*/ `
      {
        users {
          edges {
            node {
              name
              id
              externalUserId
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
            hasPreviousPage
            startCursor
          }
        }
      }
    `;

    return generateClient(token).query({ query });
  },

  solutions: () => {
    const query = gql`
      {
        viewer {
          solutions {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      }
    `;

    return masterClient.query({ query });
  },

  solutionInstances: (token) => {
    const query = gql`
      {
        viewer {
          solutionInstances {
            edges {
              node {
                id
                name
                enabled
              }
            }
          }
        }
      }
    `;

    return generateClient(token).query({ query });
  },

  solutionInstance: (id, token) => {
    const query = gql`
            {
                viewer {
                    solutionInstances(criteria: {ids: "${id}"}) {
                        edges {
                            node {
                                id
                                name
                                enabled
                            }
                        }
                    }
                }
            }
        `;

    return generateClient(token).query({ query });
  },

  trayUsername: (uuid) => {
    const query = gql`
            {
                users(criteria: {externalUserId: "${uuid}"}) {
                    edges {
                        node {
                            id
                        }
                    }
                }
            }
        `;

    return masterClient.query({ query });
  },
};

exports.mutations = {
  authorize: (trayId) => {
    const mutation = gql`
            mutation {
                authorize(input: {userId: "${trayId}"}) {
                    accessToken
                }
            }
        `;

    return masterClient.mutate({ mutation });
  },

  createSolutionInstance: (userToken, solutionId, name) => {
    const mutation = gql`
            mutation {
                createSolutionInstance(input: {solutionId: "${solutionId}", instanceName: "${name}", authValues: [], configValues: []}) {
                    solutionInstance {
                        id
                    }
                }
            }
        `;

    return generateClient(userToken).mutate({ mutation });
  },

  updateSolutionInstance: (userToken, solutionInstanceId, enabled) => {
    const mutation = gql`
            mutation {
                updateSolutionInstance(input: {solutionInstanceId: "${solutionInstanceId}", enabled: ${enabled}}) {
                    clientMutationId
                }
            }
        `;

    return generateClient(userToken).mutate({ mutation });
  },

  createExternalUser: (uuid, name) => {
    const mutation = gql`
            mutation {
                createExternalUser(input : {externalUserId: "${uuid}", name: "${name}"}) {
                    userId
                }
            }
        `;

    return masterClient.mutate({ mutation });
  },

  getGrantTokenForUser: (trayId, workflowId) => {
    const mutation = gql`
            mutation {
                generateAuthorizationCode(input: {userId: "${trayId}"}) {
                    authorizationCode
                }
            }
        `;

    return masterClient.mutate({ mutation }).then((payload) => {
      return {
        payload,
        workflowId,
      };
    });
  },

  deleteSolutionInstance: (userToken, solutionInstanceId) => {
    const mutation = gql`
            mutation {
                removeSolutionInstance(input: {solutionInstanceId: "${solutionInstanceId}"}) {
                    clientMutationId
                }
            }
        `;

    return generateClient(userToken).mutate({ mutation });
  },
  // Delete user function
  deleteUser: (userId, masterToken) => {
    const mutation = gql/*template*/ `
            mutation {
              removeExternalUser(input: {userId: "${userId}"}) {
                clientMutationId
              }
            }
        `;

    return generateClient(masterToken).mutate({ mutation });
  },

  // Delete Auth
  deleteAuth: (userToken, authId) => {
    let myHeaders = new Headers();
    myHeaders.append('Authorization', `Bearer ${userToken}`);
    myHeaders.append('Content-Type', 'application/json');

    let graphql = JSON.stringify({
      query:
        'mutation ($authenticationId: ID!){\n  removeAuthentication(input: { authenticationId: $authenticationId }) {\n    clientMutationId\n  }\n}',
      variables: { authenticationId: `${authId}` },
    });
    let requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: graphql,
      redirect: 'follow',
    };

    return fetch('https://tray.io/graphql', requestOptions);
  },
};
