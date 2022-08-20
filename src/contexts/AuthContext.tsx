import Router from 'next/router';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/apiClient';
import { setCookie, parseCookies, destroyCookie } from 'nookies';

type SignInCredentials = {
  email: string;
  password: string;
};

type User = {
  email: string;
  permissions: string[];
  roles: string[];
};

type AuthContextData = {
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signOut: () => void;
  user: User | undefined;
  isAuthenticated: boolean;
};

type AuthProviderProps = {
  children: React.ReactNode;
};

let authChannel: BroadcastChannel;

export function signOut() {
  destroyCookie(undefined, 'auth.token');
  destroyCookie(undefined, 'auth.refreshToken');

  authChannel.postMessage('signOut');

  Router.push('/');
}

const AuthContext = createContext({} as AuthContextData);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User>();

  const isAuthenticated = !!user;

  useEffect(() => {
    authChannel = new BroadcastChannel('auth');

    authChannel.onmessage = (message) => {
      switch (message.data) {
        case 'signOut':
          signOut();
          authChannel.close();
          break;
        case 'signIn':
          window.location.replace('http://localhost:3000/dashboard');
          break;
        default:
          break;
      }
    };
  }, []);

  useEffect(() => {
    const { 'auth.token': token } = parseCookies();

    if (token) {
      api
        .get('/me')
        .then((response) => {
          const { email, permissions, roles } = response.data;

          setUser({ email, permissions, roles });
        })
        .catch(() => {
          signOut();
        });
    }
  }, []);

  async function signIn({ email, password }: SignInCredentials) {
    try {
      const response = await api.post('sessions', {
        email,
        password,
      });

      const { token, refreshToken, permissions, roles } = response.data;

      setCookie(undefined, 'auth.token', token, {
        maxAge: 60 * 60 * 24 * 30, // 30 dias
        path: '/', //Quando tem / qualquer rota da aplicação tem acesso ao cookie (global)
      }); //o primeiro parâmetro é undefined se estiver pelo lado do browser

      setCookie(undefined, 'auth.refreshToken', refreshToken, {
        maxAge: 60 * 60 * 24 * 30, // 30 dias
        path: '/',
      });

      setUser({
        email,
        permissions,
        roles,
      });

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      Router.push('/dashboard');
      authChannel.postMessage('signIn');
    } catch (err) {
      console.log(err);
    }
  }

  return (
    <AuthContext.Provider value={{ signIn, signOut, isAuthenticated, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
