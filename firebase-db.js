const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  where,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
} = require('firebase/firestore');
const {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  deleteUser,
} = require('firebase/auth');

const admin = require('firebase-admin');

const { getData } = require('./db');
const { queries } = require('./graphql');
require('dotenv').config();

admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.ADMIN_TYPE,
    projectId: process.env.ADMIN_PROJECT_ID,
    privateKeyId: process.env.ADMIN_PRIVATE_KEY_ID,
    privateKey: process.env.ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.ADMIN_CLIENT_EMAIL,
    clientId: process.env.ADMIN_CLIENT_ID,
    authUri: process.env.ADMIN_AUTH_URI,
    tokenUri: process.env.ADMIN_TOKEN_URI,
    authProviderX509CertUrl: process.env.ADMIN_AUTH_PROVIDER_X509_CERT_URL,
    clientC509CertUrl: process.env.ADMIN_CLIENT_X509_CERT_URL,
  }),
});
// =========== CODE TO STORE THE USER ACCESS IN FIREBASE ========== //

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
};

const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase);
const auth = getAuth();

exports.addUserToBD = async (user) => {
  try {
    const docRef = doc(db, 'users', user.body.username); // create a reference to a document with ID 'username'
    await setDoc(docRef, { user }); // write data to the document
    console.log('Document written with ID: ', user.body.username);
  } catch (e) {
    console.error('Error adding document: ', e);
  }
};

exports.deleteUserFromDB = async (user) => {
  try {
    const docRef = doc(db, 'users', user.body.username); // create a reference to a document with ID 'username'
    await deleteDoc(docRef); // delete the document
    console.log('Document deleted with ID: ', user.body.username);
  } catch (e) {
    console.error('Error deleting document: ', e);
  }
};

// get users from DB
exports.getUserFromDB = async () => {
  const querySnapshot = await getDocs(collection(db, 'users'));
  let users = [];
  querySnapshot.forEach((doc) => {
    // console.log(`${doc.id} => ${doc.get('user.body.name')}`);
    const user = {
      name: doc.get('user.body.name'),
      uuid: doc.get('user.uuid'),
      trayId: doc.get('user.trayId'),
      username: doc.get('user.body.username'),
      password: doc.get('user.body.password'),
      adm: doc.get('user.body.admin'),
      docId: doc.id,
    };

    users.push(user);
  });

  // console.log(users);
  return users;
};

// Get fresh DB
const data = this.getUserFromDB();
getData(data);

exports.updateUserValues = async (userId, name, username, password) => {
  const q = query(collection(db, 'users'), where('user.uuid', '==', userId));
  const querySnapshot = await getDocs(q);

  let doc_id;

  querySnapshot.forEach((doc) => {
    doc_id = doc.id;
  });
  console.log('Dog ID: ', doc_id);

  const updateUser = doc(db, 'users', `${doc_id}`);

  await updateDoc(updateUser, {
    'user.body.name': name,
    'user.body.username': username,
    'user.body.password': password === '' ? '1234567890' : password,
  }).then((res) => {
    // Get recently updated DB
    const dataUpdated = this.getUserFromDB();
    getData(dataUpdated);
  });
};

// Function to delete users not found in Tray.io data
exports.deleteNonTrayUsers = async (masterToken) => {
  // Fetch all users from Firebase
  const firebaseUsers = await exports.getUserFromDB();

  // Map them by their trayId
  const firebaseUsersMap = firebaseUsers.reduce((map, user) => {
    map[user.trayId] = user;
    return map;
  }, {});

  // Fetch user data from Tray.io
  const trayUsers = await queries.users(masterToken);

  // Loop through each user from Firebase
  for (let trayId in firebaseUsersMap) {
    // Find the corresponding user in Tray.io
    const trayUser = trayUsers.data.users.edges.find((edge) => edge.node.id === trayId);

    // If the user does not exist in Tray.io, remove it from Firebase
    if (!trayUser) {
      const userToDelete = firebaseUsersMap[trayId];
      await deleteDoc(doc(db, 'users', userToDelete.docId));
    }
  }
};

