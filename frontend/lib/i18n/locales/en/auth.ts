import { Messages } from '../../types';

export const authEn: Messages = {
  login: {
    title: 'Sign in to your account',
    subtitle: 'Enter your credentials to access the system',
    fields: {
      email: 'Email',
      password: 'Password',
    },
    actions: {
      login: 'Sign in',
      forgotPassword: 'Forgot password?',
    },
    errors: {
      invalidCredentials: 'Invalid email or password',
      loginError: 'Login error',
      required: 'Email and password are required',
    },
  },
  logout: {
    title: 'Sign out',
    confirm: 'Are you sure you want to sign out?',
  },
};

