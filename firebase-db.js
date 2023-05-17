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
} = require('firebase/firestore');
const { getData } = require('./db');

// =========== CODE TO STORE THE USER ACCESS IN FIREBASE ========== //

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCsPFUPevaJJxNR_PHsBoTaeK1BQddgVoU',
  authDomain: 'yubodata-9137d.firebaseapp.com',
  projectId: 'yubodata-9137d',
  storageBucket: 'yubodata-9137d.appspot.com',
  messagingSenderId: '89046230269',
  appId: '1:89046230269:web:596a3347e7f368620cca94',
};

const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase);

// exports.addUserToBD = async (user) => {
//   try {
//     const docRef = await addDoc(collection(db, 'users'), {
//       user,
//     });
//     console.log('Document written with ID: ', docRef.id);
//   } catch (e) {
//     console.error('Error adding document: ', e);
//   }
// };

exports.addUserToBD = async (user) => {
  try {
    const docRef = doc(db, 'users', user.body.username); // create a reference to a document with ID 'username'
    await setDoc(docRef, { user }); // write data to the document
    console.log('Document written with ID: ', user.body.username);
  } catch (e) {
    console.error('Error adding document: ', e);
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
