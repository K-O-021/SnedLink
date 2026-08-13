const { auth } = require('./config/firebase');

async function setAdminPassword() {
  const email = 'admin.07@gmail.com';
  const password = 'admin@07';

  try {
    const user = await auth.getUserByEmail(email);

    await auth.updateUser(user.uid, {
      password: password,
      disabled: false
    });

    console.log('Admin password updated successfully.');
    console.log('Email:', email);
    console.log('UID:', user.uid);
  } catch (error) {
    console.error('Failed to update admin password:', error);
    process.exitCode = 1;
  }
}

setAdminPassword();