// Delete user by Tray.io ID
exports.deleteUserByTrayId = async (trayId) => {
  // Get all users from Firestore
  const firebaseUsers = await exports.getUserFromDB();

  // Find the corresponding user in Firebase
  const firebaseUser = firebaseUsers.find((user) => user.trayId === trayId);

  // If the user exists in Firebase, remove it
  if (firebaseUser.docId) {
    console.log('firebaseUser Doc ID', firebaseUser.docId);

    // Delete the Firestore document
    await deleteDoc(doc(db, 'users', firebaseUser.docId));

    // Delete the Firebase Auth user
    await admin.auth().deleteUser(firebaseUser.docId);
    // await deleteUser(auth, firebaseUser.docId);
  } else {
    console.log('User not found');
  }
};

// create user with email and password
exports.createUserOnFirebase = (name, username, email, password, admin = false, trayId, uuid) => {
  console.log('Creating user on Firebase: ', name, username, email, password, admin, trayId, uuid);
  createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      // User created
      const user = userCredential.user;
      console.log('User created: ', user.uid);

      // Also create a Firestore document for the user
      const userDoc = doc(db, 'users', user.uid);
      await setDoc(userDoc, {
        user: {
          body: {
            name: name,
            username: username,
            admin: admin,
          },
          trayId: trayId,
          uuid: uuid,
        },
      });
    })
    .catch((error) => {
      // Handle errors
      console.log('Error: ', error.message);
    });
};

exports.getUserByDocId = async (docId) => {
  const userRef = doc(db, 'users', docId);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    return userDoc.data();
  } else {
    console.log('No such user!');
    return null;
  }
};

// Util function to Register all users on Firebase
exports.registerAllUsers = async () => {
  // Get the list of users from the database
  const users = await exports.getUserFromDB();

  // Loop through the users
  for (let user of users) {
    // Skip the loop if the email is "Sibusiso" or "testuser"
    if (user.username === 'Sibusiso' || user.username === 'testuser') {
      continue;
    }
    userObj = {
      name: user.name,
      username: user.username,
      email: user.username,
      password: user.password,
      trayId: user.trayId,
      uuid: user.uuid,
    };

    let admin = false;

    const { name, username, email, trayId, uuid, password } = userObj;
    // console.log('Registering user: ', email);
    try {
      // Register each user on Firebase
      await exports.createUserOnFirebase(name, username, email, password, admin, trayId, uuid);

      console.log(`User ${name} registered with Firebase Authentication`);
    } catch (error) {
      // Handle errors
      console.error(`Error registering user ${name}: ${error.message}`);
    }
  }
};

// Handle password reset
exports.sendPasswordResetEmail = (email, res) => {
  sendPasswordResetEmail(auth, email)
    .then(() => {
      res.status(200).json({ message: `Password reset email sent to ${email}` });
    })
    .catch((error) => {
      res.status(400).json({ message: `Error: Email don't exist` });
    });
};

// Handle user info update
/*
exports.updateUserOnFirebase = async (
  uid,
  name,
  username,
  email,
  password,
  adminStatus = false,
  trayId,
  uuid
) => {
  console.log(
    'Updating user on Firebase: ',
    uid,
    name,
    username,
    email,
    password,
    adminStatus,
    trayId,
    uuid
  );

  try {
    // Update authentication info
    await admin.auth().updateUser(uid, {
      email: email,
      password: password,
      displayName: name,
    });

    console.log('User Profile and Password Updated');

    // Also update the Firestore document for the user
    const userDoc = admin.firestore().doc(`users/${uid}`);

    await userDoc.update({
      'user.body': {
        name: name,
        username: username,
        admin: adminStatus,
      },
      trayId: trayId,
      uuid: uuid,
    });

    console.log('Firestore document updated');
  } catch (error) {
    console.log('Error: ', error.message);
  }
};

*/

// exports.deleteUsersWithPassword = async () => {
//   // Get the list of users from the database
//   const users = await exports.getUserFromDB();

//   // Loop through the users
//   for (let user of users) {
//     // Skip the loop if user has no password
//     if (!user.password) {
//       continue;
//     }
//     // Check if the user has a password
//     if (user.password) {
//       // Delete the user document
//       const userDoc = doc(db, 'users', user.docId);
//       await deleteDoc(userDoc);
//       console.log(`User ${user.name} has been deleted because a password field was present.`);
//     }
//   }
// };

// exports.deleteUsersWithPassword();
