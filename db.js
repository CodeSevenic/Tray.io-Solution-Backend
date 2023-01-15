// const { getUserFromDB } = require('./firebase-db');

// In-memory users instead of a DB:
let mockUserDB = [];

// Use Real DB store instead of mockDB
exports.getData = async (data) => {
  const dbData = await data;
  // const data = await getUserFromDB();
  console.log(dbData);
  mockUserDB = dbData;
};

// this.getData();

/**
 * Retreive user from the Mock DB:
 * @param {User} input - {username: 'myname', password: 'mypass'}
 * @returns {User | undefined}
 */
exports.retrieveUserFromMockDB = (input) => {
  const matches = mockUserDB.filter(
    (user) => user.username === input.username && user.password === input.password
  );

  return matches[0];
};
/**
 * Retreive user by UUID from the Mock DB:
 * @param {User} input - {uuid: '46ytd-jgf6hg'}
 * @returns {User | undefined}
 */
exports.retrieveUserByUuId = (input) => {
  const matches = mockUserDB.filter((user) => user.uuid === input.uuid);

  return matches[0];
};

/**
 * Check user exists in Mock DB:
 * @param {User} input
 * @returns {Boolean}
 */
exports.userExistsInMockDB = (input) => {
  const matches = mockUserDB.filter((user) => user.username === input.username);
  return matches.length > 0;
};

/**
 * Insert user into the Mock DB:
 * @param {User} input
 *
 * @returns {Void}
 */
exports.insertUserToMockDB = (input) => {
  mockUserDB.push({
    name: input.body.name,
    uuid: input.uuid,
    trayId: input.trayId,
    username: input.body.username,
    password: input.body.password,
    adm: input.body.adm,
  });
};
