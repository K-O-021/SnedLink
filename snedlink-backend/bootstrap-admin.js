const { auth, db } = require('./config/firebase');

async function bootstrapAdmin() {
  const email = 'admin.07@gmail.com';

  try {
    let user;

    try {
      user = await auth.getUserByEmail(email);
      console.log(`Firebase Auth user already exists: ${user.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        user = await auth.createUser({
          email,
          emailVerified: true,
          password: 'admin@07',
          disabled: false
        });

        console.log(`Created Firebase Auth user: ${user.uid}`);
      } else {
        throw error;
      }
    }

    await db.collection('users').doc(user.uid).set(
      {
        name: 'System Administrator',
        email,
        role: 'admin',
        status: 'active',
        createdAt: new Date()
      },
      { merge: true }
    );

    console.log('Admin Firestore profile created/updated.');
    console.log(`Admin UID: ${user.uid}`);
    console.log(`Admin email: ${email}`);
  } catch (error) {
    console.error('Bootstrap failed:', error);
    process.exitCode = 1;
  }
}

bootstrapAdmin();